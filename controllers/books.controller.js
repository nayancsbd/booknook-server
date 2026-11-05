import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db.js';
import {
  isValidObjectId,
  validateBookCreate,
  validateBookUpdate,
} from '../utils/validation.js';

export async function getBooks(req, res, next) {
  try {
    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const { limit, sort, addedBy, category, search } = req.query;

    const filter = {};
    const conditions = [];

    if (category && String(category).trim() && String(category).trim().toLowerCase() !== 'all') {
      const escapedCat = String(category).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      conditions.push({ category: new RegExp(`^${escapedCat}$`, 'i') });
    }

    if (addedBy) {
      const email = String(addedBy).trim();
      const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const emailRegex = new RegExp(`^${escaped}$`, 'i');
      conditions.push({
        $or: [
          { addedBy: emailRegex },
          { addedByEmail: emailRegex },
          { userEmail: emailRegex },
        ],
      });
    }

    if (search && String(search).trim()) {
      const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      conditions.push({
        $or: [
          { title: { $regex: searchRegex } },
          { author: { $regex: searchRegex } },
        ],
      });
    }

    if (conditions.length === 1) {
      Object.assign(filter, conditions[0]);
    } else if (conditions.length > 1) {
      filter.$and = conditions;
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    }

    let cursor = booksCollection.find(filter).sort(sortOption);

    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
        cursor = cursor.limit(parsedLimit);
      }
    }

    const books = await cursor.toArray();
    return res.status(200).json(books);
  } catch (error) {
    return next(error);
  }
}

export async function getBookById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({
        message: 'Book not found with the specified identifier.',
      });
    }

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) {
      return res.status(404).json({
        message: 'Book not found with the specified identifier.',
      });
    }

    return res.status(200).json(book);
  } catch (error) {
    return next(error);
  }
}

export async function createBook(req, res, next) {
  try {
    const ownerEmail = (req.user?.email || '').trim();
    const ownerName = (
      req.user?.name ||
      req.user?.userName ||
      (ownerEmail ? ownerEmail.split('@')[0] : 'Library Patron')
    ).trim();

    if (!ownerEmail) {
      return res.status(401).json({
        message: 'Verified user email missing from authentication credentials.',
      });
    }

    const validation = validateBookCreate(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        message: validation.message,
        errors: validation.errors,
      });
    }

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const newBook = {
      ...validation.sanitized,
      copies: validation.sanitized.totalCopies,
      createdAt: new Date(),
      addedBy: ownerEmail,
      addedByEmail: ownerEmail,
      userEmail: ownerEmail,
      addedByName: ownerName,
      userName: ownerName,
    };

    const result = await booksCollection.insertOne(newBook);
    const createdBook = { _id: result.insertedId, ...newBook };

    return res.status(201).json(createdBook);
  } catch (error) {
    return next(error);
  }
}

export async function updateBook(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({
        message: 'Book not found with the specified identifier.',
      });
    }

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const existingBook = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!existingBook) {
      return res.status(404).json({
        message: 'Book not found with the specified identifier.',
      });
    }

    const bookOwnerEmail =
      existingBook.addedByEmail ||
      existingBook.addedBy ||
      existingBook.userEmail;

    if (
      !bookOwnerEmail ||
      !req.user?.email ||
      bookOwnerEmail.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      return res.status(403).json({
        message: 'Access denied. You can only modify books that you added to the library.',
      });
    }

    const validation = validateBookUpdate(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        message: validation.message,
        errors: validation.errors,
      });
    }

    if (!validation.hasFields) {
      return res.status(400).json({
        message: 'No valid fields provided for update. Allowed fields: title, author, category, image, description, totalCopies, copies.',
      });
    }

    const updateDoc = {
      ...validation.updates,
      updatedAt: new Date(),
    };

    const updatedBook = await booksCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );

    return res.status(200).json(updatedBook);
  } catch (error) {
    return next(error);
  }
}

export async function deleteBook(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({
        message: 'Book not found with the specified identifier.',
      });
    }

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const existingBook = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!existingBook) {
      return res.status(404).json({
        message: 'Book not found with the specified identifier.',
      });
    }

    const bookOwnerEmail =
      existingBook.addedByEmail ||
      existingBook.addedBy ||
      existingBook.userEmail;

    if (
      !bookOwnerEmail ||
      !req.user?.email ||
      bookOwnerEmail.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      return res.status(403).json({
        message: 'Access denied. You can only remove books that you added to the library.',
      });
    }

    await booksCollection.deleteOne({ _id: new ObjectId(id) });

    return res.status(200).json({
      success: true,
      message: 'Book successfully deleted from the library catalog.',
    });
  } catch (error) {
    return next(error);
  }
}

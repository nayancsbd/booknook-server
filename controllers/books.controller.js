import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db.js';

const ALLOWED_CATEGORIES = ['Fiction', 'Science', 'History', 'Kids', 'Others'];

function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidObjectId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
}

export async function getBooks(req, res, next) {
  try {
    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const { limit, sort, addedBy, category, search } = req.query;

    const filter = {};
    const conditions = [];

    if (category) {
      conditions.push({ category: String(category).trim() });
    }

    if (addedBy) {
      const email = String(addedBy).trim();
      conditions.push({
        $or: [
          { addedBy: email },
          { addedByEmail: email },
          { userEmail: email },
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
        success: false,
        error: 'NotFound',
        message: 'Book not found with the specified identifier.',
      });
    }

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
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
        success: false,
        error: 'Unauthorized',
        message: 'Verified user email missing from authentication credentials.',
      });
    }

    const { title, author, category, image, description, totalCopies } = req.body;
    const errors = [];

    if (!title || typeof title !== 'string' || !title.trim()) {
      errors.push('Title is required and must be non-empty text.');
    }

    if (!author || typeof author !== 'string' || !author.trim()) {
      errors.push('Author is required and must be non-empty text.');
    }

    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      errors.push(`Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`);
    }

    if (!image || typeof image !== 'string' || !isValidUrl(image.trim())) {
      errors.push('Image must be a valid HTTP or HTTPS URL.');
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      errors.push('Description is required and must be non-empty text.');
    }

    const parsedTotalCopies = Number(totalCopies);
    if (!Number.isInteger(parsedTotalCopies) || parsedTotalCopies < 1) {
      errors.push('Total copies must be an integer greater than or equal to 1.');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: errors.join(' '),
        errors,
      });
    }

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const newBook = {
      title: title.trim(),
      author: author.trim(),
      category,
      image: image.trim(),
      description: description.trim(),
      totalCopies: parsedTotalCopies,
      copies: parsedTotalCopies,
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
        success: false,
        error: 'NotFound',
        message: 'Book not found with the specified identifier.',
      });
    }

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const existingBook = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!existingBook) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
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
        success: false,
        error: 'Forbidden',
        message: 'Access denied. You can only modify books that you added to the library.',
      });
    }

    const { title, author, category, image, description, totalCopies, copies } = req.body;
    const updates = {};
    const errors = [];

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        errors.push('Title must be non-empty text.');
      } else {
        updates.title = title.trim();
      }
    }

    if (author !== undefined) {
      if (typeof author !== 'string' || !author.trim()) {
        errors.push('Author must be non-empty text.');
      } else {
        updates.author = author.trim();
      }
    }

    if (category !== undefined) {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        errors.push(`Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}.`);
      } else {
        updates.category = category;
      }
    }

    if (image !== undefined) {
      if (typeof image !== 'string' || !isValidUrl(image.trim())) {
        errors.push('Image must be a valid HTTP or HTTPS URL.');
      } else {
        updates.image = image.trim();
      }
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || !description.trim()) {
        errors.push('Description must be non-empty text.');
      } else {
        updates.description = description.trim();
      }
    }

    if (totalCopies !== undefined) {
      const parsedTotal = Number(totalCopies);
      if (!Number.isInteger(parsedTotal) || parsedTotal < 1) {
        errors.push('Total copies must be an integer greater than or equal to 1.');
      } else {
        updates.totalCopies = parsedTotal;
      }
    }

    if (copies !== undefined) {
      const parsedCopies = Number(copies);
      if (!Number.isInteger(parsedCopies) || parsedCopies < 0) {
        errors.push('Copies must be an integer greater than or equal to 0.');
      } else {
        updates.copies = parsedCopies;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: errors.join(' '),
        errors,
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'No valid fields provided for update. Allowed fields: title, author, category, image, description, totalCopies, copies.',
      });
    }

    updates.updatedAt = new Date();

    const updatedBook = await booksCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
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
        success: false,
        error: 'NotFound',
        message: 'Book not found with the specified identifier.',
      });
    }

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const existingBook = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!existingBook) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
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
        success: false,
        error: 'Forbidden',
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

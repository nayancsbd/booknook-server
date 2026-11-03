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

/**
 * GET /books
 * Query params: limit (number), sort ('newest'), addedBy (email), category, search (case-insensitive title/author)
 * Returns an array of books.
 */
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

    // Default sort by createdAt descending ('newest' or default)
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

/**
 * GET /books/:id
 * Validates ObjectId and returns the book or 404 if missing.
 */
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

/**
 * POST /books
 * Validates title, author, category, image URL, description, totalCopies >= 1, owner name and email.
 * Stores copies = totalCopies, createdAt = new Date(), and owner details.
 */
export async function createBook(req, res, next) {
  try {
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

    const ownerEmail = (
      req.body.addedByEmail ||
      req.body.addedBy ||
      req.body.userEmail ||
      req.body.email ||
      ''
    ).trim();

    const ownerName = (
      req.body.addedByName ||
      req.body.userName ||
      req.body.name ||
      req.body.ownerName ||
      ''
    ).trim();

    if (!ownerEmail) {
      errors.push('Owner email is required.');
    }
    if (!ownerName) {
      errors.push('Owner name is required.');
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

/**
 * PATCH /books/:id
 * Updates allowed fields only.
 */
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

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');

    const updatedBook = await booksCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!updatedBook) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Book not found with the specified identifier.',
      });
    }

    return res.status(200).json(updatedBook);
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /books/:id
 * Removes the book from the database.
 */
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

    const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Book not found with the specified identifier.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Book successfully deleted from the library catalog.',
    });
  } catch (error) {
    return next(error);
  }
}


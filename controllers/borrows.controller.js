import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db.js';
import { isValidObjectId, validateBorrowInput } from '../utils/validation.js';

let indexCreated = false;

async function getBorrowsCollection(db) {
  const collection = db.collection('borrows');
  if (!indexCreated) {
    try {
      await collection.createIndex({ bookId: 1, userEmail: 1 }, { unique: true });
      indexCreated = true;
    } catch (err) {
      console.error('Notice: Borrows unique index verification:', err.message);
    }
  }
  return collection;
}

export async function createBorrow(req, res, next) {
  try {
    const userEmail = req.user?.email;
    const userName =
      req.user?.name ||
      req.user?.userName ||
      (userEmail ? userEmail.split('@')[0] : 'Library Patron');

    if (!userEmail) {
      return res.status(401).json({
        message: 'Authentication session does not contain a verified email address.',
      });
    }

    const borrowValidation = validateBorrowInput(req.body);
    if (!borrowValidation.isValid) {
      return res.status(400).json({
        message: borrowValidation.message,
      });
    }

    const { bookId } = borrowValidation;

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');
    const borrowsCollection = await getBorrowsCollection(db);

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res.status(404).json({
        message: 'The requested book was not found in the library catalog.',
      });
    }

    if (typeof book.copies === 'number' && book.copies <= 0) {
      return res.status(400).json({
        message: `All copies of "${book.title}" are currently checked out. Please check back later.`,
      });
    }

    const existingBorrow = await borrowsCollection.findOne({
      bookId: String(bookId),
      userEmail,
    });

    if (existingBorrow) {
      return res.status(409).json({
        message: `You already have an active loan for "${book.title}". Please return your current copy before borrowing again.`,
      });
    }

    const updateResult = await booksCollection.updateOne(
      { _id: new ObjectId(bookId), copies: { $gt: 0 } },
      { $inc: { copies: -1 } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        message: `Apologies! The last available copy of "${book.title}" was just checked out.`,
      });
    }

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const borrowRecord = {
      bookId: String(bookId),
      bookTitle: book.title,
      bookImage: book.image,
      category: book.category || 'Fiction',
      userName,
      userEmail,
      borrowDate: now,
      returnDate: sevenDaysLater,
    };

    try {
      const insertResult = await borrowsCollection.insertOne(borrowRecord);
      const createdBorrow = { _id: insertResult.insertedId, ...borrowRecord };

      return res.status(201).json({
        success: true,
        message: `Successfully borrowed "${book.title}". Return date is scheduled for ${sevenDaysLater.toLocaleDateString()}.`,
        borrow: createdBorrow,
      });
    } catch (insertError) {
      console.error('Insert borrow failed, rolling back copy decrement:', insertError.message);
      await booksCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { copies: 1 } }
      );

      if (insertError.code === 11000) {
        return res.status(409).json({
          message: `You already have an active loan for "${book.title}". Please return your current copy first.`,
        });
      }

      throw insertError;
    }
  } catch (error) {
    return next(error);
  }
}

export async function getUserBorrows(req, res, next) {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({
        message: 'Authentication session does not contain a verified email address.',
      });
    }

    const { db } = await connectToDatabase();
    const borrowsCollection = await getBorrowsCollection(db);

    const borrows = await borrowsCollection
      .find({ userEmail })
      .sort({ borrowDate: -1 })
      .toArray();

    return res.status(200).json(borrows);
  } catch (error) {
    return next(error);
  }
}

export async function returnBorrow(req, res, next) {
  try {
    const { id } = req.params;
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(401).json({
        message: 'Authentication session does not contain a verified email address.',
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(404).json({
        message: 'Borrow record not found with the specified identifier.',
      });
    }

    const { db } = await connectToDatabase();
    const booksCollection = db.collection('books');
    const borrowsCollection = await getBorrowsCollection(db);

    const borrow = await borrowsCollection.findOne({ _id: new ObjectId(id) });
    if (!borrow) {
      return res.status(404).json({
        message: 'Borrow record not found or already returned.',
      });
    }

    if (borrow.userEmail.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({
        message: 'Access denied. You can only return books that were borrowed under your account.',
      });
    }

    await borrowsCollection.deleteOne({ _id: new ObjectId(id) });

    if (borrow.bookId && isValidObjectId(borrow.bookId)) {
      await booksCollection.updateOne(
        { _id: new ObjectId(borrow.bookId) },
        { $inc: { copies: 1 } }
      );
    }

    return res.status(200).json({
      success: true,
      message: `"${borrow.bookTitle}" has been successfully returned to the library. Thank you!`,
    });
  } catch (error) {
    return next(error);
  }
}

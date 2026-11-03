import { Router } from 'express';
import {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
} from '../controllers/books.controller.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = Router();

// Public route: GET /books
router.get('/', getBooks);

// Protected routes: verified JWT required
router.get('/:id', verifyToken, getBookById);
router.post('/', verifyToken, createBook);
router.patch('/:id', verifyToken, updateBook);
router.delete('/:id', verifyToken, deleteBook);

export default router;

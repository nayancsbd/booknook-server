import { Router } from 'express';
import {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
} from '../controllers/books.controller.js';

const router = Router();

// Books routes
router.get('/', getBooks);
router.get('/:id', getBookById);
router.post('/', createBook);
router.patch('/:id', updateBook);
router.delete('/:id', deleteBook);

export default router;


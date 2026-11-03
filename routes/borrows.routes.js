import { Router } from 'express';
import {
  createBorrow,
  getUserBorrows,
  returnBorrow,
} from '../controllers/borrows.controller.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = Router();

router.use(verifyToken);

router.post('/', createBorrow);
router.get('/', getUserBorrows);
router.delete('/:id', returnBorrow);

export default router;

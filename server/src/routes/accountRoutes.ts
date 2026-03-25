import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  createAccount,
  deleteAccount,
  getAccounts,
  updateAccount,
} from '../controllers/accountController';

export const router = Router();

router.use(authMiddleware);

router.get('/', getAccounts);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);


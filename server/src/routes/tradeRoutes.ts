import { Router } from 'express';
import {
  createTrade,
  deleteTrade,
  getOpenTrades,
  getTradeById,
  getTrades,
  updateTrade,
} from '../controllers/tradeController';

export const router = Router();

router.get('/', getTrades);
router.post('/', createTrade);
router.get('/open', getOpenTrades);
router.get('/:id', getTradeById);
router.put('/:id', updateTrade);
router.delete('/:id', deleteTrade);


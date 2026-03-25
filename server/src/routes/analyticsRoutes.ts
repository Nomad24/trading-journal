import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  getBySymbol,
  getAnalyticsSummary,
  getEquityCurve,
  getHeatmap,
  getPnlChart,
  getWinLoss,
} from '../controllers/analyticsController';

export const router = Router();

router.use(authMiddleware);

router.get('/summary', getAnalyticsSummary);
router.get('/equity-curve', getEquityCurve);
router.get('/pnl-chart', getPnlChart);
router.get('/win-loss', getWinLoss);
router.get('/by-symbol', getBySymbol);
router.get('/heatmap', getHeatmap);


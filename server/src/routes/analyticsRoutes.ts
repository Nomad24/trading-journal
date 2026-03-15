import { Router } from 'express';
import {
  getBySymbol,
  getAnalyticsSummary,
  getEquityCurve,
  getHeatmap,
  getPnlChart,
  getWinLoss,
} from '../controllers/analyticsController';

export const router = Router();

router.get('/summary', getAnalyticsSummary);
router.get('/equity-curve', getEquityCurve);
router.get('/pnl-chart', getPnlChart);
router.get('/win-loss', getWinLoss);
router.get('/by-symbol', getBySymbol);
router.get('/heatmap', getHeatmap);


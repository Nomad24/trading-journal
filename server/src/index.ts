import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { router as authRouter } from './routes/authRoutes';
import { router as healthRouter } from './routes/healthRoutes';
import { router as tradesRouter } from './routes/tradeRoutes';
import { router as accountsRouter } from './routes/accountRoutes';
import { router as analyticsRouter } from './routes/analyticsRoutes';

const app: Application = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  })
);
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/trades', tradesRouter);
app.use('/api/v1/accounts', accountsRouter);
app.use('/api/v1/analytics', analyticsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Маршрут не найден',
    },
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API сервер запущен на порту ${PORT}`);
});


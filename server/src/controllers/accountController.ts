import { Request, Response } from 'express';
import { prisma } from '../db/client';
import { sendInternalError } from '../utils/http';

export const getAccounts = async (_req: Request, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        trades: {
          select: {
            status: true,
            pnl: true,
          },
        },
      },
    });

    const withMetrics = accounts.map((account) => {
      const closedTrades = account.trades.filter((trade) => trade.status === 'closed');
      const totalPnl = closedTrades.reduce((sum, trade) => sum + Number(trade.pnl ?? 0), 0);
      const winners = closedTrades.filter((trade) => Number(trade.pnl ?? 0) > 0).length;
      const winRate = closedTrades.length > 0 ? (winners / closedTrades.length) * 100 : 0;

      return {
        ...account,
        totalPnl,
        winRate,
      };
    });

    return res.json({
      success: true,
      data: withMetrics,
    });
  } catch (error) {
    return sendInternalError(res, 'Не удалось получить счета', error);
  }
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const { userId, name, broker, initialBalance, currency, type } = req.body;

    if (!userId || !name || !type) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Поля userId, name и type обязательны',
        },
      });
    }

    const account = await prisma.account.create({
      data: {
        userId,
        name,
        broker,
        initialBalance,
        currentBalance: initialBalance,
        currency,
        type,
      },
    });

    return res.status(201).json({
      success: true,
      data: account,
    });
  } catch (error) {
    return sendInternalError(res, 'Не удалось создать счет', error);
  }
};

export const updateAccount = async (req: Request, res: Response) => {
  try {
    const { name, broker, initialBalance, currentBalance, currency, type, isArchived } = req.body;

    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: {
        name,
        broker,
        initialBalance,
        currentBalance,
        currency,
        type,
        isArchived,
      },
    });

    return res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    return sendInternalError(res, 'Не удалось обновить счет', error);
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const existing = await prisma.account.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Счет не найден',
        },
      });
    }

    await prisma.$transaction([
      prisma.trade.deleteMany({
        where: { accountId: req.params.id },
      }),
      prisma.account.delete({
        where: { id: req.params.id },
      }),
    ]);

    return res.status(204).send();
  } catch (error) {
    return sendInternalError(res, 'Не удалось удалить счет', error);
  }
};


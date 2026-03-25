import { Request, Response } from 'express';
import { prisma } from '../db/client';
import { sendInternalError } from '../utils/http';

const parsePagination = (req: Request) => {
  const page = Number(req.query.page) || 1;
  const perPage = Math.min(Number(req.query.perPage) || 50, 200);
  const skip = (page - 1) * perPage;
  return { page, perPage, skip };
};

const calculatePnlValues = (
  direction: 'long' | 'short',
  entryPrice: number,
  quantity: number,
  exitPrice?: number,
  commission?: number
) => {
  if (exitPrice === undefined || Number.isNaN(exitPrice)) {
    return { pnl: undefined, pnlPercent: undefined };
  }

  const normalizedCommission = commission ?? 0;
  const grossPnl =
    direction === 'long'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
  const pnl = grossPnl - normalizedCommission;
  const notional = entryPrice * quantity;
  const pnlPercent = notional > 0 ? (pnl / notional) * 100 : 0;

  return { pnl, pnlPercent };
};

const parseTags = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return [];
};

const resolveStrategyId = async (
  userId: string,
  strategyName?: string
): Promise<string | null> => {
  const normalizedName = strategyName?.trim();
  if (!normalizedName) {
    return null;
  }

  const existing = await prisma.strategy.findFirst({
    where: {
      userId,
      name: normalizedName,
    },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.strategy.create({
    data: {
      userId,
      name: normalizedName,
    },
  });

  return created.id;
};

export const getTrades = async (req: Request, res: Response) => {
  try {
    const { page, perPage, skip } = parsePagination(req);

    const where: any = {};

    if (req.query.accountId) {
      where.accountId = String(req.query.accountId);
    }
    if (req.query.symbol) {
      where.symbol = String(req.query.symbol);
    }
    if (req.query.direction) {
      where.direction = String(req.query.direction);
    }
    if (req.query.status) {
      where.status = String(req.query.status);
    }

    const [items, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        orderBy: { entryDate: 'desc' },
        skip,
        take: perPage,
        include: {
          tags: true,
          strategy: true,
        },
      }),
      prisma.trade.count({ where }),
    ]);

    return res.json({
      success: true,
      data: items,
      meta: {
        page,
        perPage,
        total,
      },
    });
  } catch (error) {
    return sendInternalError(res, 'Не удалось получить список сделок', error);
  }
};

export const getTradeById = async (req: Request, res: Response) => {
  try {
    const trade = await prisma.trade.findUnique({
      where: { id: req.params.id },
      include: {
        tags: true,
        strategy: true,
      },
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Сделка не найдена',
        },
      });
    }

    return res.json({
      success: true,
      data: trade,
    });
  } catch (error) {
    return sendInternalError(res, 'Не удалось получить сделку', error);
  }
};

export const createTrade = async (req: Request, res: Response) => {
  try {
    const {
      accountId,
      userId,
      symbol,
      direction,
      status,
      entryDate,
      entryPrice,
      quantity,
      exitDate,
      exitPrice,
      stopLoss,
      takeProfit,
      commission,
      strategy,
      setup,
      notes,
      tags,
      emotion,
      rating,
    } = req.body;

    if (!accountId || !userId || !symbol || !direction || !status || !entryDate || !entryPrice || !quantity) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Обязательные поля: accountId, userId, symbol, direction, status, entryDate, entryPrice, quantity',
        },
      });
    }

    if (status === 'closed' && (!exitDate || exitPrice === undefined || exitPrice === null || exitPrice === '')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Для закрытой сделки обязательны exitDate и exitPrice',
        },
      });
    }

    const entryPriceNumber = Number(entryPrice);
    const quantityNumber = Number(quantity);
    const exitPriceNumber = exitPrice !== undefined ? Number(exitPrice) : undefined;
    const commissionNumber = commission !== undefined ? Number(commission) : 0;
    const parsedTags = parseTags(tags);
    const strategyId = await resolveStrategyId(userId, strategy);

    const { pnl, pnlPercent } = calculatePnlValues(
      direction,
      entryPriceNumber,
      quantityNumber,
      exitPriceNumber,
      commissionNumber
    );

    const trade = await prisma.trade.create({
      data: {
        accountId,
        userId,
        strategyId: strategyId ?? undefined,
        symbol,
        direction,
        status,
        entryDate: new Date(entryDate),
        entryPrice: entryPriceNumber,
        quantity: quantityNumber,
        exitDate: exitDate ? new Date(exitDate) : undefined,
        exitPrice: exitPriceNumber,
        stopLoss: stopLoss !== undefined ? Number(stopLoss) : undefined,
        takeProfit: takeProfit !== undefined ? Number(takeProfit) : undefined,
        commission: commissionNumber,
        pnl,
        pnlPercent,
        setup,
        notes,
        tags:
          parsedTags.length > 0
            ? {
                create: parsedTags.map((tagName) => ({ tagName })),
              }
            : undefined,
        emotion,
        rating,
      },
      include: {
        tags: true,
        strategy: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: trade,
    });
  } catch (error) {
    return sendInternalError(res, 'Не удалось создать сделку', error);
  }
};

export const updateTrade = async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      direction,
      status,
      entryDate,
      entryPrice,
      quantity,
      exitDate,
      exitPrice,
      stopLoss,
      takeProfit,
      commission,
      strategy,
      setup,
      notes,
      tags,
      emotion,
      rating,
    } = req.body;

    const existing = await prisma.trade.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Сделка не найдена',
        },
      });
    }

    const nextDirection = direction ?? existing.direction;
    const nextStatus = status ?? existing.status;
    const nextEntryPrice =
      entryPrice !== undefined ? Number(entryPrice) : Number(existing.entryPrice);
    const nextQuantity =
      quantity !== undefined ? Number(quantity) : Number(existing.quantity);
    const nextExitPrice =
      exitPrice !== undefined
        ? Number(exitPrice)
        : existing.exitPrice !== null
          ? Number(existing.exitPrice)
          : undefined;
    const nextExitDate =
      exitDate !== undefined
        ? exitDate
          ? new Date(exitDate)
          : null
        : existing.exitDate;
    const nextCommission =
      commission !== undefined
        ? Number(commission)
        : existing.commission !== null
          ? Number(existing.commission)
          : 0;
    const nextUserId = existing.userId;
    const nextStrategyId =
      strategy !== undefined
        ? await resolveStrategyId(nextUserId, strategy)
        : existing.strategyId;
    const parsedTags = tags !== undefined ? parseTags(tags) : null;

    if (
      nextStatus === 'closed' &&
      (!nextExitDate || nextExitPrice === undefined || Number.isNaN(nextExitPrice))
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Для закрытой сделки обязательны exitDate и exitPrice',
        },
      });
    }

    const { pnl, pnlPercent } = calculatePnlValues(
      nextDirection,
      nextEntryPrice,
      nextQuantity,
      nextExitPrice,
      nextCommission
    );

    const trade = await prisma.trade.update({
      where: { id: req.params.id },
      data: {
        symbol,
        direction,
        status,
        entryDate: entryDate ? new Date(entryDate) : undefined,
        entryPrice: entryPrice !== undefined ? Number(entryPrice) : undefined,
        quantity: quantity !== undefined ? Number(quantity) : undefined,
        exitDate: exitDate !== undefined ? (exitDate ? new Date(exitDate) : null) : undefined,
        exitPrice: exitPrice !== undefined ? Number(exitPrice) : undefined,
        stopLoss: stopLoss !== undefined ? Number(stopLoss) : undefined,
        takeProfit: takeProfit !== undefined ? Number(takeProfit) : undefined,
        commission: commission !== undefined ? Number(commission) : undefined,
        strategyId: nextStrategyId,
        pnl,
        pnlPercent,
        setup,
        notes,
        tags:
          parsedTags !== null
            ? {
                deleteMany: {},
                create: parsedTags.map((tagName) => ({ tagName })),
              }
            : undefined,
        emotion,
        rating,
      },
      include: {
        tags: true,
        strategy: true,
      },
    });

    return res.json({
      success: true,
      data: trade,
    });
  } catch (error) {
    return sendInternalError(res, 'Не удалось обновить сделку', error);
  }
};

export const deleteTrade = async (req: Request, res: Response) => {
  try {
    const existing = await prisma.trade.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Сделка не найдена',
        },
      });
    }

    await prisma.trade.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    return sendInternalError(res, 'Не удалось удалить сделку', error);
  }
};

export const getOpenTrades = async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId ? String(req.query.accountId) : undefined;

    const trades = await prisma.trade.findMany({
      where: {
        status: 'open',
        accountId: accountId || undefined,
      },
      orderBy: { entryDate: 'desc' },
      include: {
        tags: true,
        strategy: true,
      },
    });

    const now = Date.now();
    const enrichedTrades = trades.map((trade) => {
      const entryTime = trade.entryDate.getTime();
      const holdingMinutes = Math.max(Math.floor((now - entryTime) / (1000 * 60)), 0);

      const entryPrice = Number(trade.entryPrice);
      const quantity = Number(trade.quantity);
      const commission = Number(trade.commission ?? 0);
      const markPrice = trade.exitPrice !== null ? Number(trade.exitPrice) : null;

      const unrealizedPnl =
        markPrice === null
          ? null
          : trade.direction === 'long'
            ? (markPrice - entryPrice) * quantity - commission
            : (entryPrice - markPrice) * quantity - commission;

      return {
        ...trade,
        holdingMinutes,
        unrealizedPnl,
      };
    });

    return res.json({
      success: true,
      data: enrichedTrades,
    });
  } catch (error) {
    return sendInternalError(res, 'Не удалось получить открытые сделки', error);
  }
};


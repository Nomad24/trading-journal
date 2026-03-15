import { Request, Response } from 'express';
import { prisma } from '../db/client';

const applyDateRange = <T extends { entryDate: Date; exitDate: Date | null }>(
  trades: T[],
  from?: Date,
  to?: Date
) => {
  if (!from && !to) {
    return trades;
  }

  return trades.filter((trade) => {
    const pointDate = trade.exitDate ?? trade.entryDate;
    if (from && pointDate < from) {
      return false;
    }
    if (to && pointDate > to) {
      return false;
    }
    return true;
  });
};

const getDateRange = (req: Request) => {
  const fromRaw = req.query.from ? String(req.query.from) : undefined;
  const toRaw = req.query.to ? String(req.query.to) : undefined;

  return {
    from: fromRaw ? new Date(fromRaw) : undefined,
    to: toRaw ? new Date(toRaw) : undefined,
  };
};

const getClosedTrades = async (req: Request) => {
  const accountId = req.query.accountId ? String(req.query.accountId) : undefined;

  const allClosedTrades = await prisma.trade.findMany({
    where: {
      status: 'closed',
      accountId: accountId || undefined,
    },
    orderBy: { entryDate: 'asc' },
  });

  const { from, to } = getDateRange(req);
  return applyDateRange(allClosedTrades, from, to);
};

export const getAnalyticsSummary = async (req: Request, res: Response) => {
  try {
    const closedTrades = await getClosedTrades(req);
    const totalTrades = closedTrades.length;

    let totalPnl = 0;
    let winners = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let drawdownPeak = 0;
    let cumulativePnl = 0;
    let maxDrawdown = 0;

    closedTrades.forEach((t) => {
      const pnl = Number(t.pnl ?? 0);
      totalPnl += pnl;
      cumulativePnl += pnl;
      if (cumulativePnl > drawdownPeak) {
        drawdownPeak = cumulativePnl;
      }
      const drawdown = drawdownPeak - cumulativePnl;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      if (pnl > 0) {
        winners += 1;
        grossProfit += pnl;
      } else if (pnl < 0) {
        grossLoss += Math.abs(pnl);
      }
    });

    const winRate = closedTrades.length ? (winners / closedTrades.length) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

    const avgWin = winners > 0 ? grossProfit / winners : 0;
    const losers = closedTrades.length - winners;
    const avgLoss = losers > 0 ? -(grossLoss / losers) : 0;

    const riskReward = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
    const expectancy =
      totalTrades > 0
        ? (winners / totalTrades) * avgWin + (losers / totalTrades) * avgLoss
        : 0;

    return res.json({
      success: true,
      data: {
        totalPnl,
        totalTrades,
        winRate,
        profitFactor,
        avgWin,
        avgLoss,
        riskReward,
        maxDrawdown,
        expectancy,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Не удалось получить сводную аналитику',
      },
    });
  }
};

export const getEquityCurve = async (req: Request, res: Response) => {
  try {
    const trades = await getClosedTrades(req);

    let equity = 0;
    const points = trades.map((t) => {
      equity += Number(t.pnl ?? 0);
      return {
        date: (t.exitDate ?? t.entryDate).toISOString(),
        equity,
      };
    });

    return res.json({
      success: true,
      data: points,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Не удалось получить кривую капитала',
      },
    });
  }
};

export const getPnlChart = async (req: Request, res: Response) => {
  try {
    const trades = await getClosedTrades(req);

    const byDate = new Map<string, number>();

    trades.forEach((t) => {
      const key = (t.exitDate ?? t.entryDate).toISOString().slice(0, 10);
      const prev = byDate.get(key) ?? 0;
      byDate.set(key, prev + Number(t.pnl ?? 0));
    });

    const data = Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, pnl]) => ({ date, pnl }));

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Не удалось получить P&L по дням',
      },
    });
  }
};

export const getWinLoss = async (req: Request, res: Response) => {
  try {
    const trades = await getClosedTrades(req);

    let wins = 0;
    let losses = 0;
    let breakeven = 0;

    trades.forEach((trade) => {
      const pnl = Number(trade.pnl ?? 0);
      if (pnl > 0) {
        wins += 1;
      } else if (pnl < 0) {
        losses += 1;
      } else {
        breakeven += 1;
      }
    });

    return res.json({
      success: true,
      data: {
        wins,
        losses,
        breakeven,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Не удалось получить распределение Win/Loss',
      },
    });
  }
};

export const getBySymbol = async (req: Request, res: Response) => {
  try {
    const trades = await getClosedTrades(req);
    const bySymbol = new Map<
      string,
      { symbol: string; totalPnl: number; trades: number; wins: number }
    >();

    trades.forEach((trade) => {
      const symbol = trade.symbol;
      const pnl = Number(trade.pnl ?? 0);
      const current = bySymbol.get(symbol) ?? {
        symbol,
        totalPnl: 0,
        trades: 0,
        wins: 0,
      };

      current.totalPnl += pnl;
      current.trades += 1;
      if (pnl > 0) {
        current.wins += 1;
      }

      bySymbol.set(symbol, current);
    });

    const data = Array.from(bySymbol.values())
      .map((item) => ({
        ...item,
        winRate: item.trades > 0 ? (item.wins / item.trades) * 100 : 0,
      }))
      .sort((a, b) => b.totalPnl - a.totalPnl);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Не удалось получить доходность по тикерам',
      },
    });
  }
};

export const getHeatmap = async (req: Request, res: Response) => {
  try {
    const trades = await getClosedTrades(req);
    const map = new Map<string, { dayOfWeek: number; hour: number; pnl: number; trades: number }>();

    trades.forEach((trade) => {
      const pointDate = trade.exitDate ?? trade.entryDate;
      const dayOfWeek = pointDate.getUTCDay();
      const hour = pointDate.getUTCHours();
      const key = `${dayOfWeek}-${hour}`;
      const current = map.get(key) ?? {
        dayOfWeek,
        hour,
        pnl: 0,
        trades: 0,
      };

      current.pnl += Number(trade.pnl ?? 0);
      current.trades += 1;
      map.set(key, current);
    });

    return res.json({
      success: true,
      data: Array.from(map.values()).sort((a, b) =>
        a.dayOfWeek === b.dayOfWeek ? a.hour - b.hour : a.dayOfWeek - b.dayOfWeek
      ),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Не удалось получить heatmap данные',
      },
    });
  }
};


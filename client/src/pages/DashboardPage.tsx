import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../components/Skeleton';
import { api } from '../services/api';
import { useActiveAccountStore } from '../store/activeAccountStore';

type Summary = {
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  riskReward: number;
};

type Trade = {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  status: 'open' | 'closed';
  entryDate: string;
  exitDate?: string | null;
  entryPrice?: string;
  quantity?: string;
  pnl?: string;
  holdingMinutes?: number;
  unrealizedPnl?: number | null;
};

type PeriodKey = '1w' | '1m' | '3m' | '6m' | '1y' | 'all';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  '1w': '1W',
  '1m': '1M',
  '3m': '3M',
  '6m': '6M',
  '1y': '1Y',
  all: 'All',
};

const toIso = (date: Date) => date.toISOString();

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const makeRange = (from: Date | undefined, to: Date | undefined) => {
  if (!from || !to) {
    return {
      from,
      to,
      prevFrom: undefined,
      prevTo: undefined,
    };
  }

  const duration = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - duration);

  return { from, to, prevFrom, prevTo };
};

const getRangeByPeriod = (period: PeriodKey) => {
  const now = new Date();
  const periodEnd = endOfDay(now);

  if (period === '1w') {
    const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return makeRange(from, periodEnd);
  }

  if (period === '1m') {
    const from = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    return makeRange(from, periodEnd);
  }

  if (period === '3m') {
    const from = startOfDay(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000));
    return makeRange(from, periodEnd);
  }

  if (period === '6m') {
    const from = startOfDay(new Date(now.getTime() - 179 * 24 * 60 * 60 * 1000));
    return makeRange(from, periodEnd);
  }

  if (period === '1y') {
    const from = startOfDay(new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000));
    return makeRange(from, periodEnd);
  }

  return makeRange(undefined, undefined);
};

const formatTrend = (current: number, previous: number) => {
  const delta = current - previous;

  if (previous === 0) {
    if (current === 0) {
      return { arrow: '•', value: '0.0%', positive: true };
    }

    return {
      arrow: delta >= 0 ? '▲' : '▼',
      value: 'N/A',
      positive: delta >= 0,
    };
  }

  const percent = (delta / Math.abs(previous)) * 100;
  return {
    arrow: delta >= 0 ? '▲' : '▼',
    value: `${Math.abs(percent).toFixed(1)}%`,
    positive: delta >= 0,
  };
};

const formatHolding = (minutes?: number) => {
  if (minutes === undefined) {
    return '—';
  }

  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  if (days > 0) {
    return `${days}д ${hours}ч`;
  }
  if (hours > 0) {
    return `${hours}ч ${mins}м`;
  }
  return `${mins}м`;
};

const buildChartModel = (points: Array<{ date: string; equity: number }>) => {
  const width = 900;
  const height = 260;
  const padding = 24;

  if (points.length === 0) {
    return {
      width,
      height,
      padding,
      path: '',
      areaPath: '',
      firstLabel: '',
      lastLabel: '',
      baselineY: height - padding,
      points: [] as Array<{ x: number; y: number; date: string; equity: number }>,
      startEquity: 0,
      endEquity: 0,
      maxDrawdownValue: 0,
      maxDrawdownPoint: null as { x: number; y: number; date: string; equity: number } | null,
      yTicks: [] as Array<{ y: number; value: number }>,
    };
  }

  const startEquity = points[0].equity;
  const endEquity = points[points.length - 1].equity;
  const values = points.map((point) => point.equity);
  const minValue = Math.min(...values, startEquity);
  const maxValue = Math.max(...values, startEquity);
  const yRange = maxValue - minValue || 1;

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      ((point.equity - minValue) / yRange) * (height - padding * 2);
    return { x, y, date: point.date, equity: point.equity };
  });

  const path = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
    .join(' ');

  const firstPoint = coords[0];
  const lastPoint = coords[coords.length - 1];
  const areaPath = `${path} L ${lastPoint.x} ${height - padding} L ${firstPoint.x} ${height - padding} Z`;

  const baselineY =
    height -
    padding -
    ((startEquity - minValue) / yRange) * (height - padding * 2);

  let peak = points[0].equity;
  let maxDrawdownValue = 0;
  let maxDrawdownIndex = 0;

  points.forEach((point, index) => {
    if (point.equity > peak) {
      peak = point.equity;
    }
    const drawdown = peak - point.equity;
    if (drawdown > maxDrawdownValue) {
      maxDrawdownValue = drawdown;
      maxDrawdownIndex = index;
    }
  });

  const maxDrawdownPoint = coords[maxDrawdownIndex] ?? null;

  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    const value = maxValue - ratio * (maxValue - minValue);
    const y = padding + ratio * (height - padding * 2);
    return { y, value };
  });

  const firstLabel = new Date(points[0].date).toLocaleDateString();
  const lastLabel = new Date(points[points.length - 1].date).toLocaleDateString();

  return {
    width,
    height,
    padding,
    path,
    areaPath,
    firstLabel,
    lastLabel,
    baselineY,
    points: coords,
    startEquity,
    endEquity,
    maxDrawdownValue,
    maxDrawdownPoint,
    yTicks,
  };
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);

export function DashboardPage() {
  const activeAccountId = useActiveAccountStore((state) => state.activeAccountId);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<Summary | null>(null);
  const [equityCurve, setEquityCurve] = useState<Array<{ date: string; equity: number }>>([]);
  const [openTrades, setOpenTrades] = useState<Trade[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('1m');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredDrawdown, setHoveredDrawdown] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const range = getRangeByPeriod(period);
        const accountIdParam = activeAccountId !== 'all' ? activeAccountId : undefined;

        const [summaryRes, previousSummaryRes, equityRes, openRes, recentRes] = await Promise.all([
          api.get('/analytics/summary', {
            params: {
              from: range.from ? toIso(range.from) : undefined,
              to: range.to ? toIso(range.to) : undefined,
              accountId: accountIdParam,
            },
          }),
          api.get('/analytics/summary', {
            params: {
              from: range.prevFrom ? toIso(range.prevFrom) : undefined,
              to: range.prevTo ? toIso(range.prevTo) : undefined,
              accountId: accountIdParam,
            },
          }),
          api.get('/analytics/equity-curve', {
            params: {
              from: range.from ? toIso(range.from) : undefined,
              to: range.to ? toIso(range.to) : undefined,
              accountId: accountIdParam,
            },
          }),
          api.get('/trades/open', { params: { accountId: accountIdParam } }),
          api.get('/trades', {
            params: {
              page: 1,
              perPage: 5,
              accountId: accountIdParam,
            },
          }),
        ]);

        setSummary(summaryRes.data?.data ?? null);
        setPreviousSummary(previousSummaryRes.data?.data ?? null);
        setEquityCurve(
          (equityRes.data?.data ?? []).map((point: { date: string; equity: number }) => ({
            date: point.date,
            equity: Number(point.equity),
          }))
        );
        setOpenTrades(openRes.data?.data ?? []);
        setRecentTrades(recentRes.data?.data ?? []);
      } catch {
        setError('Не удалось загрузить данные дашборда');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [period, activeAccountId]);

  const totalPnlTrend =
    summary && previousSummary && period !== 'all'
      ? formatTrend(summary.totalPnl, previousSummary.totalPnl)
      : null;
  const winRateTrend =
    summary && previousSummary && period !== 'all'
      ? formatTrend(summary.winRate, previousSummary.winRate)
      : null;
  const riskRewardTrend =
    summary && previousSummary && period !== 'all'
      ? formatTrend(summary.riskReward, previousSummary.riskReward)
      : null;
  const totalTradesTrend =
    summary && previousSummary && period !== 'all'
      ? formatTrend(summary.totalTrades, previousSummary.totalTrades)
      : null;

  const chart = useMemo(() => buildChartModel(equityCurve), [equityCurve]);
  const chartLineColor = chart.endEquity >= chart.startEquity ? '#34d399' : '#fb7185';
  const hoveredPoint =
    hoveredPointIndex !== null ? chart.points[hoveredPointIndex] ?? null : null;
  const hoveredPointDelta =
    hoveredPointIndex !== null && hoveredPointIndex > 0
      ? chart.points[hoveredPointIndex].equity - chart.points[hoveredPointIndex - 1].equity
      : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Total P&L</p>
            <p
              className={`text-xl font-semibold ${
                summary.totalPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {formatMoney(summary.totalPnl)}
            </p>
            {totalPnlTrend && (
              <p
                className={`text-xs mt-1 ${
                  totalPnlTrend.positive ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {totalPnlTrend.arrow} {totalPnlTrend.value}
              </p>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Win Rate</p>
            <p
              className={`text-xl font-semibold ${
                summary.winRate >= 50 ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {summary.winRate.toFixed(1)}%
            </p>
            {winRateTrend && (
              <p
                className={`text-xs mt-1 ${
                  winRateTrend.positive ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {winRateTrend.arrow} {winRateTrend.value}
              </p>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Risk/Reward</p>
            <p className="text-xl font-semibold">{summary.riskReward.toFixed(2)}</p>
            {riskRewardTrend && (
              <p
                className={`text-xs mt-1 ${
                  riskRewardTrend.positive ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {riskRewardTrend.arrow} {riskRewardTrend.value}
              </p>
            )}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Total Trades</p>
            <p className="text-xl font-semibold">{summary.totalTrades}</p>
            {totalTradesTrend && (
              <p
                className={`text-xs mt-1 ${
                  totalTradesTrend.positive ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {totalTradesTrend.arrow} {totalTradesTrend.value}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-lg font-medium">Equity Curve</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((periodKey) => (
                <button
                  key={periodKey}
                  type="button"
                  onClick={() => setPeriod(periodKey)}
                  className={`px-2.5 py-1 rounded-md text-xs border ${
                    period === periodKey
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {PERIOD_LABELS[periodKey]}
                </button>
              ))}
            </div>
          </div>
          {equityCurve.length === 0 ? (
            <div className="text-sm text-slate-400">
              <p className="mb-2">Недостаточно закрытых сделок для построения графика.</p>
              <Link to="/trades" className="text-sky-400 hover:underline">Добавить сделку</Link>
            </div>
          ) : (
            <div className="relative">
              <svg
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                className="w-full h-56"
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const relativeX = ((event.clientX - rect.left) / rect.width) * chart.width;
                  let nearestIndex = 0;
                  let nearestDistance = Number.POSITIVE_INFINITY;

                  chart.points.forEach((point, index) => {
                    const distance = Math.abs(point.x - relativeX);
                    if (distance < nearestDistance) {
                      nearestDistance = distance;
                      nearestIndex = index;
                    }
                  });

                  setHoveredPointIndex(nearestIndex);
                }}
                onMouseLeave={() => setHoveredPointIndex(null)}
              >
                <defs>
                  <linearGradient id="equityAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.06" />
                  </linearGradient>
                  <linearGradient id="equityAreaLossGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.06" />
                  </linearGradient>
                  <clipPath id="clipAboveBaseline">
                    <rect x="0" y="0" width={chart.width} height={chart.baselineY} />
                  </clipPath>
                  <clipPath id="clipBelowBaseline">
                    <rect
                      x="0"
                      y={chart.baselineY}
                      width={chart.width}
                      height={chart.height - chart.baselineY}
                    />
                  </clipPath>
                  <clipPath id="equityRevealClip">
                    <rect x="0" y="0" width="0" height={chart.height}>
                      <animate attributeName="width" from="0" to={String(chart.width)} dur="0.8s" fill="freeze" />
                    </rect>
                  </clipPath>
                </defs>

                {chart.yTicks.map((tick, index) => (
                  <g key={`${tick.value}-${index}`}>
                    <line
                      x1={chart.padding}
                      x2={chart.width - chart.padding}
                      y1={tick.y}
                      y2={tick.y}
                      stroke="#94a3b8"
                      strokeWidth="1"
                      opacity="0.12"
                    />
                    <text
                      x={chart.width - chart.padding + 6}
                      y={tick.y + 4}
                      fontSize="11"
                      fill="#94a3b8"
                    >
                      {formatMoney(tick.value)}
                    </text>
                  </g>
                ))}

                <line
                  x1={chart.padding}
                  x2={chart.width - chart.padding}
                  y1={chart.baselineY}
                  y2={chart.baselineY}
                  stroke="#94a3b8"
                  strokeDasharray="6 6"
                  strokeWidth="1"
                  opacity="0.7"
                />

                <g clipPath="url(#equityRevealClip)">
                  <path
                    d={chart.areaPath}
                    fill="url(#equityAreaGradient)"
                    clipPath="url(#clipAboveBaseline)"
                  />
                  <path
                    d={chart.areaPath}
                    fill="url(#equityAreaLossGradient)"
                    clipPath="url(#clipBelowBaseline)"
                  />

                  {chart.points.slice(0, -1).map((point, index) => {
                    const nextPoint = chart.points[index + 1];
                    const segmentColor = nextPoint.equity >= point.equity ? '#34d399' : '#fb7185';
                    return (
                      <line
                        key={`segment-${index}`}
                        x1={point.x}
                        y1={point.y}
                        x2={nextPoint.x}
                        y2={nextPoint.y}
                        stroke={segmentColor}
                        strokeWidth="3"
                      />
                    );
                  })}
                </g>

                {chart.maxDrawdownPoint && chart.maxDrawdownValue > 0 && (
                  <>
                    <circle
                      cx={chart.maxDrawdownPoint.x}
                      cy={chart.maxDrawdownPoint.y}
                      r="8"
                      fill="rgba(244,63,94,0.18)"
                      stroke="#fb7185"
                      strokeWidth="2"
                      onMouseEnter={() => setHoveredDrawdown(true)}
                      onMouseLeave={() => setHoveredDrawdown(false)}
                    />
                    <circle
                      cx={chart.maxDrawdownPoint.x}
                      cy={chart.maxDrawdownPoint.y}
                      r="4"
                      fill="#f43f5e"
                      stroke="#111827"
                      strokeWidth="2"
                      onMouseEnter={() => setHoveredDrawdown(true)}
                      onMouseLeave={() => setHoveredDrawdown(false)}
                    />
                  </>
                )}

                {hoveredPoint && (
                  <>
                    <line
                      x1={hoveredPoint.x}
                      x2={hoveredPoint.x}
                      y1={chart.padding}
                      y2={chart.height - chart.padding}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                      opacity="0.8"
                    />
                    <circle
                      cx={hoveredPoint.x}
                      cy={hoveredPoint.y}
                      r="4"
                      fill={chartLineColor}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  </>
                )}
              </svg>

              {hoveredPoint && (
                <div
                  className="absolute z-10 rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-lg"
                  style={{
                    left: `${Math.max(
                      8,
                      Math.min((hoveredPoint.x / chart.width) * 100, 84)
                    )}%`,
                    top: '8px',
                  }}
                >
                  <p className="text-slate-300">{new Date(hoveredPoint.date).toLocaleString()}</p>
                  <p className="font-semibold">Equity: {formatMoney(hoveredPoint.equity)}</p>
                  <p className={
                    hoveredPointDelta === null
                      ? 'text-slate-400'
                      : hoveredPointDelta >= 0
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                  }>
                    Δ day: {hoveredPointDelta === null ? '—' : formatMoney(hoveredPointDelta)}
                  </p>
                </div>
              )}

              {hoveredDrawdown && chart.maxDrawdownPoint && (
                <div
                  className="absolute z-10 rounded-md border border-rose-700 bg-slate-900/95 px-3 py-2 text-xs shadow-lg"
                  style={{
                    left: `${Math.max(
                      8,
                      Math.min((chart.maxDrawdownPoint.x / chart.width) * 100, 82)
                    )}%`,
                    top: `${Math.max((chart.maxDrawdownPoint.y / chart.height) * 100 - 18, 8)}%`,
                  }}
                >
                  <p className="text-rose-300">Max Drawdown</p>
                  <p className="font-semibold">-{formatMoney(chart.maxDrawdownValue)}</p>
                  <p className="text-slate-400">{new Date(chart.maxDrawdownPoint.date).toLocaleDateString()}</p>
                </div>
              )}

              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{chart.firstLabel}</span>
                <span>{chart.lastLabel}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-medium mb-3">Последние 5 сделок</h2>
          {recentTrades.length === 0 ? (
            <div className="text-sm text-slate-400">
              <p className="mb-2">Сделок пока нет.</p>
              <Link to="/trades" className="text-sky-400 hover:underline">Перейти в журнал сделок</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="rounded-md border border-slate-800 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{trade.symbol}</span>
                    <span
                      className={`text-sm ${
                        Number(trade.pnl ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {trade.pnl !== undefined && trade.pnl !== null
                        ? Number(trade.pnl).toFixed(2)
                        : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(trade.entryDate).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-medium mb-3">Открытые позиции</h2>
          {openTrades.length === 0 ? (
            <div className="text-sm text-slate-400">
              <p className="mb-2">Открытых позиций нет.</p>
              <Link to="/trades" className="text-sky-400 hover:underline">Добавить открытую позицию</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {openTrades.slice(0, 9).map((trade) => (
                <div
                  key={trade.id}
                  className="rounded-md border border-slate-800 px-3 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{trade.symbol}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        trade.direction === 'long'
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : 'bg-rose-900/60 text-rose-300'
                      }`}
                    >
                      {trade.direction === 'long' ? 'Long' : 'Short'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Вход: {new Date(trade.entryDate).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Удержание: {formatHolding(trade.holdingMinutes)}
                  </p>
                  <p
                    className={`text-sm mt-2 ${
                      (trade.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    Unrealized P&L:{' '}
                    {trade.unrealizedPnl === null || trade.unrealizedPnl === undefined
                      ? '—'
                      : trade.unrealizedPnl.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


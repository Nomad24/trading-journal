import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../components/Skeleton';
import { api } from '../services/api';
import { useActiveAccountStore } from '../store/activeAccountStore';

type Summary = {
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number | null;
  avgWin: number;
  avgLoss: number;
  riskReward: number;
  maxDrawdown: number;
  expectancy: number;
};

type EquityPoint = {
  date: string;
  equity: number;
};

type PnlPoint = {
  date: string;
  pnl: number;
};

type WinLoss = {
  wins: number;
  losses: number;
  breakeven: number;
};

type SymbolStat = {
  symbol: string;
  totalPnl: number;
  trades: number;
  wins: number;
  winRate: number;
};

type HeatmapPoint = {
  dayOfWeek: number;
  hour: number;
  pnl: number;
  trades: number;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const formatMoney = (value: number) => currencyFormatter.format(value);

const buildLineChartModel = (points: EquityPoint[]) => {
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
      points: [] as Array<{ x: number; y: number; date: string; equity: number }>,
      startEquity: 0,
      endEquity: 0,
    };
  }

  const startEquity = points[0].equity;
  const endEquity = points[points.length - 1].equity;
  const values = points.map((point) => point.equity);
  const minValue = Math.min(...values, startEquity);
  const maxValue = Math.max(...values, startEquity);
  const range = maxValue - minValue || 1;

  const chartPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y =
      height -
      padding -
      ((point.equity - minValue) / range) * (height - padding * 2);
    return { x, y, date: point.date, equity: point.equity };
  });

  const path = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const first = chartPoints[0];
  const last = chartPoints[chartPoints.length - 1];
  const areaPath = `${path} L ${last.x} ${height - padding} L ${first.x} ${height - padding} Z`;

  return {
    width,
    height,
    padding,
    path,
    areaPath,
    points: chartPoints,
    startEquity,
    endEquity,
  };
};

const toLocalHeatmap = (points: HeatmapPoint[]) => {
  const offsetHours = new Date().getTimezoneOffset() / 60;
  const map = new Map<string, HeatmapPoint>();

  points.forEach((point) => {
    let localHour = point.hour - offsetHours;
    let dayOfWeek = point.dayOfWeek;

    while (localHour < 0) {
      localHour += 24;
      dayOfWeek = (dayOfWeek + 6) % 7;
    }

    while (localHour >= 24) {
      localHour -= 24;
      dayOfWeek = (dayOfWeek + 1) % 7;
    }

    const normalizedHour = Math.floor(localHour);
    const key = `${dayOfWeek}-${normalizedHour}`;
    const current = map.get(key) ?? {
      dayOfWeek,
      hour: normalizedHour,
      pnl: 0,
      trades: 0,
    };

    current.pnl += point.pnl;
    current.trades += point.trades;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) =>
    a.dayOfWeek === b.dayOfWeek ? a.hour - b.hour : a.dayOfWeek - b.dayOfWeek
  );
};

export function AnalyticsPage() {
  const activeAccountId = useActiveAccountStore((state) => state.activeAccountId);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [pnlChart, setPnlChart] = useState<PnlPoint[]>([]);
  const [winLoss, setWinLoss] = useState<WinLoss | null>(null);
  const [bySymbol, setBySymbol] = useState<SymbolStat[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [equityHoverIndex, setEquityHoverIndex] = useState<number | null>(null);
  const [pnlHoverIndex, setPnlHoverIndex] = useState<number | null>(null);
  const [heatmapHover, setHeatmapHover] = useState<
    { x: number; y: number; dayOfWeek: number; hour: number; pnl: number; trades: number } | null
  >(null);
  const [heatmapMode, setHeatmapMode] = useState<'utc' | 'local'>('utc');
  const [symbolSortKey, setSymbolSortKey] = useState<'trades' | 'winRate' | 'totalPnl'>('totalPnl');
  const [symbolSortOrder, setSymbolSortOrder] = useState<'asc' | 'desc'>('desc');

  const getParams = () => ({
    from: from || undefined,
    to: to || undefined,
    accountId: activeAccountId !== 'all' ? activeAccountId : undefined,
  });

  const totalWinLoss =
    (winLoss?.wins ?? 0) + (winLoss?.losses ?? 0) + (winLoss?.breakeven ?? 0);
  const winsPercent = totalWinLoss > 0 ? ((winLoss?.wins ?? 0) / totalWinLoss) * 100 : 0;
  const lossesPercent = totalWinLoss > 0 ? ((winLoss?.losses ?? 0) / totalWinLoss) * 100 : 0;
  const breakevenPercent = totalWinLoss > 0 ? ((winLoss?.breakeven ?? 0) / totalWinLoss) * 100 : 0;

  const displayHeatmap = useMemo(
    () => (heatmapMode === 'utc' ? heatmap : toLocalHeatmap(heatmap)),
    [heatmap, heatmapMode]
  );

  const maxAbsHeatmap = displayHeatmap.reduce((max, item) => {
    const abs = Math.abs(item.pnl);
    return abs > max ? abs : max;
  }, 0);

  const lineChart = useMemo(() => buildLineChartModel(equity), [equity]);
  const lineColor = lineChart.endEquity >= lineChart.startEquity ? '#34d399' : '#fb7185';
  const hoveredLinePoint =
    equityHoverIndex !== null ? lineChart.points[equityHoverIndex] ?? null : null;

  const maxAbsPnl = pnlChart.reduce((max, item) => {
    const abs = Math.abs(item.pnl);
    return abs > max ? abs : max;
  }, 0);

  const sortedSymbols = useMemo(() => {
    const direction = symbolSortOrder === 'asc' ? 1 : -1;
    return [...bySymbol].sort((a, b) => {
      if (symbolSortKey === 'trades') {
        return (a.trades - b.trades) * direction;
      }
      if (symbolSortKey === 'winRate') {
        return (a.winRate - b.winRate) * direction;
      }
      return (a.totalPnl - b.totalPnl) * direction;
    });
  }, [bySymbol, symbolSortKey, symbolSortOrder]);

  const symbolTotals = useMemo(() => {
    const trades = bySymbol.reduce((sum, item) => sum + item.trades, 0);
    const wins = bySymbol.reduce((sum, item) => sum + item.wins, 0);
    const totalPnl = bySymbol.reduce((sum, item) => sum + item.totalPnl, 0);
    return {
      trades,
      wins,
      totalPnl,
      winRate: trades > 0 ? (wins / trades) * 100 : 0,
    };
  }, [bySymbol]);

  const maxAbsSymbolPnl = bySymbol.reduce((max, item) => {
    const abs = Math.abs(item.totalPnl);
    return abs > max ? abs : max;
  }, 0);

  const handleSortSymbols = (key: 'trades' | 'winRate' | 'totalPnl') => {
    if (symbolSortKey === key) {
      setSymbolSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSymbolSortKey(key);
    setSymbolSortOrder('desc');
  };

  const getHeatmapCell = (dayOfWeek: number, hour: number) => {
    const point = displayHeatmap.find((item) => item.dayOfWeek === dayOfWeek && item.hour === hour);
    if (!point) {
      return { intensity: 0, pnl: 0, trades: 0 };
    }

    const intensity = maxAbsHeatmap > 0 ? Math.abs(point.pnl) / maxAbsHeatmap : 0;
    return { intensity, pnl: point.pnl, trades: point.trades };
  };

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = getParams();

      const [summaryRes, equityRes, pnlRes, winLossRes, bySymbolRes, heatmapRes] = await Promise.all([
        api.get('/analytics/summary', { params }),
        api.get('/analytics/equity-curve', { params }),
        api.get('/analytics/pnl-chart', { params }),
        api.get('/analytics/win-loss', { params }),
        api.get('/analytics/by-symbol', { params }),
        api.get('/analytics/heatmap', { params }),
      ]);

      setSummary(summaryRes.data.data ?? null);
      setEquity(
        (equityRes.data.data ?? []).map((p: any) => ({
          date: p.date,
          equity: p.equity,
        }))
      );
      setPnlChart(
        (pnlRes.data.data ?? []).map((p: any) => ({
          date: p.date,
          pnl: Number(p.pnl),
        }))
      );
      setWinLoss(winLossRes.data.data ?? null);
      setBySymbol(bySymbolRes.data.data ?? []);
      setHeatmap(
        (heatmapRes.data.data ?? []).map((item: any) => ({
          dayOfWeek: Number(item.dayOfWeek),
          hour: Number(item.hour),
          pnl: Number(item.pnl),
          trades: Number(item.trades),
        }))
      );
    } catch {
      setError('Не удалось загрузить аналитику');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [from, to, activeAccountId]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Аналитика</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Период от</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Период до</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Total P&L</p>
            <p className="text-xl font-semibold">{formatMoney(summary.totalPnl)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Win Rate</p>
            <p className="text-xl font-semibold">
              {summary.winRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Profit Factor</p>
            <p className="text-xl font-semibold" title="N/A показывается, когда нет убыточных сделок и деление на 0 невозможно">
              {summary.profitFactor === null ? 'N/A' : summary.profitFactor.toFixed(2)}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Max Drawdown</p>
            <p className="text-xl font-semibold text-rose-300">-{formatMoney(summary.maxDrawdown)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Avg Win / Avg Loss</p>
            <p className="text-xl font-semibold">{formatMoney(summary.avgWin)} / {formatMoney(summary.avgLoss)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Expectancy</p>
            <p className={`text-xl font-semibold ${summary.expectancy >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatMoney(summary.expectancy)}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-1">Risk/Reward</p>
            <p className="text-xl font-semibold">{summary.riskReward.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm font-medium mb-2">Equity Curve</p>
          {equity.length === 0 ? (
            <p className="text-sm text-slate-400">Нет данных. <Link to="/trades" className="text-sky-400 hover:underline">Добавить сделки</Link></p>
          ) : (
            <div className="relative">
              <svg
                viewBox={`0 0 ${lineChart.width} ${lineChart.height}`}
                className="w-full h-56"
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = ((event.clientX - rect.left) / rect.width) * lineChart.width;
                  let nearestIndex = 0;
                  let nearestDistance = Number.POSITIVE_INFINITY;
                  lineChart.points.forEach((point, index) => {
                    const distance = Math.abs(point.x - x);
                    if (distance < nearestDistance) {
                      nearestDistance = distance;
                      nearestIndex = index;
                    }
                  });
                  setEquityHoverIndex(nearestIndex);
                }}
                onMouseLeave={() => setEquityHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="analyticsEquityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.08" />
                  </linearGradient>
                </defs>
                <path d={lineChart.areaPath} fill="url(#analyticsEquityGradient)" />
                <path d={lineChart.path} fill="none" stroke={lineColor} strokeWidth="3" />
                {hoveredLinePoint && (
                  <>
                    <line
                      x1={hoveredLinePoint.x}
                      x2={hoveredLinePoint.x}
                      y1={lineChart.padding}
                      y2={lineChart.height - lineChart.padding}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <circle
                      cx={hoveredLinePoint.x}
                      cy={hoveredLinePoint.y}
                      r="4"
                      fill={lineColor}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  </>
                )}
              </svg>

              {hoveredLinePoint && (
                <div
                  className="absolute rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs"
                  style={{
                    left: `${Math.max(
                      8,
                      Math.min((hoveredLinePoint.x / lineChart.width) * 100, 82)
                    )}%`,
                    top: '8px',
                  }}
                >
                  <p>{new Date(hoveredLinePoint.date).toLocaleString()}</p>
                  <p className="font-semibold">{formatMoney(hoveredLinePoint.equity)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm font-medium mb-2">Win / Loss Pie</p>
          {totalWinLoss === 0 ? (
            <p className="text-sm text-slate-400">Нет закрытых сделок</p>
          ) : (
            <div>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 120 120" className="w-32 h-32">
                  <circle cx="60" cy="60" r="42" fill="none" stroke="#1e293b" strokeWidth="18" />
                  {(() => {
                    const r = 42;
                    const c = 2 * Math.PI * r;
                    const segments = [
                      { value: winLoss?.wins ?? 0, color: '#10b981' },
                      { value: winLoss?.losses ?? 0, color: '#f43f5e' },
                      { value: winLoss?.breakeven ?? 0, color: '#64748b' },
                    ];
                    let offset = 0;

                    return segments.map((segment, index) => {
                      const ratio = totalWinLoss > 0 ? segment.value / totalWinLoss : 0;
                      const dash = ratio * c;
                      const node = (
                        <circle
                          key={index}
                          cx="60"
                          cy="60"
                          r={r}
                          fill="none"
                          stroke={segment.color}
                          strokeWidth="18"
                          strokeDasharray={`${dash} ${c - dash}`}
                          strokeDashoffset={-offset}
                          transform="rotate(-90 60 60)"
                        />
                      );
                      offset += dash;
                      return node;
                    });
                  })()}
                  <circle cx="60" cy="60" r="28" fill="#0f172a" />
                </svg>

                <div className="text-sm text-slate-300 space-y-1">
                  <p><span className="text-emerald-300">Wins:</span> {winLoss?.wins ?? 0} ({winsPercent.toFixed(1)}%)</p>
                  <p><span className="text-rose-300">Losses:</span> {winLoss?.losses ?? 0} ({lossesPercent.toFixed(1)}%)</p>
                  <p><span className="text-slate-300">Breakeven:</span> {winLoss?.breakeven ?? 0} ({breakevenPercent.toFixed(1)}%)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mt-4">
          <p className="text-sm font-medium mb-2">P&L по дням</p>
          {pnlChart.length === 0 ? (
            <p className="text-sm text-slate-400">Нет данных</p>
          ) : (
            <div className="relative">
              <svg viewBox="0 0 900 280" className="w-full h-64">
                <line x1="40" x2="860" y1="140" y2="140" stroke="#334155" strokeWidth="1" />
                {pnlChart.map((point, index) => {
                  const barWidth = 820 / pnlChart.length;
                  const x = 40 + index * barWidth + 2;
                  const normalized = maxAbsPnl > 0 ? Math.abs(point.pnl) / maxAbsPnl : 0;
                  const height = normalized * 110;
                  const y = point.pnl >= 0 ? 140 - height : 140;

                  return (
                    <rect
                      key={point.date}
                      x={x}
                      y={y}
                      width={Math.max(barWidth - 4, 2)}
                      height={height}
                      fill={point.pnl >= 0 ? '#10b981' : '#f43f5e'}
                      opacity={pnlHoverIndex === index ? 1 : 0.8}
                      onMouseEnter={() => setPnlHoverIndex(index)}
                      onMouseLeave={() => setPnlHoverIndex(null)}
                    />
                  );
                })}
              </svg>

              {pnlHoverIndex !== null && pnlChart[pnlHoverIndex] && (
                <div className="absolute top-2 right-2 rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs">
                  <p>{pnlChart[pnlHoverIndex].date}</p>
                  <p className={pnlChart[pnlHoverIndex].pnl >= 0 ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
                    {formatMoney(pnlChart[pnlHoverIndex].pnl)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mt-4">
        <p className="text-sm font-medium mb-2">Доходность по тикерам</p>
        {bySymbol.length === 0 ? (
          <p className="text-sm text-slate-400">Нет данных. <Link to="/trades" className="text-sky-400 hover:underline">Добавить сделки</Link></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left py-2">Ticker</th>
                  <th className="text-right py-2 cursor-pointer" onClick={() => handleSortSymbols('trades')}>Trades</th>
                  <th className="text-right py-2 cursor-pointer" onClick={() => handleSortSymbols('winRate')}>Win Rate</th>
                  <th className="text-right py-2 cursor-pointer" onClick={() => handleSortSymbols('totalPnl')}>Total P&L</th>
                </tr>
              </thead>
              <tbody>
                {sortedSymbols.map((item) => (
                  <tr key={item.symbol} className="border-t border-slate-800/60">
                    <td className="py-2">{item.symbol}</td>
                    <td className="py-2 text-right">{item.trades}</td>
                    <td className="py-2 text-right">{item.winRate.toFixed(1)}%</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`h-2 w-2 rounded-full ${item.totalPnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className={item.totalPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                          {formatMoney(item.totalPnl)}
                        </span>
                      </div>
                      <div className="mt-1 ml-auto h-1.5 w-24 rounded bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${item.totalPnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{
                            width: `${maxAbsSymbolPnl > 0 ? (Math.abs(item.totalPnl) / maxAbsSymbolPnl) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 font-semibold">
                  <td className="py-2">Итого</td>
                  <td className="py-2 text-right">{symbolTotals.trades}</td>
                  <td className="py-2 text-right">{symbolTotals.winRate.toFixed(1)}%</td>
                  <td className={`py-2 text-right ${symbolTotals.totalPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {formatMoney(symbolTotals.totalPnl)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mt-4">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <p className="text-sm font-medium">Heatmap (день недели × час)</p>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setHeatmapMode('utc')}
              className={`px-2 py-1 rounded border ${heatmapMode === 'utc' ? 'bg-sky-600 border-sky-500' : 'bg-slate-800 border-slate-700'}`}
            >
              UTC
            </button>
            <button
              type="button"
              onClick={() => setHeatmapMode('local')}
              className={`px-2 py-1 rounded border ${heatmapMode === 'local' ? 'bg-sky-600 border-sky-500' : 'bg-slate-800 border-slate-700'}`}
            >
              Local
            </button>
          </div>
        </div>

        <div className="mb-3">
          <div className="h-2 w-full rounded bg-gradient-to-r from-rose-500 via-slate-500 to-emerald-500" />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>-{formatMoney(maxAbsHeatmap)}</span>
            <span>0</span>
            <span>+{formatMoney(maxAbsHeatmap)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs border-collapse relative">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-slate-400">Day</th>
                {[0, 4, 8, 12, 16, 20].map((hour) => (
                  <th key={hour} className="px-2 py-1 text-slate-400">{hour}:00</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((dayLabel, dayIndex) => (
                <tr key={dayLabel}>
                  <td className="px-2 py-1 text-slate-300">{dayLabel}</td>
                  {[0, 4, 8, 12, 16, 20].map((hour) => {
                    const cell = getHeatmapCell(dayIndex, hour);
                    const alpha = Math.min(0.15 + cell.intensity * 0.85, 1);
                    const bg =
                      cell.pnl > 0
                        ? `rgba(16, 185, 129, ${alpha})`
                        : cell.pnl < 0
                          ? `rgba(244, 63, 94, ${alpha})`
                          : 'rgba(51, 65, 85, 0.5)';

                    return (
                      <td
                        key={`${dayIndex}-${hour}`}
                        className="px-2 py-1 text-right"
                        style={{ background: bg }}
                        onMouseEnter={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setHeatmapHover({
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                            dayOfWeek: dayIndex,
                            hour,
                            pnl: cell.pnl,
                            trades: cell.trades,
                          });
                        }}
                        onMouseLeave={() => setHeatmapHover(null)}
                      >
                        {cell.trades > 0 ? cell.pnl.toFixed(0) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {heatmapHover && (
          <div
            className="fixed z-30 rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs pointer-events-none"
            style={{ left: `${heatmapHover.x + 8}px`, top: `${heatmapHover.y - 8}px` }}
          >
            <p>{DAYS[heatmapHover.dayOfWeek]} {heatmapHover.hour}:00 ({heatmapMode.toUpperCase()})</p>
            <p>PnL: {formatMoney(heatmapHover.pnl)}</p>
            <p>Trades: {heatmapHover.trades}</p>
          </div>
        )}
      </div>
    </div>
  );
}


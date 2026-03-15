import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../services/api';

type TradeDetails = {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  status: 'open' | 'closed';
  entryDate: string;
  exitDate?: string | null;
  entryPrice: string;
  exitPrice?: string | null;
  quantity: string;
  stopLoss?: string | null;
  takeProfit?: string | null;
  commission?: string | null;
  pnl?: string | null;
  setup?: string | null;
  notes?: string | null;
  strategy?: { id: string; name: string } | null;
  tags?: Array<{ id: string; tagName: string }>;
};

export function TradeDetailsPage() {
  const { id } = useParams();
  const [trade, setTrade] = useState<TradeDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('ID сделки не найден');
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/trades/${id}`);
        setTrade(response.data?.data ?? null);
      } catch {
        setError('Не удалось загрузить сделку');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  return (
    <div>
      <div className="mb-4">
        <Link to="/trades" className="text-sm text-sky-400 hover:underline">
          ← Назад к журналу сделок
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-400">Загрузка...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {trade && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <h1 className="text-2xl font-semibold">{trade.symbol}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <p>
              <span className="text-slate-400">Direction:</span> {trade.direction}
            </p>
            <p>
              <span className="text-slate-400">Status:</span> {trade.status}
            </p>
            <p>
              <span className="text-slate-400">Entry Date:</span>{' '}
              {new Date(trade.entryDate).toLocaleString()}
            </p>
            <p>
              <span className="text-slate-400">Exit Date:</span>{' '}
              {trade.exitDate ? new Date(trade.exitDate).toLocaleString() : '—'}
            </p>
            <p>
              <span className="text-slate-400">Entry Price:</span> {Number(trade.entryPrice).toFixed(4)}
            </p>
            <p>
              <span className="text-slate-400">Exit Price:</span>{' '}
              {trade.exitPrice ? Number(trade.exitPrice).toFixed(4) : '—'}
            </p>
            <p>
              <span className="text-slate-400">Quantity:</span> {Number(trade.quantity).toFixed(4)}
            </p>
            <p>
              <span className="text-slate-400">Commission:</span>{' '}
              {trade.commission ? Number(trade.commission).toFixed(4) : '0.0000'}
            </p>
            <p>
              <span className="text-slate-400">Stop Loss:</span>{' '}
              {trade.stopLoss ? Number(trade.stopLoss).toFixed(4) : '—'}
            </p>
            <p>
              <span className="text-slate-400">Take Profit:</span>{' '}
              {trade.takeProfit ? Number(trade.takeProfit).toFixed(4) : '—'}
            </p>
            <p>
              <span className="text-slate-400">Strategy:</span> {trade.strategy?.name ?? '—'}
            </p>
            <p>
              <span className="text-slate-400">Setup:</span> {trade.setup ?? '—'}
            </p>
            <p>
              <span className="text-slate-400">P&L:</span>{' '}
              <span className={Number(trade.pnl ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {trade.pnl ? Number(trade.pnl).toFixed(2) : '—'}
              </span>
            </p>
          </div>

          <div>
            <p className="text-slate-400 text-sm mb-1">Tags</p>
            {(trade.tags ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(trade.tags ?? []).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-200"
                  >
                    {tag.tagName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm">—</p>
            )}
          </div>

          <div>
            <p className="text-slate-400 text-sm mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{trade.notes ?? '—'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

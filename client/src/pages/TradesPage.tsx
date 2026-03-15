import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/ToastProvider';
import { api } from '../services/api';
import { useActiveAccountStore } from '../store/activeAccountStore';
import { useAuthStore } from '../store/authStore';

type Trade = {
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
  strategy?: { id: string; name: string } | null;
  setup?: string | null;
  notes?: string | null;
  tags?: Array<{ id: string; tagName: string }>;
  pnl?: string;
};

type AccountOption = {
  id: string;
  name: string;
};

export function TradesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const activeAccountId = useActiveAccountStore((state) => state.activeAccountId);
  const user = useAuthStore((state) => state.user);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [sortKey, setSortKey] = useState<'symbol' | 'entryDate' | 'entryPrice' | 'quantity' | 'pnl'>('entryDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [filterStatus, setFilterStatus] = useState('');
  const [filterSymbol, setFilterSymbol] = useState('');

  const [accountId, setAccountId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [entryDate, setEntryDate] = useState('');
  const [exitDate, setExitDate] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [strategy, setStrategy] = useState('');
  const [setup, setSetup] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [commission, setCommission] = useState('0');

  const resetForm = () => {
    setEditingId(null);
    setSymbol('');
    setDirection('long');
    setStatus('open');
    setEntryDate('');
    setExitDate('');
    setEntryPrice('');
    setQuantity('');
    setExitPrice('');
    setStopLoss('');
    setTakeProfit('');
    setStrategy('');
    setSetup('');
    setNotes('');
    setTags('');
    setCommission('0');
    setFieldErrors({});

    if (activeAccountId !== 'all') {
      setAccountId(activeAccountId);
    }
  };

  const validateTradeForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!accountId) {
      nextErrors.accountId = 'Выберите счёт';
    }
    if (!symbol.trim()) {
      nextErrors.symbol = 'Тикер обязателен';
    }
    if (!entryDate) {
      nextErrors.entryDate = 'Дата входа обязательна';
    }
    if (!entryPrice || Number(entryPrice) <= 0) {
      nextErrors.entryPrice = 'Цена входа должна быть больше 0';
    }
    if (!quantity || Number(quantity) <= 0) {
      nextErrors.quantity = 'Количество должно быть больше 0';
    }

    if (status === 'closed') {
      if (!exitDate) {
        nextErrors.exitDate = 'Для закрытой сделки нужна дата выхода';
      }
      if (!exitPrice || Number(exitPrice) <= 0) {
        nextErrors.exitPrice = 'Для закрытой сделки нужна цена выхода > 0';
      }
      if (entryDate && exitDate && new Date(entryDate) > new Date(exitDate)) {
        nextErrors.exitDate = 'Дата входа не может быть позже даты выхода';
      }
    }

    if (stopLoss && Number(stopLoss) <= 0) {
      nextErrors.stopLoss = 'Stop Loss должен быть больше 0';
    }
    if (takeProfit && Number(takeProfit) <= 0) {
      nextErrors.takeProfit = 'Take Profit должен быть больше 0';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const loadTrades = async () => {
    setLoading(true);
    setError(null);
    try {
      const accountIdParam = activeAccountId !== 'all' ? activeAccountId : undefined;
      const res = await api.get('/trades', {
        params: {
          accountId: accountIdParam,
          status: filterStatus || undefined,
          symbol: filterSymbol || undefined,
          page,
          perPage,
        },
      });
      setTrades(res.data.data ?? []);
      setTotal(res.data?.meta?.total ?? 0);
    } catch {
      setError('Не удалось загрузить сделки');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get('/accounts');
      const items: AccountOption[] = (res.data.data ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
      }));
      setAccounts(items);
      if (activeAccountId !== 'all') {
        setAccountId(activeAccountId);
      } else if (items.length > 0 && !accountId) {
        setAccountId(items[0].id);
      }
    } catch {
      setError('Не удалось загрузить счета для формы сделок');
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [activeAccountId]);

  useEffect(() => {
    setPage(1);
  }, [activeAccountId]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterSymbol]);

  useEffect(() => {
    loadTrades();
  }, [filterStatus, filterSymbol, page, perPage, activeAccountId]);

  const handleSort = (key: 'symbol' | 'entryDate' | 'entryPrice' | 'quantity' | 'pnl') => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortOrder('asc');
  };

  const sortedTrades = [...trades].sort((a, b) => {
    const direction = sortOrder === 'asc' ? 1 : -1;

    if (sortKey === 'symbol') {
      return a.symbol.localeCompare(b.symbol) * direction;
    }

    if (sortKey === 'entryDate') {
      return (new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()) * direction;
    }

    if (sortKey === 'entryPrice') {
      return (Number(a.entryPrice) - Number(b.entryPrice)) * direction;
    }

    if (sortKey === 'quantity') {
      return (Number(a.quantity) - Number(b.quantity)) * direction;
    }

    return (Number(a.pnl ?? 0) - Number(b.pnl ?? 0)) * direction;
  });

  const handleCreateTrade = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) {
      setError('Сессия не найдена. Выполните вход заново');
      showToast('Сессия не найдена. Выполните вход заново', 'error');
      return;
    }

    if (!validateTradeForm()) {
      showToast('Проверьте заполнение формы сделки', 'error');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        accountId,
        userId: user.id,
        symbol,
        direction,
        status,
        entryDate,
        exitDate: status === 'closed' && exitDate ? exitDate : undefined,
        entryPrice: Number(entryPrice),
        quantity: Number(quantity),
        exitPrice: status === 'closed' && exitPrice ? Number(exitPrice) : undefined,
        stopLoss: stopLoss ? Number(stopLoss) : undefined,
        takeProfit: takeProfit ? Number(takeProfit) : undefined,
        strategy: strategy || undefined,
        setup: setup || undefined,
        notes: notes || undefined,
        tags,
        commission: commission ? Number(commission) : 0,
      };

      if (editingId) {
        await api.put(`/trades/${editingId}`, payload);
        showToast('Сделка обновлена', 'success');
      } else {
        await api.post('/trades', payload);
        showToast('Сделка добавлена', 'success');
      }

      resetForm();
      await loadTrades();
    } catch {
      setError(editingId ? 'Не удалось обновить сделку' : 'Не удалось создать сделку');
      showToast(editingId ? 'Не удалось обновить сделку' : 'Не удалось создать сделку', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (trade: Trade) => {
    setEditingId(trade.id);
    setSymbol(trade.symbol);
    setDirection(trade.direction);
    setStatus(trade.status);
    setEntryDate(new Date(trade.entryDate).toISOString().slice(0, 16));
    setExitDate(trade.exitDate ? new Date(trade.exitDate).toISOString().slice(0, 16) : '');
    setEntryPrice(String(trade.entryPrice ?? ''));
    setQuantity(String(trade.quantity ?? ''));
    setExitPrice(trade.exitPrice ? String(trade.exitPrice) : '');
    setStopLoss(trade.stopLoss ? String(trade.stopLoss) : '');
    setTakeProfit(trade.takeProfit ? String(trade.takeProfit) : '');
    setStrategy(trade.strategy?.name ?? '');
    setSetup(trade.setup ?? '');
    setNotes(trade.notes ?? '');
    setTags((trade.tags ?? []).map((item) => item.tagName).join(', '));
    setCommission('0');
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (tradeId: string) => {
    const confirmed = window.confirm('Удалить сделку?');
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/trades/${tradeId}`);
      if (editingId === tradeId) {
        resetForm();
      }
      await loadTrades();
      showToast('Сделка удалена', 'success');
    } catch {
      setError('Не удалось удалить сделку');
      showToast('Не удалось удалить сделку', 'error');
    }
  };

  const totalPages = Math.max(Math.ceil(total / perPage), 1);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Журнал сделок</h1>

      <form
        onSubmit={handleCreateTrade}
        className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3"
      >
        <div>
          <label className="block text-xs text-slate-400 mb-1">Счёт</label>
          <select
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setFieldErrors((prev) => ({ ...prev, accountId: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            required
          >
            {accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {fieldErrors.accountId && <p className="text-xs text-rose-400 mt-1">{fieldErrors.accountId}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Тикер</label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value.toUpperCase());
              setFieldErrors((prev) => ({ ...prev, symbol: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            required
          />
          {fieldErrors.symbol && <p className="text-xs text-rose-400 mt-1">{fieldErrors.symbol}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'long' | 'short')}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'open' | 'closed')}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="open">open</option>
            <option value="closed">closed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Дата входа</label>
          <input
            type="datetime-local"
            value={entryDate}
            onChange={(e) => {
              setEntryDate(e.target.value);
              setFieldErrors((prev) => ({ ...prev, entryDate: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            required
          />
          {fieldErrors.entryDate && <p className="text-xs text-rose-400 mt-1">{fieldErrors.entryDate}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Дата выхода</label>
          <input
            type="datetime-local"
            value={exitDate}
            onChange={(e) => {
              setExitDate(e.target.value);
              setFieldErrors((prev) => ({ ...prev, exitDate: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            disabled={status !== 'closed'}
          />
          {fieldErrors.exitDate && <p className="text-xs text-rose-400 mt-1">{fieldErrors.exitDate}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Цена входа</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={entryPrice}
            onChange={(e) => {
              setEntryPrice(e.target.value);
              setFieldErrors((prev) => ({ ...prev, entryPrice: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            required
          />
          {fieldErrors.entryPrice && <p className="text-xs text-rose-400 mt-1">{fieldErrors.entryPrice}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Количество</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setFieldErrors((prev) => ({ ...prev, quantity: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            required
          />
          {fieldErrors.quantity && <p className="text-xs text-rose-400 mt-1">{fieldErrors.quantity}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Цена выхода</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={exitPrice}
            onChange={(e) => {
              setExitPrice(e.target.value);
              setFieldErrors((prev) => ({ ...prev, exitPrice: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            disabled={status !== 'closed'}
          />
          {fieldErrors.exitPrice && <p className="text-xs text-rose-400 mt-1">{fieldErrors.exitPrice}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Stop Loss</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={stopLoss}
            onChange={(e) => {
              setStopLoss(e.target.value);
              setFieldErrors((prev) => ({ ...prev, stopLoss: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
          {fieldErrors.stopLoss && <p className="text-xs text-rose-400 mt-1">{fieldErrors.stopLoss}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Take Profit</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={takeProfit}
            onChange={(e) => {
              setTakeProfit(e.target.value);
              setFieldErrors((prev) => ({ ...prev, takeProfit: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
          {fieldErrors.takeProfit && <p className="text-xs text-rose-400 mt-1">{fieldErrors.takeProfit}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Strategy</label>
          <input
            type="text"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Setup</label>
          <input
            type="text"
            value={setup}
            onChange={(e) => setSetup(e.target.value)}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Tags (через запятую)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-4">
          <label className="block text-xs text-slate-400 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Комиссия</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-4">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-60 px-4 py-2 text-sm font-medium"
          >
            {submitting ? (editingId ? 'Сохранение...' : 'Создание...') : editingId ? 'Сохранить изменения' : 'Добавить сделку'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="ml-2 rounded-md bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm font-medium"
            >
              Отмена
            </button>
          )}
        </div>
      </form>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Фильтр по статусу</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="">Все</option>
            <option value="open">open</option>
            <option value="closed">closed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Фильтр по тикеру</label>
          <input
            type="text"
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value.toUpperCase())}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            placeholder="Например, BTCUSDT"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Записей на странице</label>
          <select
            value={String(perPage)}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left cursor-pointer" onClick={() => handleSort('symbol')}>Тикер</th>
                <th className="px-3 py-2 text-left">Направление</th>
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-left cursor-pointer" onClick={() => handleSort('entryDate')}>Дата входа</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('entryPrice')}>Цена входа</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('quantity')}>Количество</th>
                <th className="px-3 py-2 text-right cursor-pointer" onClick={() => handleSort('pnl')}>P&L</th>
                <th className="px-3 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrades.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    <div className="py-2">
                      <p className="text-slate-400 mb-2">Пока нет сделок</p>
                      <button
                        type="button"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="rounded-md bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Добавить первую сделку
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedTrades.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-slate-800 hover:bg-slate-900/60 cursor-pointer"
                    onClick={() => navigate(`/trades/${t.id}`)}
                  >
                    <td className="px-3 py-2">{t.symbol}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.direction === 'long'
                            ? 'bg-emerald-900/60 text-emerald-300'
                            : 'bg-rose-900/60 text-rose-300'
                        }`}
                      >
                        {t.direction === 'long' ? 'Long' : 'Short'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {t.status === 'open' ? 'Открыта' : 'Закрыта'}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {new Date(t.entryDate).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(t.entryPrice).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Number(t.quantity).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={Number(t.pnl ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                        {t.pnl !== undefined && t.pnl !== null
                        ? Number(t.pnl).toFixed(2)
                        : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEditClick(t);
                        }}
                        className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteClick(t.id);
                        }}
                        className="ml-2 rounded bg-rose-900/70 hover:bg-rose-800 px-2 py-1 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Страница {page} из {totalPages} · Всего сделок: {total}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm"
          >
            Назад
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm"
          >
            Вперёд
          </button>
        </div>
      </div>
    </div>
  );
}


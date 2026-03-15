import { FormEvent, useEffect, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/ToastProvider';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';

type Account = {
  id: string;
  name: string;
  broker?: string;
  initialBalance?: string;
  currentBalance?: string;
  currency?: string;
  type: string;
  isArchived: boolean;
  totalPnl?: number;
  winRate?: number;
};

export function AccountsPage() {
  const user = useAuthStore((state) => state.user);
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [broker, setBroker] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [type, setType] = useState('stocks');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setBroker('');
    setInitialBalance('');
    setCurrentBalance('');
    setCurrency('USD');
    setType('stocks');
    setFieldErrors({});
  };

  const validateAccountForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = 'Название обязательно';
    }
    if (initialBalance && Number(initialBalance) < 0) {
      nextErrors.initialBalance = 'Начальный депозит не может быть меньше 0';
    }
    if (currentBalance && Number(currentBalance) < 0) {
      nextErrors.currentBalance = 'Текущий баланс не может быть меньше 0';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/accounts');
      setAccounts(res.data.data ?? []);
    } catch {
      setError('Не удалось загрузить счета');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleSubmitAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      setError('Сессия не найдена. Выполните вход заново');
      showToast('Сессия не найдена. Выполните вход заново', 'error');
      return;
    }

    if (!validateAccountForm()) {
      showToast('Проверьте поля формы счета', 'error');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        userId: user.id,
        name,
        broker: broker || undefined,
        initialBalance: initialBalance ? Number(initialBalance) : undefined,
        currentBalance: currentBalance ? Number(currentBalance) : undefined,
        currency,
        type,
      };

      if (editingId) {
        await api.put(`/accounts/${editingId}`, payload);
        showToast('Счёт обновлён', 'success');
      } else {
        await api.post('/accounts', payload);
        showToast('Счёт создан', 'success');
      }

      resetForm();
      await loadAccounts();
    } catch {
      setError(editingId ? 'Не удалось обновить счет' : 'Не удалось создать счет');
      showToast(editingId ? 'Не удалось обновить счет' : 'Не удалось создать счет', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (account: Account) => {
    setEditingId(account.id);
    setName(account.name);
    setBroker(account.broker ?? '');
    setInitialBalance(account.initialBalance ? String(account.initialBalance) : '');
    setCurrentBalance(account.currentBalance ? String(account.currentBalance) : '');
    setCurrency(account.currency ?? 'USD');
    setType(account.type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (accountId: string) => {
    const confirmed = window.confirm('Удалить счет? Связанные сделки этого счета тоже будут удалены.');
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/accounts/${accountId}`);
      if (editingId === accountId) {
        resetForm();
      }
      await loadAccounts();
      showToast('Счёт удалён', 'success');
    } catch {
      setError('Не удалось удалить счет');
      showToast('Не удалось удалить счет', 'error');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Торговые счета</h1>
      <form
        onSubmit={handleSubmitAccount}
        className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-5 grid grid-cols-1 md:grid-cols-5 gap-3"
      >
        <div>
          <label className="block text-xs text-slate-400 mb-1">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFieldErrors((prev) => ({ ...prev, name: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            required
          />
          {fieldErrors.name && <p className="text-xs text-rose-400 mt-1">{fieldErrors.name}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Брокер</label>
          <input
            type="text"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Начальный депозит</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={initialBalance}
            onChange={(e) => {
              setInitialBalance(e.target.value);
              setFieldErrors((prev) => ({ ...prev, initialBalance: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
          {fieldErrors.initialBalance && <p className="text-xs text-rose-400 mt-1">{fieldErrors.initialBalance}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Текущий баланс</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={currentBalance}
            onChange={(e) => {
              setCurrentBalance(e.target.value);
              setFieldErrors((prev) => ({ ...prev, currentBalance: '' }));
            }}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          />
          {fieldErrors.currentBalance && <p className="text-xs text-rose-400 mt-1">{fieldErrors.currentBalance}</p>}
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Валюта</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="RUB">RUB</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Тип</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="stocks">stocks</option>
            <option value="forex">forex</option>
            <option value="crypto">crypto</option>
            <option value="futures">futures</option>
            <option value="options">options</option>
          </select>
        </div>
        <div className="md:col-span-5">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-60 px-4 py-2 text-sm font-medium"
          >
            {submitting ? (editingId ? 'Сохранение...' : 'Создание...') : editingId ? 'Сохранить изменения' : 'Добавить счёт'}
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
                <th className="px-3 py-2 text-left">Название</th>
                <th className="px-3 py-2 text-left">Брокер</th>
                <th className="px-3 py-2 text-right">Начальный депозит</th>
                <th className="px-3 py-2 text-right">Текущий баланс</th>
                <th className="px-3 py-2 text-right">Total P&L</th>
                <th className="px-3 py-2 text-right">Win Rate</th>
                <th className="px-3 py-2 text-left">Валюта</th>
                <th className="px-3 py-2 text-left">Тип</th>
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    <div className="py-2">
                      <p className="text-slate-400 mb-2">Пока нет счетов</p>
                      <button
                        type="button"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="rounded-md bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Добавить первый счёт
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                accounts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-slate-800 hover:bg-slate-900/60"
                  >
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {a.broker || '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {a.initialBalance
                        ? Number(a.initialBalance).toFixed(2)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {a.currentBalance
                        ? Number(a.currentBalance).toFixed(2)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={(a.totalPnl ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                        {(a.totalPnl ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={(a.winRate ?? 0) >= 50 ? 'text-emerald-300' : 'text-rose-300'}>
                        {(a.winRate ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {a.currency || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{a.type}</td>
                    <td className="px-3 py-2">
                      {a.isArchived ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
                          Архив
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/60 text-emerald-300">
                          Активен
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleEditClick(a)}
                        className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(a.id)}
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
    </div>
  );
}


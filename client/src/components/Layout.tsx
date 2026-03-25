import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AccountOption, fetchAccountOptions } from '../services/accounts';
import { useActiveAccountStore } from '../store/activeAccountStore';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/trades', label: 'Trades' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/analytics', label: 'Analytics' }
];

type Props = {
  children: ReactNode;
};

export function Layout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const activeAccountId = useActiveAccountStore((state) => state.activeAccountId);
  const setActiveAccountId = useActiveAccountStore((state) => state.setActiveAccountId);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const nextAccounts = await fetchAccountOptions();
        setAccounts(nextAccounts);

        if (activeAccountId !== 'all' && !nextAccounts.some((item: { id: string }) => item.id === activeAccountId)) {
          setActiveAccountId('all');
        }
      } catch {
        setAccounts([]);
      }
    };

    loadAccounts();
  }, [activeAccountId, setActiveAccountId]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore logout API error on client side
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      <aside
        className={`w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-50 fixed md:static inset-y-0 left-0 transform transition-transform md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 py-4 text-xl font-semibold tracking-tight border-b border-slate-800">
          Trading Journal
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  active
                    ? 'bg-slate-800 text-sky-400'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-400 truncate">{user?.email ?? 'Пользователь'}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm"
          >
            Выйти
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="px-4 py-3 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="md:hidden rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-1 text-sm"
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <span className="font-semibold">Trading Journal</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Активный счёт</label>
            <select
              value={activeAccountId}
              onChange={(event) => setActiveAccountId(event.target.value as string | 'all')}
              className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-sm"
            >
              <option value="all">Все счета</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}


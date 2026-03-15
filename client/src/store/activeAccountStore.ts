import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ActiveAccountState = {
  activeAccountId: string | 'all';
  setActiveAccountId: (accountId: string | 'all') => void;
};

export const useActiveAccountStore = create<ActiveAccountState>()(
  persist(
    (set) => ({
      activeAccountId: 'all',
      setActiveAccountId: (accountId) => set({ activeAccountId: accountId }),
    }),
    {
      name: 'trading-journal-active-account',
    }
  )
);

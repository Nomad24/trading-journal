import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export function ToastProvider({ children }: Props) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  useEffect(() => {
    const handleToastEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string; type?: ToastType }>;
      const message = customEvent.detail?.message;

      if (!message) {
        return;
      }

      showToast(message, customEvent.detail?.type ?? 'info');
    };

    window.addEventListener('app:toast', handleToastEvent);

    return () => {
      window.removeEventListener('app:toast', handleToastEvent);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed z-50 top-4 right-4 space-y-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-md border px-3 py-2 text-sm shadow-lg ${
              toast.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
                : toast.type === 'error'
                  ? 'bg-rose-900/90 border-rose-700 text-rose-100'
                  : 'bg-slate-900/95 border-slate-700 text-slate-100'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

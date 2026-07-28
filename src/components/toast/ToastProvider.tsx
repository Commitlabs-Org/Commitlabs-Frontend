'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

interface Toast {
  id: string;
  type: 'success' | 'error';
  title: string;
  description: string;
}

interface ToastParams {
  title: string;
  description: string;
}

interface ToastContextValue {
  success: (params: ToastParams) => void;
  error: (params: ToastParams) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: 'success' | 'error', params: ToastParams) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, ...params }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((params: ToastParams) => addToast('success', params), [addToast]);
  const error = useCallback((params: ToastParams) => addToast('error', params), [addToast]);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={[
              'rounded-lg px-4 py-3 shadow-lg border text-sm transition-all duration-300',
              toast.type === 'success'
                ? 'bg-[#0a2e1a] border-[#22c55e]/30 text-[#86efac]'
                : 'bg-[#2e0a0a] border-[#ef4444]/30 text-[#fca5a5]',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 opacity-80">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

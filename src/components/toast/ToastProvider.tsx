'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { Toast, ToastOptions, ToastContextValue, ToastSeverity } from './types';
import ToastItem from './ToastItem';
import './toast.css';

const MAX_VISIBLE_TOASTS = 5;
const DEFAULT_DURATION = 5000;

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const reducedMotion = useRef<boolean>(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mediaQuery.matches;
    const handler = (event: MediaQueryListEvent) => {
      reducedMotion.current = event.matches;
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    setVisibleIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
    setVisibleIds(new Set());
  }, []);

  const showToast = useCallback(
    (severity: ToastSeverity, options: ToastOptions) => {
      const id = generateId();
      const toast: Toast = {
        id,
        severity,
        title: options.title,
        description: options.description,
        duration: options.duration ?? DEFAULT_DURATION,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        const next = [toast, ...prev];
        if (next.length > MAX_VISIBLE_TOASTS) {
          const overflow = next.slice(MAX_VISIBLE_TOASTS);
          overflow.forEach((t) => {
            const timer = timersRef.current.get(t.id);
            if (timer) clearTimeout(timer);
            timersRef.current.delete(t.id);
          });
          return next.slice(0, MAX_VISIBLE_TOASTS);
        }
        return next;
      });

      setVisibleIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      const duration = options.duration ?? DEFAULT_DURATION;
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  const pauseTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const resumeTimer = useCallback(
    (id: string) => {
      const toast = toasts.find((t) => t.id === id);
      if (!toast) return;
      const elapsed = Date.now() - toast.createdAt;
      const remaining = Math.max(0, (toast.duration ?? DEFAULT_DURATION) - elapsed);
      const timer = setTimeout(() => {
        dismiss(id);
      }, remaining);
      timersRef.current.set(id, timer);
    },
    [toasts, dismiss]
  );

  const success = useCallback(
    (options: ToastOptions) => showToast('success', options),
    [showToast]
  );
  const error = useCallback(
    (options: ToastOptions) => showToast('error', options),
    [showToast]
  );
  const info = useCallback(
    (options: ToastOptions) => showToast('info', options),
    [showToast]
  );
  const warning = useCallback(
    (options: ToastOptions) => showToast('warning', options),
    [showToast]
  );

  const value: ToastContextValue = {
    success,
    error,
    info,
    warning,
    dismiss,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-container"
        role="region"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="toast-viewport" role="status" aria-live="assertive" aria-atomic="true">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              isVisible={visibleIds.has(toast.id)}
              reducedMotion={reducedMotion.current}
              onDismiss={() => dismiss(toast.id)}
              onPause={() => pauseTimer(toast.id)}
              onResume={() => resumeTimer(toast.id)}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
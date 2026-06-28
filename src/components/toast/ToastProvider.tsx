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

/** Text queued into the polite and assertive live regions. */
interface AnnouncerState {
  polite: string;
  assertive: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [announcer, setAnnouncer] = useState<AnnouncerState>({ polite: '', assertive: '' });
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const timerStartedAtRef = useRef<Map<string, number>>(new Map());
  const timerRemainingRef = useRef<Map<string, number>>(new Map());
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
    timerStartedAtRef.current.delete(id);
    timerRemainingRef.current.delete(id);
  }, []);

  const dismissAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    timerStartedAtRef.current.clear();
    timerRemainingRef.current.clear();
    setToasts([]);
    setVisibleIds(new Set());
  }, []);

  const startTimer = useCallback(
    (id: string, duration: number) => {
      if (duration <= 0 || timersRef.current.has(id)) return;

      timerStartedAtRef.current.set(id, Date.now());
      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  const showToast = useCallback(
    (severity: ToastSeverity, options: ToastOptions) => {
      const id = generateId();
      const duration = options.duration ?? DEFAULT_DURATION;
      const toast: Toast = {
        id,
        severity,
        title: options.title,
        description: options.description,
        duration,
        createdAt: Date.now(),
        action: options.action,
      };

      setToasts((prev) => {
        const next = [toast, ...prev];
        if (next.length > MAX_VISIBLE_TOASTS) {
          const overflow = next.slice(MAX_VISIBLE_TOASTS);
          overflow.forEach((t) => {
            const timer = timersRef.current.get(t.id);
            if (timer) clearTimeout(timer);
            timersRef.current.delete(t.id);
            timerStartedAtRef.current.delete(t.id);
            timerRemainingRef.current.delete(t.id);
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

      // Announce to screen readers: errors use assertive, others use polite.
      const text = [options.title, options.description].filter(Boolean).join(' — ');
      if (severity === 'error') {
        setAnnouncer({ polite: '', assertive: text });
      } else {
        setAnnouncer({ assertive: '', polite: text });
      }

      if (duration > 0) {
        timerRemainingRef.current.set(id, duration);
        startTimer(id, duration);
      }

      return id;
    },
    [startTimer]
  );

  const pauseTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
      const startedAt = timerStartedAtRef.current.get(id) ?? Date.now();
      const remaining = timerRemainingRef.current.get(id) ?? DEFAULT_DURATION;
      timerRemainingRef.current.set(id, Math.max(0, remaining - (Date.now() - startedAt)));
      timerStartedAtRef.current.delete(id);
    }
  }, []);

  const resumeTimer = useCallback(
    (id: string) => {
      const toast = toasts.find((t) => t.id === id);
      if (!toast || timersRef.current.has(id)) return;
      const remaining = timerRemainingRef.current.get(id) ?? toast.duration ?? DEFAULT_DURATION;
      if (remaining > 0) {
        startTimer(id, remaining);
      }
    },
    [toasts, startTimer]
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
      {/* Visually-hidden aria-live announcer — one region per politeness level. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        data-toast-announcer="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcer.polite}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        data-toast-announcer="assertive"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcer.assertive}
      </div>
      <div
        className="toast-container"
        role="region"
        aria-label="Notifications"
      >
        <div className="toast-viewport" data-toast-viewport>
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

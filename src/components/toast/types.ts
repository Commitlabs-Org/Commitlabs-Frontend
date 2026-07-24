export type ToastSeverity = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  severity: ToastSeverity;
  title: string;
  description?: string;
  duration?: number;
  createdAt: number;
  action?: ToastAction;
}

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
  dismiss?: boolean;
}

export interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
}

export interface ToastContextValue {
  success: (options: ToastOptions) => void;
  error: (options: ToastOptions) => void;
  info: (options: ToastOptions) => void;
  warning: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  history: ToastHistoryEntry[];
  clearHistory: () => void;
  markHistoryRead: (id: string) => void;
  markAllHistoryRead: () => void;
}

/** A record of a dismissed/expired toast kept in the bounded history store. */
export interface ToastHistoryEntry {
  id: string;
  severity: ToastSeverity;
  title: string;
  description?: string;
  /** Unix-ms timestamp when the toast was first created. */
  createdAt: number;
  /** Unix-ms timestamp when the toast was dismissed/expired. */
  dismissedAt: number;
  /** Whether the user has acknowledged this entry in the history panel. */
  read: boolean;
  /** Source tag so history viewers can distinguish ephemeral client toasts
   *  from server-derived notifications.  Always "toast" for this store. */
  source: 'toast';
}

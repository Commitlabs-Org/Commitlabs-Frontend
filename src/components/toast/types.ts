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
}

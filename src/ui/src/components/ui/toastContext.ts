/**
 * Toasts: the transient result of an action ("Saved", "Approval requested"). Persistent outcomes use a Banner.
 */
import { createContext, useContext } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastApi {
  /** Shows a message for a few seconds (errors stay until dismissed). */
  show(message: string, tone?: ToastTone): void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (value === null) {
    throw new Error('useToast must be used inside ToastProvider.');
  }
  return value;
}

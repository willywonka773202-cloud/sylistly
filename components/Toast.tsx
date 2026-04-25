'use client';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    
    const duration = toast.duration ?? 3500;
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
    
    return id;
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  clearToasts: () => set({ toasts: [] }),
}));

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  loading: Loader2,
};

const STYLES = {
  success: 'bg-emerald/20 border-emerald text-emerald',
  error: 'bg-red-500/20 border-red-500 text-red-500',
  info: 'bg-accent/20 border-accent text-accent',
  loading: 'bg-surface-2 border-hairline text-muted',
};

export function ToastContainer() {
  const toasts = useToast((state) => state.toasts);
  const removeToast = useToast((state) => state.removeToast);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-[360px] pointer-events-none">
      <AnimatePresence mode="wait">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className={`flex items-center gap-3 p-3 rounded-xl border backdrop-blur-lg pointer-events-auto ${STYLES[toast.type]}`}
            >
              {toast.type === 'loading' ? (
                <Icon size={18} className="animate-spin shrink-0" />
              ) : (
                <Icon size={18} className="shrink-0" />
              )}
              <span className="flex-1 text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1 rounded-full hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function toast(message: string, type: ToastType = 'info', duration?: number) {
  return useToast.getState().addToast({ message, type, duration });
}

export function successToast(message: string, duration?: number) {
  return toast(message, 'success', duration);
}

export function errorToast(message: string, duration?: number) {
  return toast(message, 'error', duration);
}

export function loadingToast(message: string, duration?: number) {
  return toast(message, 'loading', duration);
}

export function infoToast(message: string, duration?: number) {
  return toast(message, 'info', duration);
}
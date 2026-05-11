'use client';

import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export function AppScreen({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-[linear-gradient(180deg,#171310_0%,#090807_100%)] text-ink ${className}`}
    >
      {children}
    </main>
  );
}

export function AppHeader({
  eyebrow,
  title,
  subtitle,
  right,
  className = '',
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`px-4 pt-[calc(env(safe-area-inset-top)+12px)] ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[9px] font-bold uppercase tracking-[.18em] text-white/48">{eyebrow}</div>
          ) : null}
          <div className="truncate font-serif text-[25px] font-semibold leading-none text-white">{title}</div>
          {subtitle ? <div className="mt-1 truncate text-[11px] text-white/54">{subtitle}</div> : null}
        </div>
        {right ? <div className="flex-none">{right}</div> : null}
      </div>
    </header>
  );
}

export function BottomSheet({
  open,
  title,
  children,
  onClose,
  footer,
  maxHeightClassName = 'max-h-[88dvh]',
}: {
  open: boolean;
  title?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  maxHeightClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/58 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Close sheet" onClick={onClose} />
      <section
        className={`relative z-10 flex w-full flex-col rounded-t-[30px] border border-white/12 bg-[#11100f] shadow-[0_-24px_70px_rgba(0,0,0,.52)] ${maxHeightClassName}`}
      >
        <div className="flex-none px-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20" />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 font-serif text-[22px] font-semibold leading-tight text-white">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 flex-none place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white transition active:scale-95"
              aria-label="Close"
            >
              <X size={17} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex-none border-t border-white/10 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
            {footer}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function StickyActionBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`fixed inset-x-0 bottom-[76px] z-30 mx-auto max-w-[480px] px-4 pb-[env(safe-area-inset-bottom)] ${className}`}
    >
      <div className="rounded-[24px] border border-white/12 bg-black/58 p-2 shadow-[0_20px_52px_rgba(0,0,0,.34)] backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}

export function HorizontalChipScroller({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide ${className}`}>{children}</div>;
}


'use client';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { FloatingTabBar } from './FloatingTabBar';

export function AppShell({
  children,
  header,
  showTabBar = true,
  pad = true,
  className = '',
}: {
  children: ReactNode;
  header?: ReactNode;
  showTabBar?: boolean;
  pad?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full max-w-[440px] min-h-[100dvh] bg-bg ${className}`}>
      {header}
      <main className={pad ? 'pb-28' : ''}>{children}</main>
      {showTabBar && <FloatingTabBar />}
    </div>
  );
}

export function AppHeader({
  title,
  brand,
  kicker,
  back,
  onBack,
  right,
  transparent,
}: {
  title?: string;
  brand?: boolean;
  kicker?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  transparent?: boolean;
}) {
  const router = useRouter();
  return (
    <header
      className={`sticky top-0 z-20 ${transparent ? '' : 'glass border-b border-hairline'} px-5 pt-[max(14px,env(safe-area-inset-top))] pb-3`}
    >
      <div className="flex items-center justify-between gap-3 min-h-[40px]">
        <div className="flex items-center gap-2 min-w-0">
          {back && (
            <button
              onClick={onBack || (() => router.back())}
              className="grid place-items-center w-9 h-9 -ml-1 rounded-full text-ink btn-press"
              aria-label="Back"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {brand ? (
            <div className="flex items-center gap-2">
              <span className="grid place-items-center w-8 h-8 rounded-xl brand-gradient text-white shadow-pink-glow">
                <Sparkles size={17} strokeWidth={2.4} />
              </span>
              <span className="font-display text-2xl tracking-tight text-ink">Sylistly</span>
            </div>
          ) : (
            <div className="min-w-0">
              {kicker && <div className="text-2xs uppercase tracking-editorial text-muted">{kicker}</div>}
              {title && <h1 className="font-display text-xl text-ink truncate">{title}</h1>}
            </div>
          )}
        </div>
        {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
      </div>
    </header>
  );
}

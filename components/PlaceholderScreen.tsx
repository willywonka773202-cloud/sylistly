import type { ReactNode } from 'react';
import { AmbientField } from './AmbientField';
import { BottomNav } from './BottomNav';

interface Props {
  accent: string;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  maxWidthClassName?: string;
}

export function PlaceholderScreen({
  accent,
  eyebrow,
  title,
  description,
  children,
  maxWidthClassName = 'max-w-[440px]',
}: Props) {
  return (
    <main className={`sy-game-screen relative mx-auto flex h-[100dvh] flex-col overflow-hidden bg-bg ${maxWidthClassName}`}>
      <AmbientField className="opacity-60" />
      <div aria-hidden className="sy-game-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+108px)] pt-[max(2.75rem,calc(env(safe-area-inset-top)+1rem))]">
        <div className="sy-stage-header border-b border-hairline pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-eyebrow font-extrabold uppercase text-champagne">{eyebrow}</div>
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline-2 bg-surface-2/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.18em] text-muted backdrop-blur-xl">
              <span className="sy-live-dot h-1.5 w-1.5 rounded-full bg-money" />
              Live wardrobe
            </span>
          </div>
          <h1 className="mt-2 font-serif text-[26px] font-semibold leading-none text-ink">
            {title} <em className="italic text-accent">{accent}</em>
          </h1>
          <p className="mt-2 max-w-[34ch] text-[12px] leading-relaxed text-muted-2">
            {description}
          </p>
        </div>

        <div className="pt-4">{children}</div>
      </div>

      <BottomNav />
    </main>
  );
}

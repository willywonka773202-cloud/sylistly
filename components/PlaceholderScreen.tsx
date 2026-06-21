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
    <main className={`relative mx-auto flex h-[100dvh] flex-col overflow-hidden bg-bg ${maxWidthClassName}`}>
      <AmbientField className="opacity-60" />
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+108px)] pt-[max(2.75rem,calc(env(safe-area-inset-top)+1rem))]">
        <div className="border-b border-hairline pb-3">
          <div className="text-eyebrow font-extrabold uppercase text-champagne">{eyebrow}</div>
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

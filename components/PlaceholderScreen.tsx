import type { ReactNode } from 'react';
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
    <main className={`mx-auto flex h-[100dvh] flex-col bg-bg ${maxWidthClassName}`}>
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-11">
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

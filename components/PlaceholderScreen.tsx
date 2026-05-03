import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
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
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div>
            <div className="text-[9px] uppercase tracking-[.18em] text-muted">{eyebrow}</div>
            <h1 className="mt-2 font-serif text-[24px] font-semibold leading-none text-ink">
              {title} <em className="italic text-accent">{accent}</em>
            </h1>
            <p className="mt-2 max-w-[28ch] text-[12px] leading-relaxed text-muted-2">
              {description}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-full border border-hairline-2 px-3 py-2 text-[11px] font-medium text-muted-2 transition hover:border-accent hover:text-ink"
          >
            <ArrowLeft size={12} />
            Builder
          </Link>
        </div>

        <div className="pt-4">{children}</div>
      </div>

      <BottomNav />
    </main>
  );
}

'use client';

import { Lock, WandSparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';

const PENDING_LOCK_KEY = 'sylistly.pending-lock.v1';

/** CTA pair on shared-fit pages: pull the look into the app. */
export function ShareActions({ items }: { items: Partial<Record<Category, Product>> }) {
  const router = useRouter();
  const replaceItems = useFit((state) => state.replaceItems);

  const products = Object.values(items).filter((product): product is Product => Boolean(product));
  const hero = products.reduce(
    (best, candidate) => ((candidate.priceCents || 0) > (best?.priceCents || 0) ? candidate : best),
    null as Product | null,
  );

  function remixHere() {
    replaceItems(items);
    track('share_page_remix', { pieces: products.length });
    router.push('/build');
  }

  function lockHeroAndScroll() {
    if (hero) {
      window.localStorage.setItem(PENDING_LOCK_KEY, JSON.stringify(hero));
      track('share_page_lock', { category: hero.category, brand: hero.brand });
    }
    router.push('/');
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <button
        type="button"
        onClick={remixHere}
        className="sy-press inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-4 py-3.5 text-[14px] font-bold text-white shadow-pink-glow"
      >
        <WandSparkles size={16} />
        Remix this fit
      </button>
      {hero ? (
        <button
          type="button"
          onClick={lockHeroAndScroll}
          className="sy-press inline-flex w-full items-center justify-center gap-2 rounded-full border border-hairline-2 bg-surface-2 px-4 py-3.5 text-[13px] font-semibold text-ink"
        >
          <Lock size={14} className="text-accent" />
          Lock the {hero.brand} piece &amp; scroll
        </button>
      ) : null}
    </div>
  );
}

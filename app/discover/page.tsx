'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, ChevronLeft, LayoutGrid } from 'lucide-react';
import { AmbientField } from '@/components/AmbientField';
import { BottomNav } from '@/components/BottomNav';
import { Reveal } from '@/components/Reveal';
import { WornFlatlay } from '@/components/WornFlatlay';
import { colorSwatch, derivePalette } from '@/lib/color-harmony';
import { getVerifiedDropLooks } from '@/lib/drop-look-library';
import { track } from '@/lib/analytics';
import { buildAnalyticsLookId } from '@/lib/analytics-events';
import { useFit } from '@/store/fit';
import { VIBES } from '@/lib/vibes';
import type { Category, Product } from '@/lib/types';

/**
 * Discover — a curated, Pinterest-style wall of complete looks (one per vibe),
 * each rendered on the premium vitrine plate. Tapping a look seeds the Remix
 * builder with it so you can make it yours. A browse-by-mood complement to the
 * Tinder feed; reuses the existing look generator + plate (no new outfit data).
 * The look set is deterministic (fixed seeds) so the wall is stable per session.
 */
type DiscoverEntry = {
  vibe: (typeof VIBES)[number];
  lookId: string;
  items: Partial<Record<Category, Product>>;
};

export default function DiscoverPage() {
  const router = useRouter();
  const replaceItems = useFit((state) => state.replaceItems);

  const looks = useMemo<DiscoverEntry[]>(() => {
    const out: DiscoverEntry[] = [];
    VIBES.forEach((vibe, i) => {
      // Reuse the compact, fresh-positive Drop artifact rather than shipping
      // the full client catalog + 24k-look library into this browsing route.
      const look = getVerifiedDropLooks(vibe.id, 13 + i * 7, 1)[0];
      if (look) {
        const productIds = Object.values(look.items)
          .filter((product): product is Product => Boolean(product))
          .map((product) => product.id);
        out.push({
          vibe,
          lookId: buildAnalyticsLookId(`discover-${vibe.id}`, productIds),
          items: look.items,
        });
      }
    });
    return out;
  }, []);

  function explore(lookId: string, vibeId: string, items: Partial<Record<Category, Product>>) {
    const productIds = Object.values(items)
      .filter((product): product is Product => Boolean(product))
      .map((product) => product.id);
    track('look_remixed', {
      lookId,
      productIds,
      pieces: productIds.length,
      source: 'outfit_library',
      surface: 'discover',
      vibe: vibeId,
    });
    replaceItems(items); // the store filters to transparent-renderable items
    router.push(`/build?vibe=${vibeId}&frame=androgynous`);
  }

  return (
    <main className="sy-game-screen relative min-h-[100dvh] w-full overflow-hidden bg-bg pb-[120px] lg:pb-10">
      <AmbientField className="opacity-55" />
      <div className="relative z-10">
        <header className="px-4 pt-[calc(env(safe-area-inset-top)+14px)] lg:px-8 lg:pt-8">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              aria-label="Back to the scroll"
              className="sy-press grid h-11 w-11 place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink lg:hidden"
            >
              <ChevronLeft size={16} />
            </Link>
            <Link
              href="/browse"
              aria-label="Browse individual pieces"
              className="sy-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline-2 bg-surface-2/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[.12em] text-muted-2"
            >
              <LayoutGrid size={13} />
              Pieces
            </Link>
          </div>
          <div className="mt-4 text-eyebrow font-extrabold uppercase text-champagne lg:mt-8">Curated complete looks</div>
          <h1 className="mt-2 font-serif text-[26px] font-semibold leading-none text-ink lg:text-[40px]">
            Discover your next <em className="italic text-accent">outfit</em>
          </h1>
          <p className="mt-2 max-w-[48ch] text-[12px] leading-relaxed text-muted-2 lg:text-[14px]">
            Complete looks arranged by style. Open one in Remix to keep the direction and replace any piece.
          </p>
        </header>

        <section aria-label="Curated style directions" className="mt-5 grid grid-cols-2 gap-3 px-4 md:grid-cols-3 lg:mt-7 lg:grid-cols-3 lg:gap-5 lg:px-8 xl:grid-cols-4 2xl:grid-cols-5">
          {looks.map(({ vibe, lookId, items }, i) => {
            const swatches = derivePalette(
              Object.values(items)
                .filter((p): p is Product => Boolean(p))
                .map((p) => `${p.name} ${(p.colors || []).join(' ')}`)
                .join(' ')
                .toLowerCase(),
            )
              .map((word) => ({ word, hex: colorSwatch(word) }))
              .filter((s): s is { word: string; hex: string } => Boolean(s.hex))
              .slice(0, 4);
            return (
            <Reveal key={vibe.id} delay={(i % 2) * 80}>
              <button
                type="button"
                onClick={() => explore(lookId, vibe.id, items)}
                aria-label={`Explore the ${vibe.label} look in Remix`}
                className="sy-press sy-lift group block w-full overflow-hidden rounded-card border border-hairline bg-surface-1 text-left ring-1 ring-hairline transition hover:border-accent/55 hover:ring-accent/40"
              >
                <div className="relative aspect-[4/5] overflow-hidden lg:aspect-[3/4]">
                  {/* First row is above the fold — load it eager so the wall has
                      content instantly; the rest lazy-load on scroll (perf). */}
                  <WornFlatlay items={items} active={false} loading={i < 2 ? 'eager' : 'lazy'} className="h-full w-full" />
                  <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.16em] text-white backdrop-blur-md">
                    {vibe.label}
                  </span>
                  {/* champagne light-rake, cascading across the wall as it loads */}
                  <span aria-hidden className="sy-card-sheen" style={{ animationDelay: `${i * 85 + 220}ms` }} />
                </div>
                <div className="px-3 pb-3 pt-2.5 lg:px-4 lg:pb-4 lg:pt-3.5">
                  {swatches.length >= 2 ? (
                    <div
                      className="mb-1.5 flex items-center gap-1.5"
                      aria-label={`Color palette: ${swatches.map((s) => s.word).join(', ')}`}
                    >
                      {swatches.map((s, di) => (
                        <span
                          key={`${s.word}-${di}`}
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                          style={{ background: s.hex }}
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 line-clamp-2 text-[11px] leading-tight text-muted-2 lg:text-[12px]">{vibe.blurb}</span>
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-surface-2 text-accent transition group-hover:bg-accent group-hover:text-white">
                      <ArrowUpRight size={14} />
                    </span>
                  </div>
                </div>
              </button>
            </Reveal>
            );
          })}
        </section>
      </div>
      <BottomNav />
    </main>
  );
}

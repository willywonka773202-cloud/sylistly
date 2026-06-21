import { ExternalLink, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductImage } from '@/components/ProductImage';
import { ShareActions } from '@/components/ShareActions';
import { WornFlatlay } from '@/components/WornFlatlay';
import { wrapAffiliate } from '@/lib/affiliate';
import { colorSwatch, derivePalette } from '@/lib/color-harmony';
import { hasExactProductLink } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import { resolveSharedLook, sharedLookProducts, sharedLookTotalCents } from '@/lib/share-look';

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const look = resolveSharedLook(id);
  if (!look) return { title: 'Fit not found' };
  const products = sharedLookProducts(look);
  const total = formatPrice(sharedLookTotalCents(look));
  const description =
    look.note ||
    `${products.length} real pieces, ${total} total — every one shoppable on Sylistly.`;
  return {
    title: `${look.title} · ${total}`,
    description,
    openGraph: { title: `${look.title} · ${total} · Sylistly`, description },
    twitter: { card: 'summary_large_image', title: `${look.title} · ${total} · Sylistly`, description },
  };
}

export default async function SharedLookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const look = resolveSharedLook(id);
  if (!look) notFound();

  const products = sharedLookProducts(look);
  const total = sharedLookTotalCents(look);
  const exactCount = products.filter((product) => hasExactProductLink(product)).length;
  // The fit's colour story as editorial swatch dots — Syli's curated palette
  // when shared, otherwise derived from the pieces (mirrors the feed).
  const swatches = (look.palette?.length
    ? look.palette
    : derivePalette(products.map((p) => `${p.name} ${(p.colors || []).join(' ')}`).join(' ').toLowerCase()))
    .map((word) => ({ word, hex: colorSwatch(word) }))
    .filter((s): s is { word: string; hex: string } => Boolean(s.hex))
    .slice(0, 5);

  return (
    <main className="relative mx-auto min-h-[100dvh] max-w-[480px] bg-bg px-4 pb-14 pt-[calc(env(safe-area-inset-top)+18px)]">
      {/* Header */}
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="h-[2px] w-6 self-center rounded-full bg-accent" aria-hidden />
          <span className="text-eyebrow font-extrabold uppercase sy-sheen">Sylistly</span>
        </Link>
        {look.isSyli ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-white shadow-pink-glow">
            <Sparkles size={11} />
            Styled by Syli
          </span>
        ) : (
          <span className="rounded-full border border-hairline-2 bg-surface-2 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-muted-2">
            Shared fit
          </span>
        )}
      </header>

      {/* The plate */}
      <div className="mt-4 aspect-[3/4] overflow-hidden rounded-card-lg ring-1 ring-hairline shadow-card-strong">
        <WornFlatlay items={products} loading="eager" className="h-full w-full" />
      </div>

      {/* Meta */}
      <div className="mt-5">
        {look.note ? (
          <>
            <p className="text-eyebrow font-extrabold uppercase text-champagne">Syli&apos;s note</p>
            <p className="mt-1 text-[13px] font-medium leading-snug text-muted-2">{look.note}</p>
          </>
        ) : null}
        <div className="mt-2 flex items-baseline gap-3">
          <h1 className="font-serif text-[32px] font-semibold italic leading-[.95] text-ink">{look.title}</h1>
          <span className="rounded-full border border-money/35 bg-money/10 px-2.5 py-1 text-[12px] font-bold text-money">
            {formatPrice(total)}
          </span>
          <span className="text-[11px] font-semibold text-muted">
            {exactCount}/{products.length} shoppable
          </span>
        </div>
        {swatches.length >= 2 ? (
          <div
            className="mt-3 flex items-center gap-2"
            aria-label={`Color palette: ${swatches.map((s) => s.word).join(', ')}`}
          >
            {swatches.map((s, i) => (
              <span
                key={`${s.word}-${i}`}
                className="sy-pop-in h-3.5 w-3.5 rounded-full ring-1 ring-black/10 shadow-[0_1px_3px_rgba(0,0,0,.2)]"
                style={{ background: s.hex, animationDelay: `${i * 70}ms` }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Pieces — every one a real link */}
      <div className="mt-5 grid gap-2">
        {products.map((product) => {
          const url = wrapAffiliate(getProductOutboundUrl(product), product.id); // attribute shared-look conversions
          return (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-card border border-hairline bg-surface-1 p-2.5"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[linear-gradient(180deg,#FFFFFF,#FAF5EF)]">
                <ProductImage
                  product={product}
                  transparentOnly
                  wrapperClassName="h-10 w-10"
                  className="h-10 w-10 object-contain"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold uppercase tracking-[.12em] text-muted">
                  {product.brand}
                </p>
                <p className="line-clamp-1 text-[13px] font-semibold text-ink">{product.name}</p>
              </div>
              <span className="shrink-0 text-[13px] font-bold text-accent">
                {formatPrice(product.priceCents || 0)}
              </span>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer sponsored"
                  className="sy-press inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 px-3 py-2 text-[11px] font-bold text-accent transition hover:bg-accent hover:text-white"
                >
                  Shop
                  <ExternalLink size={11} />
                </a>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Pull it into the app */}
      <div className="mt-6">
        <ShareActions items={look.items} />
        <p className="mt-4 text-center text-[11px] text-muted">
          Made with{' '}
          <Link href="/" className="font-semibold text-accent">
            Sylistly
          </Link>{' '}
          — endless outfits from real products.
        </p>
      </div>
    </main>
  );
}

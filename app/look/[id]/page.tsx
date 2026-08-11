import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { PublicRetailerLink } from '@/components/PublicRetailerLink';
import { ShareActions } from '@/components/ShareActions';
import { WornFlatlay } from '@/components/WornFlatlay';
import { AffiliateDisclosure } from '@/components/AffiliateDisclosure';
import { colorSwatch, derivePalette } from '@/lib/color-harmony';
import { tidyNote } from '@/lib/note-format';
import { hasExactProductLink } from '@/lib/product-image-quality';
import { getShoppableUrl } from '@/lib/product-links';
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
    (look.note && tidyNote(look.note)) ||
    `${products.length} real pieces, ${total} total — every one shoppable on Sylistly.`;
  const canonicalPath = `/look/${encodeURIComponent(id)}`;
  return {
    title: `${look.title} · ${total}`,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title: `${look.title} · ${total} · Sylistly`, description, url: canonicalPath },
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
    <main className="sy-game-screen relative mx-auto min-h-[100dvh] max-w-[480px] overflow-hidden bg-bg px-4 pb-14 pt-[calc(env(safe-area-inset-top)+18px)] lg:max-w-none lg:px-8 lg:pb-10 lg:pt-8 xl:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(72%_78%_at_17%_42%,rgba(231,199,155,.10),transparent_72%),radial-gradient(50%_60%_at_84%_18%,rgba(255,45,109,.10),transparent_72%)] lg:block"
      />
      <div className="relative mx-auto w-full lg:max-w-[1280px]">
      {/* Header */}
      <header className="flex items-center justify-between lg:border-b lg:border-hairline lg:pb-5">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 lg:min-h-0">
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

      <div className="lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(430px,.88fr)] lg:items-start lg:gap-9 xl:gap-12">
      <section aria-label="Look preview" className="lg:sticky lg:top-8 lg:w-full lg:max-w-[620px] lg:justify-self-center">
      {/* The plate */}
      <div className="mt-4 aspect-[3/4] overflow-hidden rounded-card-lg ring-1 ring-hairline shadow-card-strong lg:mt-0 lg:h-[calc(100dvh-176px)] lg:min-h-[620px] lg:max-h-[760px] lg:aspect-auto lg:rounded-[32px]">
        <WornFlatlay items={products} loading="eager" className="h-full w-full" />
      </div>
      <p className="mt-3 hidden text-[11px] font-semibold uppercase tracking-[.14em] text-muted lg:block">
        {products.length}-piece complete look · exact retailer pages
      </p>
      </section>

      <aside className="lg:rounded-[32px] lg:border lg:border-hairline lg:bg-surface-1/70 lg:p-6 lg:shadow-card lg:backdrop-blur-xl xl:p-7">

      {/* Meta */}
      <div className="mt-5 lg:mt-0">
        {look.note ? (
          <>
            <p className="text-eyebrow font-extrabold uppercase text-champagne">Syli&apos;s note</p>
            <p className="mt-1 text-[13px] font-medium leading-snug text-muted-2">{tidyNote(look.note)}</p>
          </>
        ) : null}
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="font-serif text-[32px] font-semibold italic leading-[.95] text-ink lg:text-[42px]">{look.title}</h1>
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
      <div className="mt-5 grid gap-2 lg:mt-6">
        {products.map((product) => {
          const url = getShoppableUrl(product, {
            lookId: id,
            surface: 'shared-look',
            campaign: 'shared',
            subId: product.id,
          });
          return (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-card border border-hairline bg-surface-1 p-2.5 lg:bg-surface-2/70 lg:p-3"
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
                <PublicRetailerLink
                  initialHref={url}
                  productId={product.id}
                  lookId={id}
                  className="sy-press inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-accent/40 px-3 py-2 text-[11px] font-bold text-accent transition hover:bg-accent hover:text-white"
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <AffiliateDisclosure className="mt-4 text-center" />

      {/* Pull it into the app */}
      <div className="mt-6">
        <ShareActions lookId={id} items={look.items} />
        <p className="mt-4 text-center text-[11px] text-muted">
          Made with{' '}
          <Link href="/" className="font-semibold text-accent">
            Sylistly
          </Link>{' '}
          — endless outfits from real products.
        </p>
      </div>
      </aside>
      </div>
      </div>
      <div className="hidden lg:block">
        <BottomNav />
      </div>
    </main>
  );
}

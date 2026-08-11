import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { WornFlatlay } from '@/components/WornFlatlay';
import { getLibraryLook } from '@/lib/outfit-library';
import { getStyleIdentityById } from '@/lib/style-identity';
import { VIBES } from '@/lib/vibes';

const VIBE_LABEL = new Map(VIBES.map((vibe) => [vibe.id, vibe.label]));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const identity = getStyleIdentityById(id);
  if (!identity) return { title: 'Style not found' };
  const description = `${identity.tagline} — find your style on Sylistly.`;
  const canonicalPath = `/style/${encodeURIComponent(identity.id)}`;
  return {
    title: `I'm a ${identity.name}`,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title: `${identity.name} · Sylistly`, description, url: canonicalPath },
    twitter: { card: 'summary_large_image', title: `${identity.name} · Sylistly`, description },
  };
}

export default async function StyleIdentityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = getStyleIdentityById(id);
  if (!identity) notFound();

  // A representative outfit for this style — so a friend who lands here from a
  // share SEES what the persona looks like, not just reads its name. Computed
  // server-side with a deterministic seed (stable per identity, no hydration
  // mismatch) from the same library generator the feed/Discover use.
  const seed = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const sampleLook = getLibraryLook(identity.vibes[0], 'androgynous', { seed });

  return (
    <main className="sy-game-screen relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg px-6 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+28px)] lg:max-w-none lg:px-10 lg:pb-8 lg:pt-8 xl:px-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-8%,rgba(255,45,109,.2),transparent_46%)] lg:bg-[radial-gradient(68%_92%_at_74%_50%,rgba(255,45,109,.14),transparent_68%),radial-gradient(46%_58%_at_18%_28%,rgba(231,199,155,.09),transparent_70%)]" />
      <div className="relative mx-auto flex w-full flex-1 flex-col lg:max-w-[1280px]">
        <header className="lg:border-b lg:border-hairline lg:pb-5">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 lg:min-h-0">
          <span className="h-[2px] w-6 self-center rounded-full bg-accent" aria-hidden />
          <span className="text-eyebrow font-extrabold uppercase sy-sheen">Sylistly</span>
        </Link>
        </header>

        <div className="flex flex-1 flex-col lg:mt-8 lg:grid lg:grid-cols-[minmax(250px,.72fr)_minmax(360px,1.28fr)] lg:grid-rows-[1fr_auto] lg:items-center lg:gap-x-8 xl:grid-cols-[minmax(330px,.78fr)_minmax(480px,1.22fr)] xl:gap-x-12 2xl:gap-x-20">
        <div className="flex-1 lg:hidden" />

        <section className="lg:pl-5 xl:pl-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-accent">
          <Sparkles size={12} />
          A style on Sylistly
        </span>
        <h1 className="mt-4 font-serif text-[46px] font-semibold italic leading-[0.95] tracking-[-0.02em] text-ink lg:mt-6 lg:text-[clamp(58px,5.4vw,82px)]">
          {identity.name}
        </h1>
        <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-muted-2 lg:mt-6 lg:text-[18px]">{identity.tagline}</p>
        <div className="mt-5 flex flex-wrap gap-2 lg:mt-7">
          {identity.vibes.map((vibe) => (
            <span
              key={vibe}
              className="rounded-full border border-hairline-2 bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-muted-2"
            >
              {VIBE_LABEL.get(vibe) || vibe}
            </span>
          ))}
        </div>
        </section>

        {sampleLook ? (
          <section aria-label={`Example ${identity.name} look`} className="mt-8 w-full max-w-[260px] self-center lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:max-w-[600px] lg:justify-self-end">
            <div className="text-eyebrow font-extrabold uppercase text-champagne lg:mb-3 lg:text-right">A {identity.name} look</div>
            <div className="relative mt-2.5 aspect-[4/5] overflow-hidden rounded-card-lg ring-1 ring-hairline shadow-card lg:mt-0 lg:h-[calc(100dvh-176px)] lg:min-h-[610px] lg:max-h-[740px] lg:aspect-auto lg:rounded-[32px] lg:shadow-card-strong">
              <WornFlatlay items={sampleLook.products} active={false} loading="eager" className="h-full w-full" />
            </div>
          </section>
        ) : null}

        <div className="flex-1 lg:hidden" />

        <div className="pt-8 lg:col-start-1 lg:row-start-2 lg:pl-5 lg:pt-10 xl:pl-8">
        <Link
          href="/"
          className="sy-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-5 py-4 text-[13px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow lg:max-w-[420px]"
        >
          <Sparkles size={15} />
          Find your style
        </Link>
        <p className="mt-3 text-center text-[12px] text-muted lg:max-w-[420px]">
          Endless outfits from real products — take the 5-tap quiz.
        </p>
        </div>
        </div>
      </div>
      <div className="hidden lg:block">
        <BottomNav />
      </div>
    </main>
  );
}

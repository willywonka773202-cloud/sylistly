import { Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IDENTITIES } from '@/lib/style-identity';
import { VIBES } from '@/lib/vibes';

const VIBE_LABEL = new Map(VIBES.map((vibe) => [vibe.id, vibe.label]));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const identity = IDENTITIES[id];
  if (!identity) return { title: 'Style not found' };
  const description = `${identity.tagline} — find your style on Sylistly.`;
  return {
    title: `I'm a ${identity.name}`,
    description,
    openGraph: { title: `${identity.name} · Sylistly`, description },
    twitter: { card: 'summary_large_image', title: `${identity.name} · Sylistly`, description },
  };
}

export default async function StyleIdentityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = IDENTITIES[id];
  if (!identity) notFound();

  return (
    <main className="relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col bg-bg px-6 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-[calc(env(safe-area-inset-top)+28px)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-8%,rgba(255,45,109,.2),transparent_46%)]" />
      <div className="relative flex flex-1 flex-col">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="h-[2px] w-6 self-center rounded-full bg-accent" aria-hidden />
          <span className="text-eyebrow font-extrabold uppercase text-champagne">Sylistly</span>
        </Link>

        <div className="flex-1" />

        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent-soft px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-accent">
          <Sparkles size={12} />
          A style on Sylistly
        </span>
        <h1 className="mt-4 font-serif text-[46px] font-semibold italic leading-[0.95] tracking-[-0.02em] text-ink">
          {identity.name}
        </h1>
        <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-muted-2">{identity.tagline}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {identity.vibes.map((vibe) => (
            <span
              key={vibe}
              className="rounded-full border border-hairline-2 bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-muted-2"
            >
              {VIBE_LABEL.get(vibe) || vibe}
            </span>
          ))}
        </div>

        <div className="flex-1" />

        <Link
          href="/"
          className="sy-press inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-5 py-4 text-[13px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow"
        >
          <Sparkles size={15} />
          Find your style
        </Link>
        <p className="mt-3 text-center text-[12px] text-muted">
          Endless outfits from real products — take the 5-tap quiz.
        </p>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ProductImage } from '@/components/ProductImage';
import { useFit } from '@/store/fit';
import type { Category, Product } from '@/lib/types';
import type { VibeId } from '@/lib/vibes';

type DiscoverFrame = 'all' | 'masc' | 'fem' | 'androgynous';

export interface DiscoverLookCardData {
  id: string;
  title: string;
  description: string;
  vibe: VibeId;
  frameBias: DiscoverFrame;
  products: Product[];
  estimatedTotal: number;
  previewImageUrl?: string;
  previewImageStatus: 'ready' | 'pending' | 'missing';
  tags: string[];
}

const CATEGORY_LABELS: Record<Category, string> = {
  hat: 'Hat',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

function frameLabel(frame: DiscoverFrame): string {
  if (frame === 'all') return 'Any frame';
  if (frame === 'androgynous') return 'Androgynous';
  return frame === 'masc' ? 'Masc bias' : 'Fem bias';
}

function productsToItems(products: Product[]): Partial<Record<Category, Product>> {
  const items: Partial<Record<Category, Product>> = {};

  for (const product of products) {
    if (!items[product.category]) items[product.category] = product;
  }

  return items;
}

function ProductFallbackHero({ products }: { products: Product[] }) {
  const [lead, ...supporting] = products;

  if (!lead) return null;

  return (
    <div className="relative h-[286px] overflow-hidden rounded-[24px] border border-[#efe4da] bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,.92),transparent_26%),linear-gradient(135deg,#fffaf5_0%,#eee2d8_100%)] p-3">
      <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute bottom-5 left-5 h-10 w-48 rounded-full bg-[#9b7f6b]/20 blur-xl" />
      <div className="relative grid h-full grid-cols-[1.18fr_.82fr] gap-2.5">
        <div className="flex items-center justify-center overflow-hidden rounded-[22px] border border-[#eaded4] bg-white/78 shadow-[0_18px_34px_rgba(62,42,30,.12)]">
          <ProductImage
            product={lead}
            wrapperClassName="h-full w-full"
            className="h-full w-full object-contain p-3 drop-shadow-[0_20px_24px_rgba(0,0,0,.18)]"
          />
        </div>
        <div className="grid gap-2">
          {supporting.slice(0, 3).map((product) => (
            <div key={product.id} className="overflow-hidden rounded-[18px] border border-[#eaded4] bg-white/72 shadow-[0_10px_22px_rgba(62,42,30,.08)]">
              <ProductImage
                product={product}
                wrapperClassName="h-full w-full"
                className="h-full w-full object-contain p-2"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DiscoverLookCard({ look }: { look: DiscoverLookCardData }) {
  const router = useRouter();
  const replaceItems = useFit((state) => state.replaceItems);
  const [heroFailed, setHeroFailed] = useState(false);
  const showHeroImage = Boolean(
    look.previewImageStatus === 'ready'
    && look.previewImageUrl
    && !heroFailed,
  );

  function openInBuilder() {
    replaceItems(productsToItems(look.products));
    router.push(`/?vibe=${look.vibe}&frame=${look.frameBias === 'all' ? 'androgynous' : look.frameBias}`);
  }

  return (
    <article className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#171512_0%,#0f0e0d_100%)] p-3.5 shadow-[0_18px_46px_rgba(0,0,0,.32)]">
      {showHeroImage ? (
        <div className="relative h-[286px] overflow-hidden rounded-[24px] border border-white/10 bg-[#151311]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={look.previewImageUrl}
            alt={`${look.title} editorial outfit preview`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setHeroFailed(true)}
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/64 to-transparent" />
        </div>
      ) : (
        <ProductFallbackHero products={look.products} />
      )}

      <div className="px-1 pb-1 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[.2em] text-accent">{look.vibe}</div>
            <h2 className="mt-1 font-serif text-[25px] font-semibold leading-[1.05] text-[#fff5ee]">{look.title}</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[.14em] text-[#cdbcaf]">
            {look.products.length} pcs
          </div>
        </div>

        <p className="mt-2 text-[12px] leading-relaxed text-[#c7b7ad]">{look.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[.14em] text-[#a9988e]">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{frameLabel(look.frameBias)}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">${(look.estimatedTotal / 100).toLocaleString()} est.</span>
          {look.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{tag}</span>
          ))}
        </div>

        <div className="mt-3 flex gap-2 overflow-hidden">
          {look.products.slice(0, 5).map((product) => (
            <div key={product.id} className="h-14 w-14 flex-none overflow-hidden rounded-[16px] border border-[#eadfd5] bg-[#fbf4ee]">
              <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1.5" />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={openInBuilder}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-[11px] font-semibold uppercase tracking-[.13em] text-white shadow-pink-glow transition hover:bg-accent-hot"
        >
          <Sparkles size={14} />
          Open in Builder
          <ArrowRight size={13} />
        </button>
      </div>
    </article>
  );
}

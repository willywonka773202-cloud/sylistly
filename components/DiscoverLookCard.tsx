'use client';

import { useState } from 'react';
import { ArrowRight, Bookmark, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ProductImage } from '@/components/ProductImage';
import { useFit } from '@/store/fit';
import { isTransparentRenderableProduct } from '@/lib/product-image-quality';
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
    <div className="relative h-[360px] overflow-hidden rounded-[26px] border border-[#efe4da] bg-[radial-gradient(circle_at_28%_8%,rgba(255,255,255,.95),transparent_30%),linear-gradient(145deg,#fffaf4_0%,#eee0d4_58%,#211815_100%)] p-3">
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/42 to-transparent" />
      <div className="absolute left-1/2 top-8 h-[270px] w-[124px] -translate-x-1/2 rounded-t-full bg-[linear-gradient(180deg,#2a211d_0%,#171312_100%)] opacity-95 shadow-[0_26px_54px_rgba(0,0,0,.34)]" />
      <div className="absolute left-1/2 top-14 h-16 w-16 -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#d7b59e_0%,#b98770_100%)] shadow-[0_10px_28px_rgba(0,0,0,.22)]" />
      <div className="absolute left-1/2 top-[130px] h-[150px] w-[190px] -translate-x-1/2 rounded-[54%_54%_40%_40%] bg-[linear-gradient(180deg,#f4eee8_0%,#12100f_76%)] opacity-95 shadow-[inset_0_1px_0_rgba(255,255,255,.55)]" />
      <div className="absolute bottom-7 left-1/2 h-20 w-52 -translate-x-1/2 rounded-full bg-black/20 blur-xl" />

      <div className="absolute left-4 top-4 w-[42%] overflow-hidden rounded-[22px] border border-[#eaded4] bg-white/82 shadow-[0_18px_34px_rgba(62,42,30,.14)]">
        <div className="h-[168px]">
          <ProductImage
            product={lead}
            transparentOnly
            wrapperClassName="h-full w-full"
            className="h-full w-full object-contain p-3 drop-shadow-[0_20px_24px_rgba(0,0,0,.18)]"
          />
        </div>
      </div>

      <div className="absolute bottom-4 right-4 grid w-[42%] gap-2">
        {supporting.slice(0, 3).map((product) => (
          <div key={product.id} className="h-[74px] overflow-hidden rounded-[18px] border border-[#eaded4] bg-white/76 shadow-[0_10px_22px_rgba(62,42,30,.1)]">
              <ProductImage
                product={product}
                transparentOnly
                wrapperClassName="h-full w-full"
                className="h-full w-full object-contain p-2"
              />
            </div>
        ))}
      </div>
    </div>
  );
}

export function DiscoverLookCard({ look }: { look: DiscoverLookCardData }) {
  const router = useRouter();
  const replaceItems = useFit((state) => state.replaceItems);
  const [heroFailed, setHeroFailed] = useState(false);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const showHeroImage = Boolean(
    look.previewImageStatus === 'ready'
    && look.previewImageUrl
    && !heroFailed,
  );

  function openInBuilder() {
    const renderableProducts = look.products.filter(isTransparentRenderableProduct);
    const slots = renderableProducts.map((product) => product.category).join(',');
    replaceItems(productsToItems(renderableProducts));
    router.push(`/build?vibe=${look.vibe}&frame=${look.frameBias === 'all' ? 'androgynous' : look.frameBias}&slots=${encodeURIComponent(slots)}`);
  }

  return (
    <article className="w-full overflow-hidden rounded-[32px] border border-accent/30 bg-[linear-gradient(180deg,#171512_0%,#0e0d0c_100%)] shadow-[0_24px_64px_rgba(0,0,0,.4)]">
      {showHeroImage ? (
        <div className="relative aspect-[4/5] overflow-hidden bg-[#151311]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={look.previewImageUrl}
            alt={`${look.title} editorial outfit preview`}
            className="h-full w-full object-cover object-center"
            loading="lazy"
            onError={() => setHeroFailed(true)}
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent sm:h-32" />
          <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-white backdrop-blur">
            {look.vibe}
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-[#f8f0e4]/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#716257]">
            {look.products.length} pcs
          </span>
        </div>
      ) : (
        <ProductFallbackHero products={look.products} />
      )}

      <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <h2 className="font-serif text-[31px] font-semibold leading-[1.02] text-[#fff5ee] sm:text-[34px]">{look.title}</h2>

        <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-[#d5c7bd] sm:text-[14px]">{look.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[10px] uppercase tracking-[.14em] text-[#a9988e]">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{frameLabel(look.frameBias)}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">${(look.estimatedTotal / 100).toLocaleString()} est.</span>
          {look.tags.slice(0, 2).map((tag, index) => (
            <span key={`${look.id}-tag-${tag}-${index}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{tag}</span>
          ))}
        </div>

        <div className="mt-5 flex gap-2.5 overflow-hidden opacity-90">
          {look.products.filter((product) => !failedImageIds.has(product.id)).slice(0, 4).map((product) => (
            <div key={product.id} className="h-16 w-16 flex-none overflow-hidden rounded-[16px] border border-[#eadfd5] bg-[#fbf4ee] shadow-[0_8px_18px_rgba(0,0,0,.14)] sm:h-[70px] sm:w-[70px]">
              <ProductImage
                product={product}
                transparentOnly
                wrapperClassName="h-full w-full"
                className="h-full w-full object-contain p-1.5"
                onUnavailable={(failedProduct) => {
                  setFailedImageIds((current) => new Set(current).add(failedProduct.id));
                }}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={openInBuilder}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 py-4 text-[12px] font-semibold text-white shadow-pink-glow transition hover:bg-accent-hot"
          >
            <Sparkles size={14} />
            Open in Remix
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            aria-label={`Bookmark ${look.title}`}
            className="grid h-12 w-12 flex-none place-items-center rounded-full border border-white/10 bg-white/[0.03] text-[#eadbd2] transition hover:border-accent hover:text-accent"
          >
            <Bookmark size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductImage } from '@/components/ProductImage';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSocialFeed } from '@/store/social-feed';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

export interface TransparentProofProduct {
  product: Product;
  publicFileExists: boolean;
}

function productsFromItems(items: Partial<Record<Category, Product>>): Product[] {
  return CATEGORY_ORDER.map((category) => items[category]).filter((product): product is Product => Boolean(product));
}

function onlyTransparent(products: Product[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const product of products) {
    if (!product.imageTransparentUrl || seen.has(product.id)) continue;
    seen.add(product.id);
    out.push(product);
  }
  return out;
}

function ProofMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#d8eadf] bg-white/80 px-3 py-2">
      <div className="text-[9px] font-black uppercase tracking-[.16em] text-[#2f6f55]">{label}</div>
      <div className="mt-1 break-words text-sm font-black text-[#243f33]">{value}</div>
    </div>
  );
}

function MiniProduct({ product }: { product: Product }) {
  return (
    <article className="w-[118px] flex-none rounded-[18px] border border-[#d8eadf] bg-white/74 p-2 shadow-[0_12px_28px_rgba(31,72,54,.08)]">
      <div className="h-[104px]">
        <ProductImage product={product} displayMode="cutout" />
      </div>
      <div className="mt-2 truncate text-[9px] font-black uppercase tracking-[.14em] text-[#2f6f55]">{product.category}</div>
      <div className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight text-[#4b6253]">{product.brand}</div>
    </article>
  );
}

function ObservedProductImage({ product }: { product: Product }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [observedKind, setObservedKind] = useState('pending');

  useEffect(() => {
    const readKind = () => {
      const node = ref.current?.querySelector('[data-image-kind]');
      setObservedKind(node?.getAttribute('data-image-kind') || 'missing');
    };
    readKind();
    const timeout = window.setTimeout(readKind, 120);
    return () => window.clearTimeout(timeout);
  }, [product.id, product.imageUrl, product.imageTransparentUrl, product.imageCutoutUrl]);

  return (
    <div className="rounded-2xl bg-[#f8fbf7] p-2">
      <div className="mb-1 text-[8px] font-black uppercase tracking-[.14em] text-[#2f6f55]">ProductImage</div>
      <div ref={ref} className="h-24">
        <ProductImage product={product} displayMode="cutout" />
      </div>
      <div className="mt-1 truncate text-[8px] font-black uppercase tracking-[.12em] text-[#2f6f55]">
        data-image-kind=&quot;{observedKind}&quot;
      </div>
    </div>
  );
}

function RuntimeStrip({ title, products, empty }: { title: string; products: Product[]; empty: string }) {
  const transparent = onlyTransparent(products);
  return (
    <section className="rounded-[22px] border border-[#d8eadf] bg-[#f8fbf7] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-[#243f33]">{title}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#607669]">
            {transparent.length} transparent-backed products from {products.length} currently visible products.
          </p>
        </div>
        <span className="rounded-full bg-[#2f6f55] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-white">
          {transparent.length}
        </span>
      </div>
      {transparent.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {transparent.slice(0, 12).map((product) => (
            <MiniProduct key={`${title}-${product.id}`} product={product} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl border border-dashed border-[#cadfd3] bg-white/58 p-3 text-xs font-semibold leading-5 text-[#607669]">
          {empty}
        </p>
      )}
    </section>
  );
}

export function CatalogRuntimeProof({ proofProducts }: { proofProducts: TransparentProofProduct[] }) {
  const feedPosts = useSocialFeed((state) => state.posts);
  const buildItems = useFit((state) => state.items);
  const wardrobeItems = useWardrobe(selectWardrobeItems);

  const feedProducts = useMemo(
    () => feedPosts.slice(0, 50).flatMap((post) => productsFromItems(post.items)),
    [feedPosts],
  );
  const buildProducts = useMemo(() => productsFromItems(buildItems), [buildItems]);
  const closetProducts = useMemo(() => wardrobeItems.map((item) => item.product), [wardrobeItems]);

  const runtimeTransparentCount = proofProducts.length;
  const missingFiles = proofProducts.filter((entry) => !entry.publicFileExists).length;

  return (
    <section className="rounded-[28px] border border-[#b7d8c7] bg-[#eef8f1] p-4 shadow-[0_22px_70px_rgba(31,72,54,.12)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#2f6f55]">Transparent Runtime Proof</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1f342b]">ProductImage is rendering real cutout assets</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#607669]">
            This is live runtime catalog data. Each ProductImage below carries its own observable
            <code className="mx-1 rounded bg-white/70 px-1 py-0.5">data-image-kind=&quot;transparent&quot;</code>
            marker when the transparent asset is selected.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ProofMetric label="Proof products" value={runtimeTransparentCount} />
          <ProofMetric label="Missing files" value={missingFiles} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <RuntimeStrip
          title="Products visible in Feed with transparent assets"
          products={feedProducts}
          empty="Current feed composition has no transparent-backed pieces in the sampled posts. Use /feed?transparentExperiment=1 after this sprint for a cutout-only preview."
        />
        <RuntimeStrip
          title="Products visible in Build with transparent assets"
          products={buildProducts}
          empty="No Builder products are selected locally. Generate or load a fit, then this strip will show transparent-backed current pieces."
        />
        <RuntimeStrip
          title="Products visible in Closet with transparent assets"
          products={closetProducts}
          empty="No closet or wishlist products with transparent assets are stored locally yet. Add from Discover or the experiment preview to verify."
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {proofProducts.slice(0, 50).map(({ product, publicFileExists }) => (
          <article key={product.id} className="rounded-[22px] border border-[#d8eadf] bg-white/82 p-3 shadow-[0_16px_38px_rgba(31,72,54,.09)]">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[#fbf5ec] p-2">
                <div className="mb-1 text-[8px] font-black uppercase tracking-[.14em] text-[#8b6b55]">Original</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageUrl} alt="" className="h-24 w-full object-contain" data-image-kind="original" />
              </div>
              <div className="rounded-2xl bg-[linear-gradient(45deg,#eef7f1_25%,#fff_25%,#fff_50%,#eef7f1_50%,#eef7f1_75%,#fff_75%)] bg-[length:18px_18px] p-2">
                <div className="mb-1 text-[8px] font-black uppercase tracking-[.14em] text-[#2f6f55]">PNG</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageTransparentUrl} alt="" className="h-24 w-full object-contain drop-shadow-[0_20px_18px_rgba(0,0,0,.36)]" data-image-kind="transparent" />
              </div>
              <ObservedProductImage product={product} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[#2f6f55] px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-white">transparent</span>
              <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] ${publicFileExists ? 'bg-[#e7f5ed] text-[#245f49]' : 'bg-[#ffe3df] text-[#8c2d22]'}`}>
                file {publicFileExists ? 'exists' : 'missing'}
              </span>
              <span className="rounded-full bg-[#f3eee7] px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-[#715846]">{product.category}</span>
            </div>
            <div className="mt-2">
              <div className="truncate text-sm font-black text-[#1f342b]">{product.brand}</div>
              <div className="line-clamp-2 text-xs font-semibold leading-5 text-[#607669]">{product.name}</div>
            </div>
            <div className="mt-2 rounded-2xl bg-[#f6f0e9] p-2 text-[9px] font-semibold leading-4 text-[#6b5748]">
              <div className="break-all">id: {product.id}</div>
              <div className="mt-1 break-all">imageTransparentUrl: {product.imageTransparentUrl}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

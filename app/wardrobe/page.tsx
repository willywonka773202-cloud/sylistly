'use client';

import { AlertCircle, Check, Plus, RotateCcw, Shirt, ShoppingBag, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { ProductImage } from '@/components/ProductImage';
import { ALL_CATALOG_PRODUCTS, buildCatalogLook } from '@/lib/catalog';
import { repairOrRegenerateOutfit } from '@/lib/catalog-health';
import { getProductOutboundUrl } from '@/lib/product-links';
import { isHighConfidenceRenderableProduct } from '@/lib/product-image-quality';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useWardrobe, WARDROBE_STATUS_LABELS, type WardrobeStatus } from '@/store/wardrobe';

const CATEGORY_LABELS: Record<Category, string> = {
  hat: 'Headwear',
  outer: 'Outer',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewelry: 'Jewelry',
};

const STARTER_CATEGORIES: Category[] = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat'];
const STATUS_OPTIONS: Array<{ value: WardrobeStatus; label: string; helper: string }> = [
  { value: 'owned', label: 'I own it', helper: 'Use directly' },
  { value: 'similar', label: 'Similar', helper: 'Close match' },
  { value: 'wishlist', label: 'Wishlist', helper: 'Shop later' },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US')}`;
}

function productMatchesStarter(product: Product): boolean {
  const text = [
    product.brand,
    product.name,
    product.sourceQuery,
    ...(product.searchTerms || []),
    ...(product.vibes || []),
    ...(product.occasions || []),
  ].join(' ').toLowerCase();

  return (
    STARTER_CATEGORIES.includes(product.category)
    || text.includes('basic')
    || text.includes('samba')
    || text.includes('air force')
    || text.includes('jeans')
    || text.includes('tee')
    || text.includes('sweatshirt')
  );
}

function chooseWardrobeFit(products: Product[]): Partial<Record<Category, Product>> {
  const next: Partial<Record<Category, Product>> = {};

  for (const category of CATEGORY_ORDER) {
    const match = products.find((product) => product.category === category);
    if (match) next[category] = match;
  }

  return next;
}

function chooseWardrobePlusCatalogFit(products: Product[]): Partial<Record<Category, Product>> {
  const wardrobeBase = chooseWardrobeFit(products);
  const usedIds = Object.values(wardrobeBase)
    .filter((product): product is Product => Boolean(product))
    .map((product) => product.id);
  const catalogFill = buildCatalogLook({
    vibe: 'clean',
    frame: 'androgynous',
    budget: 'under250',
    mode: 'missing',
    currentItems: wardrobeBase,
    avoidProductIds: usedIds,
    targetSlots: CATEGORY_ORDER,
    seed: Date.now(),
  }).products;

  return repairOrRegenerateOutfit({
    items: {
      ...wardrobeBase,
      ...catalogFill,
    },
    vibe: 'clean',
    frame: 'any',
    budget: 'under250',
    seed: Date.now(),
  });
}

function chooseGapProduct(products: Product[], category: Category, terms: string[]): Product | null {
  return products
    .filter((product) => product.category === category)
    .map((product) => {
      const haystack = [product.brand, product.name, ...(product.vibes || []), ...(product.occasions || []), ...(product.searchTerms || [])].join(' ').toLowerCase();
      const termScore = terms.reduce((score, term) => score + (haystack.includes(term) ? 10 : 0), 0);
      return { product, score: termScore + (product.imageQuality === 'good' ? 8 : 0) + (product.priceCents ? 2 : 0) };
    })
    .sort((left, right) => right.score - left.score)[0]?.product || null;
}

function buildWardrobeGaps(ownedProducts: Product[], catalogProducts: Product[]) {
  const ownedCategories = new Set(ownedProducts.map((product) => product.category));
  const ownedHaystack = ownedProducts.map((product) => [product.brand, product.name, ...(product.vibes || []), ...(product.occasions || [])].join(' ').toLowerCase()).join(' ');

  const hasGym = ownedHaystack.includes('gym') || ownedHaystack.includes('athletic') || ownedHaystack.includes('training');
  const hasTravel = ownedHaystack.includes('travel') || ownedHaystack.includes('airport');
  const hasTechwear = ownedHaystack.includes('techwear') || ownedHaystack.includes('utility');
  const hasDate = ownedHaystack.includes('date') || ownedHaystack.includes('night');

  const specs: Array<{ category: Category; title: string; helper: string; terms: string[]; condition?: boolean }> = [
    { category: 'outer', title: 'Add a neutral outer layer', helper: 'Unlock work, dinner, travel, and rainy day fits.', terms: ['blazer', 'jacket', 'trench', 'neutral', 'clean'] },
    { category: 'shoes', title: 'Add versatile shoes', helper: 'Your closet needs a repeatable sneaker, boot, or loafer anchor.', terms: ['sneaker', 'loafer', 'boot', 'clean', 'versatile'] },
    { category: 'bottom', title: 'Add black pants', helper: 'A dark bottom makes night, office, and clean fits easier.', terms: ['black', 'trouser', 'jean', 'pant'] },
    { category: 'bag', title: 'Add an everyday bag', helper: 'Travel, campus, and errands work better with a real carry piece.', terms: ['bag', 'tote', 'crossbody', 'backpack'] },
    { category: 'jewelry', title: 'Add a finishing accessory', helper: 'Small details make saved outfits feel styled instead of generated.', terms: ['watch', 'ring', 'chain', 'gold', 'silver'] },
    { category: 'eyewear', title: 'Add staple sunglasses', helper: 'Elevate outdoor, travel, and vacation fits instantly.', terms: ['sunglasses', 'shades', 'black', 'tortoise'] },
    { category: 'top', title: 'Add gym & activewear', helper: 'Your closet is missing athletic basics for workout and run-club fits.', terms: ['training', 'active', 'gym', 'workout', 'athletic'], condition: !hasGym },
    { category: 'shoes', title: 'Add travel-ready sneakers', helper: 'Comfortable footwear for airport days and heavy walking.', terms: ['sneaker', 'running', 'comfort', 'travel'], condition: !hasTravel },
    { category: 'outer', title: 'Add a utility shell', helper: 'Unlock techwear and modern utilitarian silhouettes.', terms: ['shell', 'utility', 'techwear', 'gore', 'jacket'], condition: !hasTechwear },
    { category: 'top', title: 'Add an elevated top', helper: 'Build better date night and premium evening outfits.', terms: ['silk', 'cashmere', 'blouse', 'polo', 'button down', 'date'], condition: !hasDate },
  ];

  return specs
    .filter((spec) => spec.condition !== false)
    .filter((spec) => !ownedCategories.has(spec.category) || spec.condition !== undefined)
    .map((spec) => ({ ...spec, product: chooseGapProduct(catalogProducts, spec.category, spec.terms) }))
    .filter((gap): gap is typeof specs[number] & { product: Product } => Boolean(gap.product))
    .slice(0, 4);
}
export default function WardrobePage() {
  const router = useRouter();
  const replaceItems = useFit((state) => state.replaceItems);
  const wardrobeItems = useWardrobe((state) => state.items);
  const toggleItemStatus = useWardrobe((state) => state.toggleItemStatus);
  const setItemStatus = useWardrobe((state) => state.setItemStatus);
  const removeItem = useWardrobe((state) => state.removeItem);
  const [activeStatus, setActiveStatus] = useState<WardrobeStatus>('owned');
  const [toast, setToast] = useState<string | null>(null);

  const renderableProducts = useMemo(
    () => ALL_CATALOG_PRODUCTS.filter(isHighConfidenceRenderableProduct),
    [],
  );
  const starterProducts = useMemo(
    () => renderableProducts.filter(productMatchesStarter).slice(0, 64),
    [renderableProducts],
  );
  const ownedProducts = useMemo(
    () => Object.values(wardrobeItems)
      .filter((item) => item.status === 'owned' || item.status === 'similar')
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((item) => item.product),
    [wardrobeItems],
  );
  const recentProducts = ownedProducts.slice(0, 8);
  const wardrobeGaps = useMemo(() => buildWardrobeGaps(ownedProducts, renderableProducts), [ownedProducts, renderableProducts]);
  const selectedCount = Object.keys(wardrobeItems).length;
  const ownedCount = Object.values(wardrobeItems).filter((item) => item.status === 'owned').length;
  const similarCount = Object.values(wardrobeItems).filter((item) => item.status === 'similar').length;
  const wishlistCount = Object.values(wardrobeItems).filter((item) => item.status === 'wishlist').length;
  const ownedShelf = Object.values(wardrobeItems).filter((item) => item.status === 'owned').map((item) => item.product);
  const similarShelf = Object.values(wardrobeItems).filter((item) => item.status === 'similar').map((item) => item.product);
  const wishlistShelf = Object.values(wardrobeItems).filter((item) => item.status === 'wishlist').map((item) => item.product);

  function generateFromWardrobe() {
    const products = ownedProducts.length ? ownedProducts : Object.values(wardrobeItems).map((item) => item.product);
    const nextFit = chooseWardrobePlusCatalogFit(products);
    if (!Object.keys(nextFit).length) return;
    replaceItems(nextFit);
    router.push(`/build?slots=${Object.keys(nextFit).join(',')}`);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }

  function buildAroundProduct(product: Product) {
    replaceItems({ [product.category]: product });
    router.push(`/build?slots=${product.category}`);
  }

  function shopProduct(product: Product) {
    window.open(getProductOutboundUrl(product), '_blank', 'noopener,noreferrer');
  }

  function removeWardrobeItem(productId: string) {
    removeItem(productId);
    showToast('Removed from wardrobe');
  }

  function setWardrobeStatus(product: Product, status: WardrobeStatus) {
    setItemStatus(product, status);
    showToast(status === 'owned' ? 'Added to closet' : status === 'wishlist' ? 'Added to wishlist' : 'Marked as similar');
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-10">
        <header className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(246,48,107,.16),transparent_34%),linear-gradient(180deg,#191513_0%,#0f0e0d_100%)] p-4 shadow-[0_28px_64px_rgba(0,0,0,.38)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[9px] uppercase tracking-[.18em] text-accent">Closet</div>
              <h1 className="mt-2 font-serif text-[32px] font-semibold leading-[.94] text-ink">
                Build from what you own
              </h1>
              <p className="mt-3 max-w-[30ch] text-[12px] leading-relaxed text-[#cfc0b8]">
                Mark owned pieces, close matches, and wishlist items so Sylistly can build outfits around your real wardrobe.
              </p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[22px] border border-accent/30 bg-accent/12 text-accent">
              <Shirt size={22} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              ['Owned', ownedCount],
              ['Similar', similarCount],
              ['Wishlist', wishlistCount],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-white/10 bg-white/[0.045] px-2 py-3 text-center">
                <div className="font-serif text-[20px] font-semibold text-ink">{value as number}</div>
                <div className="mt-1 text-[8px] uppercase tracking-[.15em] text-muted">{label as string}</div>
              </div>
            ))}
          </div>
        </header>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-surface-1 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[.18em] text-muted">Quick start</div>
              <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">Suggested pieces</h2>
            </div>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.min(100, (selectedCount / 8) * 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveStatus(option.value)}
                className={`rounded-2xl border px-2 py-2.5 text-left transition ${
                  activeStatus === option.value
                    ? 'border-accent bg-accent text-white shadow-pink-glow'
                    : 'border-hairline bg-surface-2 text-muted-2'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[.12em]">{option.label}</div>
                <div className={`mt-1 text-[9px] ${activeStatus === option.value ? 'text-white/76' : 'text-muted'}`}>
                  {option.helper}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-[1fr_.65fr] gap-2">
            <button
              type="button"
              onClick={selectedCount ? generateFromWardrobe : () => setActiveStatus('owned')}
              className="rounded-full bg-accent px-4 py-3 text-[11px] font-black uppercase tracking-[.12em] text-white shadow-pink-glow"
            >
              {selectedCount ? 'Add and build' : 'Start selecting'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/build')}
              className="rounded-full border border-hairline bg-surface-2 px-4 py-3 text-[11px] font-black uppercase tracking-[.12em] text-muted-2"
            >
              Skip
            </button>
          </div>
        </section>

        {selectedCount ? (
          <section className="mt-5 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#171512_0%,#0f0e0d_100%)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[9px] uppercase tracking-[.18em] text-accent">My wardrobe</div>
                <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">Closet shelves</h2>
              </div>
              <button
                type="button"
                onClick={generateFromWardrobe}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-white shadow-pink-glow"
              >
                <Sparkles size={12} />
                Generate
              </button>
            </div>
            <WardrobeShelf title="Owned pieces" products={ownedShelf} onRemove={removeWardrobeItem} />
            <WardrobeShelf title="Similar items I have" products={similarShelf} onRemove={removeWardrobeItem} />
            <WardrobeShelf title="Wishlist" products={wishlistShelf} onRemove={removeWardrobeItem} />
          </section>
        ) : null}

        {wardrobeGaps.length ? (
          <WardrobeGapAssistant
            gaps={wardrobeGaps}
            onAdd={(product) => setWardrobeStatus(product, 'wishlist')}
            onBuild={buildAroundProduct}
            onShop={shopProduct}
          />
        ) : null}

        {recentProducts.length ? (
          <section className="mt-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[.18em] text-accent">Recently added</div>
                <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">Your closet row</h2>
              </div>
              <button
                type="button"
                onClick={generateFromWardrobe}
                className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-accent"
              >
                <RotateCcw size={12} />
                Build
              </button>
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {recentProducts.map((product) => (
                <button
                  key={`recent-${product.id}`}
                  type="button"
                  onClick={() => buildAroundProduct(product)}
                  className="w-[118px] flex-none overflow-hidden rounded-[22px] border border-[#eadfd5] bg-[#fff7ef] p-2 text-left shadow-[0_14px_28px_rgba(0,0,0,.18)]"
                >
                  <div className="grid h-[104px] place-items-center rounded-[16px] bg-white">
                    <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-2" />
                  </div>
                  <div className="mt-2 line-clamp-1 text-[12px] font-semibold text-[#1d1916]">{product.brand}</div>
                  <div className="line-clamp-1 text-[10px] text-[#6f625b]">{product.name}</div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[.18em] text-muted">Basics you may have</div>
              <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">Tap to add</h2>
            </div>
            <button
              type="button"
              onClick={() => router.push('/build')}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted-2"
            >
              <Sparkles size={12} />
              Builder
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {starterProducts.map((product) => {
              const entry = wardrobeItems[product.id];
              const selected = Boolean(entry);
              return (
                <article
                  key={product.id}
                  className={`relative overflow-hidden rounded-[26px] border bg-[#fff9f4] p-2.5 text-[#1d1916] shadow-[0_16px_30px_rgba(0,0,0,.18)] transition ${
                    selected ? 'border-accent ring-2 ring-accent/35' : 'border-[#eadfd5]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      toggleItemStatus(product, activeStatus);
                      showToast(selected ? 'Updated wardrobe' : `Added as ${WARDROBE_STATUS_LABELS[activeStatus].toLowerCase()}`);
                    }}
                    className={`absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border ${
                      selected ? 'border-accent bg-accent text-white' : 'border-[#d8cec7] bg-white/82 text-[#9f938b]'
                    }`}
                    aria-label={`Toggle ${product.brand} ${product.name}`}
                  >
                    {selected ? <Check size={15} strokeWidth={3} /> : <Plus size={15} />}
                  </button>
                  <div className="grid h-[164px] place-items-center rounded-[20px] bg-white">
                    <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-3" />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-[13px] font-bold">{product.brand}</div>
                      <div className="mt-0.5 line-clamp-1 text-[12px] text-[#70645d]">{product.name}</div>
                    </div>
                    <div className="shrink-0 rounded-full bg-[#f1e8df] px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-[#75675f]">
                      {CATEGORY_LABELS[product.category]}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-[#8a7c73]">{formatPrice(product.priceCents)}</div>
                    {entry ? (
                      <div className="text-[10px] font-bold uppercase tracking-[.12em] text-accent">
                        {WARDROBE_STATUS_LABELS[entry.status]}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={`${product.id}-${option.value}`}
                        type="button"
                        onClick={() => setWardrobeStatus(product, option.value)}
                        className={`rounded-full px-2 py-1.5 text-[8px] font-bold uppercase tracking-[.08em] ${
                          entry?.status === option.value
                            ? 'bg-accent text-white'
                            : 'bg-[#f0e7df] text-[#766961]'
                        }`}
                      >
                        {option.value}
                      </button>
                    ))}
                  </div>
                  {entry ? (
                    <button
                      type="button"
                      onClick={() => removeWardrobeItem(product.id)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-full border border-[#e3d6cb] bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#7a6b62]"
                    >
                      <X size={11} />
                      Not mine
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[142px] z-40 mx-auto flex w-fit max-w-[calc(100%-32px)] items-center gap-2 rounded-full border border-accent/30 bg-[#171311]/95 px-3 py-2 text-[11px] font-semibold text-white shadow-pink-glow backdrop-blur">
          <Check size={13} className="text-accent" />
          {toast}
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-[480px] px-4 pb-3">
        <div className="pointer-events-auto grid grid-cols-[1fr_.8fr] gap-2 rounded-[28px] border border-white/12 bg-[#11100f]/92 p-2 shadow-[0_-18px_48px_rgba(0,0,0,.38)] backdrop-blur-xl">
          <button
            type="button"
            onClick={generateFromWardrobe}
            disabled={!ownedProducts.length}
            className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-accent px-4 py-3.5 text-[11px] font-bold uppercase tracking-[.12em] text-white shadow-pink-glow disabled:bg-white/[0.06] disabled:text-muted disabled:shadow-none"
          >
            <Sparkles size={14} />
            Generate closet fit
          </button>
          <button
            type="button"
            onClick={() => router.push('/discover')}
            className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-3.5 text-[11px] font-bold uppercase tracking-[.12em] text-muted-2"
          >
            <ShoppingBag size={14} />
            Add ideas
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function WardrobeShelf({
  title,
  products,
  onRemove,
}: {
  title: string;
  products: Product[];
  onRemove: (productId: string) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-2">{title}</h3>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-muted">
          {products.length}
        </span>
      </div>
      {products.length ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {products.slice(0, 12).map((product) => (
            <div key={`${title}-${product.id}`} className="relative w-[92px] flex-none rounded-[18px] border border-[#eadfd5] bg-[#fff7ef] p-1.5 shadow-[0_12px_24px_rgba(0,0,0,.18)]">
              <button
                type="button"
                onClick={() => onRemove(product.id)}
                className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-[#1c1714] text-white"
                aria-label={`Remove ${product.brand} ${product.name}`}
              >
                <X size={10} />
              </button>
              <div className="grid h-[78px] place-items-center rounded-[14px] bg-white">
                <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1.5" />
              </div>
              <div className="mt-1 truncate text-[9px] font-bold text-[#221d19]">{product.brand}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[11px] text-muted">
          Nothing here yet.
        </div>
      )}
    </div>
  );
}

function WardrobeGapAssistant({
  gaps,
  onAdd,
  onBuild,
  onShop,
}: {
  gaps: Array<{ title: string; helper: string; product: Product }>;
  onAdd: (product: Product) => void;
  onBuild: (product: Product) => void;
  onShop: (product: Product) => void;
}) {
  return (
    <section className="mt-5 rounded-[28px] border border-accent/20 bg-[radial-gradient(circle_at_top_right,rgba(246,48,107,.16),transparent_34%),linear-gradient(180deg,#171512_0%,#0f0e0d_100%)] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/12 text-accent">
          <AlertCircle size={18} />
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[.18em] text-accent">Closet gap assistant</div>
          <h2 className="mt-1 font-serif text-[22px] font-semibold text-ink">Unlock more outfits</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-2">These are real catalog pieces that fill missing categories in your closet.</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {gaps.map((gap) => (
          <article key={gap.product.id} className="grid grid-cols-[72px_1fr] gap-3 rounded-[22px] border border-white/10 bg-white/[0.045] p-2.5">
            <div className="overflow-hidden rounded-2xl bg-[#f7efe5]">
              <ProductImage product={gap.product} className="aspect-square h-full w-full object-contain p-2" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[.15em] text-accent">{gap.title}</div>
              <div className="mt-1 truncate font-serif text-[16px] font-semibold text-ink">{gap.product.brand} {gap.product.name}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-2">{gap.helper}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onAdd(gap.product)}
                  className="rounded-full border border-accent/40 bg-accent/12 px-2 py-1.5 text-[8px] font-black uppercase tracking-[.1em] text-accent"
                >
                  Wishlist
                </button>
                <button
                  type="button"
                  onClick={() => onBuild(gap.product)}
                  className="rounded-full bg-accent px-2 py-1.5 text-[8px] font-black uppercase tracking-[.1em] text-white shadow-pink-glow"
                >
                  Build
                </button>
                <button
                  type="button"
                  onClick={() => onShop(gap.product)}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[8px] font-black uppercase tracking-[.1em] text-muted-2"
                >
                  Shop
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

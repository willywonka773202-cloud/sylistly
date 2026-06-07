'use client';

import {
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CloudSun,
  Eye,
  ExternalLink,
  Grid3X3,
  Heart,
  Layers,
  LayoutTemplate,
  PackageCheck,
  RotateCcw,
  Share2,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tags,
  Wand2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { OutfitLookCard } from '@/components/OutfitBoard';
import { ProductImage } from '@/components/ProductImage';
import { getCheckoutUrlHost, isExactProductUrl } from '@/lib/checkout';
import { sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import type { Category, Product } from '@/lib/types';
import type { FeedPost } from '@/store/social-feed';

const VIEWER_TABS = ['Outfit', 'Closet', 'Planner', 'Collections'] as const;
type ViewerTab = (typeof VIEWER_TABS)[number];

const OCCASIONS = ['Today', 'Work', 'Night', 'Travel'] as const;

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

const FEATURE_CHIPS = [
  'Real product links',
  'Calendar ready',
  'Packing list',
  'AI formula',
  'Shop links',
  'Privacy controls',
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function itemsFromProducts(products: Product[]): Partial<Record<Category, Product>> {
  return Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>;
}

function compactPrice(products: Product[]): string {
  const total = products.reduce((sum, product) => sum + (product.priceCents || 0), 0);
  return formatPrice(total);
}

function getHeroProduct(products: Product[]): Product | null {
  return products.find((product) => ['outer', 'top', 'bottom', 'shoes'].includes(product.category)) ?? products[0] ?? null;
}

function computeStylingNotes(post: FeedPost, products: Product[]): string[] {
  const notes: string[] = [];
  if (post.formulaStructure?.trim()) notes.push(post.formulaStructure.trim());

  const categories = new Set(products.map((product) => product.category));
  const structure = [
    categories.has('outer') ? 'layered outerwear' : null,
    categories.has('top') ? 'defined top' : null,
    categories.has('bottom') ? 'grounded bottom' : null,
    categories.has('shoes') ? 'anchor shoe' : null,
    categories.has('bag') ? 'carry piece' : null,
  ].filter(Boolean);

  if (structure.length >= 3) notes.push(`${structure.slice(0, 4).join(', ')} keep the look complete without relying on flat retail photos.`);
  if (post.frameBias && post.frameBias !== 'any') notes.push(`Tuned for a ${post.frameBias} frame read with ${post.vibe} styling cues.`);
  if (!notes.length && post.outfitReason?.trim()) notes.push(post.outfitReason.trim());

  return Array.from(new Set(notes)).slice(0, 3);
}

function buildDateStrip() {
  const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label: index === 0 ? 'Today' : formatter.format(date),
      day: date.getDate().toString(),
      active: index === 0,
    };
  });
}

function categoryCounts(products: Product[]) {
  const counts = new Map<Category, number>();
  for (const product of products) counts.set(product.category, (counts.get(product.category) || 0) + 1);
  return counts;
}

function productLinkAudit(products: Product[]) {
  const linkedProducts = products.filter((product) => Boolean(getProductOutboundUrl(product)));
  const exactProducts = linkedProducts.filter((product) => isExactProductUrl(getProductOutboundUrl(product)));
  return {
    linkedProducts,
    exactCount: exactProducts.length,
    searchCount: linkedProducts.length - exactProducts.length,
  };
}

function hasExactOnlyContract(products: Product[], audit = productLinkAudit(products)): boolean {
  return products.length > 0 && audit.exactCount === products.length && audit.linkedProducts.length === products.length;
}

export function FitViewer({
  post,
  products: rawProducts,
  relatedPosts = [],
  source = 'feed',
  onClose,
  onLike,
  onSave,
  onRemix,
  onShop,
  onBuildAroundHero,
  onOpenEditor,
  onJumpToPost,
  onImageUnavailable,
}: {
  post: FeedPost | null;
  products: Product[];
  relatedPosts?: FeedPost[];
  source?: 'feed' | 'profile';
  onClose: () => void;
  onLike?: (post: FeedPost) => void;
  onSave?: (post: FeedPost) => void;
  onRemix?: (post: FeedPost) => void;
  onShop?: (post: FeedPost, product?: Product) => void;
  onBuildAroundHero?: (post: FeedPost) => void;
  onOpenEditor?: (post: FeedPost) => void;
  onJumpToPost?: (postId: string) => void;
  onImageUnavailable?: (product: Product) => void;
}) {
  const [activeTab, setActiveTab] = useState<ViewerTab>('Outfit');
  const [occasion, setOccasion] = useState<(typeof OCCASIONS)[number]>('Today');
  const [shared, setShared] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [outfitView, setOutfitView] = useState<'silhouette' | 'flatlay'>('silhouette');

  const products = useMemo(() => sortTransparentFeedRenderableProducts(rawProducts), [rawProducts]);
  const dates = useMemo(buildDateStrip, []);
  const notes = useMemo(() => (post ? computeStylingNotes(post, products) : []), [post, products]);
  const counts = useMemo(() => categoryCounts(products), [products]);
  const linkAudit = useMemo(() => productLinkAudit(products), [products]);
  const exactOnly = hasExactOnlyContract(products, linkAudit);
  const hero = useMemo(() => getHeroProduct(products), [products]);
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? hero ?? products[0] ?? null,
    [hero, products, selectedProductId],
  );
  const heroOutboundUrl = hero ? getProductOutboundUrl(hero) : '';
  const heroExact = hero ? isExactProductUrl(heroOutboundUrl) : false;

  if (!post) return null;
  const viewerPost = post;

  const itemMap = itemsFromProducts(products);
  const tags = Array.from(new Set([viewerPost.vibe, ...(viewerPost.tags || [])])).slice(0, 7);
  const brands = Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).slice(0, 5);
  const hasFullCore = Boolean(itemMap.top && itemMap.bottom && itemMap.shoes);
  const plannerOutfitCount = Math.max(1, Math.min(3, relatedPosts.length + 1));

  async function shareFit() {
    const text = `${viewerPost.title} - ${viewerPost.vibe} fit in Sylistly`;
    try {
      if (navigator.share) {
        await navigator.share({ title: viewerPost.title, text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 1400);
    } catch {
      setShared(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/72 backdrop-blur-sm"
      data-fit-viewer
      data-fit-viewer-source={source}
      data-fit-viewer-product-count={products.length}
      data-fit-viewer-linked-count={linkAudit.linkedProducts.length}
      data-fit-viewer-exact-count={linkAudit.exactCount}
      data-fit-viewer-exact-only={exactOnly ? 'true' : 'false'}
      data-fit-viewer-link-quality={`${linkAudit.exactCount}/${linkAudit.linkedProducts.length}`}
    >
      <button className="absolute inset-0" aria-label="Close fit viewer" onClick={onClose} />
      <section className="relative z-10 flex max-h-[calc(100dvh-18px)] w-full flex-col overflow-hidden rounded-t-[32px] border border-white/12 bg-[#100f0e] shadow-[0_-24px_70px_rgba(0,0,0,.58)]">
        <div className="flex-none border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(246,48,107,.18),transparent_36%),linear-gradient(180deg,#1a1513_0%,#100f0e_100%)] px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.22em] text-accent">
                <Eye size={11} />
                {source === 'profile' ? 'Profile viewer' : 'Fit viewer'}
              </div>
              <h2 className="mt-1 line-clamp-2 font-serif text-[27px] font-semibold leading-[.96] text-ink">{post.title}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-accent/38 bg-accent/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-accent">
                  {post.formulaLabel || post.vibe}
                </span>
                <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white/72">
                  {products.length} cutouts
                </span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-emerald-100">
                  {linkAudit.exactCount}/{products.length} exact links
                </span>
                <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-white/72">
                  {compactPrice(products)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 flex-none place-items-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition active:scale-90 hover:bg-white/10"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Fit viewer sections">
            {VIEWER_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-none rounded-full px-3.5 py-2 text-[10px] font-black uppercase tracking-[.13em] transition active:scale-95 ${
                  activeTab === tab
                    ? 'bg-accent text-white shadow-pink-glow'
                    : 'border border-white/10 bg-white/[0.045] text-white/62 hover:border-accent/45 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(246,48,107,.14),transparent_34%),linear-gradient(180deg,#1a1513_0%,#0c0b0a_100%)] p-3">
            {/* view toggle */}
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-[.18em] text-accent">
                {outfitView === 'silhouette' ? 'Outfit on body' : 'Flat lay'}
              </span>
              <div className="flex gap-1">
                {(['silhouette', 'flatlay'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOutfitView(v)}
                    aria-label={v === 'silhouette' ? 'Show outfit on body' : 'Show flat lay'}
                    className={`grid h-7 w-7 place-items-center rounded-full border text-[10px] transition active:scale-90 ${
                      outfitView === v
                        ? 'border-accent bg-accent text-white shadow-pink-glow'
                        : 'border-white/12 bg-white/[0.04] text-white/55 hover:border-accent/55 hover:text-white'
                    }`}
                  >
                    <LayoutTemplate size={12} />
                  </button>
                ))}
              </div>
            </div>
            <OutfitLookCard
              items={products}
              title={post.title}
              subtitle={post.formulaLabel || post.vibe}
              className="h-[348px]"
              presentation={outfitView}
              showMeta
              onImageUnavailable={onImageUnavailable}
            />
          </div>

          <FitPieceRail
            products={products}
            selectedProduct={selectedProduct}
            onSelect={(product) => setSelectedProductId(product.id)}
            onShop={(product) => onShop?.(post, product)}
            onImageUnavailable={onImageUnavailable}
          />

          <div className="mt-3 grid grid-cols-3 gap-2">
            <ViewerStat icon={Shirt} label="Closet" value={`${products.length} pcs`} />
            <ViewerStat icon={CalendarDays} label="Planner" value={`${plannerOutfitCount} fits`} />
            <ViewerStat icon={PackageCheck} label="Pack" value={hasFullCore ? 'Ready' : 'Needs core'} accent={hasFullCore} />
          </div>

          {activeTab === 'Outfit' ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
                    <Sparkles size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[.18em] text-accent">AI formula read</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/82">
                      {post.outfitReason || post.caption || `${post.vibe} outfit with image-backed pieces ready to remix.`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {notes.map((note, index) => (
                    <div key={note} className="flex items-start gap-2 rounded-[18px] border border-white/8 bg-black/18 px-3 py-2">
                      <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-accent/20 text-[10px] font-black text-accent">
                        {index + 1}
                      </span>
                      <p className="text-[12px] leading-relaxed text-white/78">{note}</p>
                    </div>
                  ))}
                </div>
              </div>

              {hero ? (
                <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[9px] font-black uppercase tracking-[.18em] text-muted">Hero piece</div>
                    <span className="rounded-full bg-accent/16 px-2 py-0.5 text-[8px] font-black uppercase tracking-[.14em] text-accent">
                      {CATEGORY_LABELS[hero.category]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-20 w-20 flex-none rounded-[18px] border border-white/10 bg-black/24 p-1">
                      <ProductImage product={hero} transparentOnly displayMode="thumbnail" wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[10px] font-black uppercase tracking-[.16em] text-accent">{hero.brand}</div>
                      <div className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-tight text-ink">{hero.name}</div>
                      <div className="mt-1 text-[11px] text-muted-2">{formatPrice(hero.priceCents)} at {hero.retailer}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-[7px] font-black uppercase tracking-[.13em] text-white/58">
                          {getCheckoutUrlHost(heroOutboundUrl)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-[.13em] ${
                          heroExact ? 'bg-emerald-400/10 text-emerald-100 ring-1 ring-emerald-400/20' : 'bg-amber-400/10 text-amber-100 ring-1 ring-amber-400/20'
                        }`}>
                          {heroExact ? 'Exact product' : 'Blocked'}
                        </span>
                        <a
                          href={heroOutboundUrl}
                          target="_blank"
                          rel="noreferrer"
                          data-viewer-hero-link-kind={heroExact ? 'exact' : 'blocked'}
                          data-viewer-hero-link-host={getCheckoutUrlHost(heroOutboundUrl)}
                          className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[.13em] text-accent transition active:scale-95 hover:border-accent/55"
                        >
                          Open
                          <ExternalLink size={9} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div
                className="rounded-[24px] border border-white/10 bg-white/[0.045] p-3"
                data-viewer-link-audit
                data-viewer-linked-count={linkAudit.linkedProducts.length}
                data-viewer-exact-count={linkAudit.exactCount}
                data-viewer-exact-only={exactOnly ? 'true' : 'false'}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[.18em] text-accent">Real-link audit</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-white/54">
                      {exactOnly
                        ? `${linkAudit.exactCount} exact product pages · no search-only links`
                        : `${linkAudit.linkedProducts.length} linked pieces · ${linkAudit.exactCount} exact · ${linkAudit.searchCount} blocked`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onShop?.(post)}
                    className="sy-press inline-flex flex-none items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-[8px] font-black uppercase tracking-[.12em] text-emerald-100 transition active:scale-95"
                    data-viewer-open-real-links
                  >
                    <ShoppingBag size={12} />
                    Shop exact
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {linkAudit.linkedProducts.slice(0, 3).map((product) => {
                    const outboundUrl = getProductOutboundUrl(product);
                    const exact = isExactProductUrl(outboundUrl);
                    return (
                      <a
                        key={`${post.id}-audit-${product.id}`}
                        href={outboundUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-[16px] border border-white/8 bg-black/18 px-2 py-2 transition active:scale-95 hover:border-accent/40"
                        data-viewer-audit-link-kind={exact ? 'exact' : 'blocked'}
                        data-viewer-audit-link-host={getCheckoutUrlHost(outboundUrl)}
                      >
                        <div className="truncate text-[8px] font-black uppercase tracking-[.13em] text-accent">{product.brand}</div>
                        <div className="mt-0.5 truncate text-[10px] font-semibold text-ink">{CATEGORY_LABELS[product.category]}</div>
                        <div className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[.1em] ${
                          exact ? 'bg-emerald-400/10 text-emerald-100' : 'bg-amber-400/10 text-amber-100'
                        }`}>
                          {exact ? 'Exact' : 'Blocked'}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Closet' ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
                  <div key={category} className="rounded-[16px] border border-white/9 bg-white/[0.04] px-2 py-2 text-center">
                    <div className="font-serif text-[18px] font-semibold text-ink">{counts.get(category as Category) || 0}</div>
                    <div className="mt-0.5 truncate text-[7px] font-black uppercase tracking-[.12em] text-muted">{label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {products.map((product) => {
                  const outboundUrl = getProductOutboundUrl(product);
                  const exact = isExactProductUrl(outboundUrl);
                  return (
                  <a
                    key={`${post.id}-closet-${product.id}`}
                    href={outboundUrl}
                    target="_blank"
                    rel="noreferrer"
                    data-viewer-closet-link-kind={exact ? 'exact' : 'blocked'}
                    data-viewer-closet-link-host={getCheckoutUrlHost(outboundUrl)}
                    className="group min-h-[156px] rounded-[20px] border border-white/10 bg-black/22 p-1.5 transition active:scale-95 hover:border-accent/50 hover:bg-black/30"
                  >
                    <div className="h-[88px] rounded-[15px] bg-transparent">
                      <ProductImage
                        product={product}
                        transparentOnly
                        displayMode="closet"
                        wrapperClassName="h-full w-full"
                        className="h-full w-full object-contain p-2"
                        onUnavailable={onImageUnavailable}
                      />
                    </div>
                    <div className="mt-1 truncate text-[8px] font-black uppercase tracking-[.12em] text-accent">{CATEGORY_LABELS[product.category]}</div>
                    <div className="truncate text-[10px] font-semibold text-ink">{product.brand}</div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="truncate text-[8px] font-semibold text-white/42">{getCheckoutUrlHost(outboundUrl)}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[.1em] ${
                        exact ? 'bg-emerald-400/10 text-emerald-100' : 'bg-amber-400/10 text-amber-100'
                      }`}>
                        {exact ? 'Exact' : 'Blocked'}
                      </span>
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[7px] font-black uppercase tracking-[.12em] text-white/38 group-hover:text-accent">
                      Open link
                      <ExternalLink size={8} />
                    </div>
                  </a>
                  );
                })}
              </div>
            </div>
          ) : null}

          {activeTab === 'Planner' ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/8 text-white">
                      <CloudSun size={18} />
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[.18em] text-accent">Weather-aware plan</div>
                      <div className="mt-0.5 text-[13px] font-semibold text-ink">Mild day, layer check</div>
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-[9px] font-black uppercase tracking-[.13em] text-white/72">
                    {occasion}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  {OCCASIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setOccasion(option)}
                      className={`flex-1 rounded-full px-2 py-2 text-[9px] font-black uppercase tracking-[.12em] transition active:scale-95 ${
                        occasion === option ? 'bg-accent text-white shadow-pink-glow' : 'border border-white/10 bg-white/[0.04] text-muted-2'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1.5">
                  {dates.map((date) => (
                    <button
                      key={date.key}
                      type="button"
                      data-viewer-date-active={date.active ? 'true' : 'false'}
                      className={`rounded-[15px] px-1 py-2 text-center transition active:scale-95 ${
                        date.active
                          ? 'bg-[linear-gradient(135deg,#f6306b_0%,#ff7aa2_100%)] text-white shadow-pink-glow'
                          : 'border border-white/8 bg-black/18 text-white/55 hover:border-accent/35 hover:text-white'
                      }`}
                    >
                      <div className="text-[7px] font-black uppercase tracking-[.08em]">{date.label}</div>
                      <div className="mt-1 text-[13px] font-black">{date.day}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-accent/28 bg-accent/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[.18em] text-accent">Your outfit today</div>
                    <div className="mt-1 font-serif text-[22px] font-semibold leading-none text-ink">{post.title}</div>
                  </div>
                  <div className="rounded-full border border-accent/35 bg-black/18 px-3 py-1 text-[9px] font-black uppercase tracking-[.13em] text-accent">
                    {plannerOutfitCount} outfits
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  <PlannerRow label="Do not repeat" value={post.saved ? 'Saved rotation' : 'Fresh option'} done />
                  <PlannerRow label="Trip packing" value={`${products.length} items staged`} done={products.length >= 5} />
                  <PlannerRow label="Missing slots" value={hasFullCore ? 'Core complete' : 'Add top, bottom, shoes'} done={hasFullCore} />
                </div>
              </div>

              <div className="grid grid-cols-[1.25fr_.75fr] gap-2">
                <OutfitLookCard
                  items={products}
                  title="Today"
                  subtitle={occasion}
                  compact
                  className="h-[190px]"
                  onImageUnavailable={onImageUnavailable}
                />
                <div className="grid gap-2">
                  {[viewerPost, ...relatedPosts].slice(0, 2).map((entry, index) => (
                    <button
                      key={`${entry.id}-planner-mini`}
                      type="button"
                      onClick={() => (index === 0 ? undefined : onJumpToPost?.(entry.id))}
                      className="rounded-[20px] border border-white/10 bg-white/[0.045] p-3 text-left transition active:scale-95 hover:border-accent/45"
                    >
                      <div className="text-[8px] font-black uppercase tracking-[.16em] text-accent">{index === 0 ? 'Pinned' : 'Alt'}</div>
                      <div className="mt-1 line-clamp-2 text-[12px] font-semibold leading-tight text-ink">{entry.title}</div>
                      <div className="mt-2 text-[9px] text-muted-2">{entry.itemCount} pieces</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Collections' ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
                    <Layers size={17} />
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[.18em] text-accent">Capsule collection</div>
                    <div className="mt-0.5 text-[13px] font-semibold text-ink">{post.vibe} rotation</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FEATURE_CHIPS.map((chip) => (
                    <span key={chip} className="rounded-full border border-white/10 bg-black/18 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] text-white/72">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <CollectionPanel icon={Tags} label="Tags" values={tags} />
                <CollectionPanel icon={Grid3X3} label="Brands" values={brands.length ? brands : ['Catalog']} />
              </div>

              {relatedPosts.length ? (
                <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[9px] font-black uppercase tracking-[.18em] text-muted">More like this</div>
                    <div className="text-[10px] text-muted-2">{relatedPosts.length} matches</div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {relatedPosts.map((related) => (
                      <button
                        key={related.id}
                        type="button"
                        onClick={() => onJumpToPost?.(related.id)}
                        className="w-[112px] flex-none rounded-[18px] border border-white/10 bg-black/18 p-3 text-left transition active:scale-95 hover:border-accent/50"
                      >
                        <div className="text-[8px] font-black uppercase tracking-[.14em] text-accent">{related.vibe}</div>
                        <div className="mt-1 line-clamp-2 text-[12px] font-semibold leading-tight text-ink">{related.title}</div>
                        <div className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[.12em] text-white/60">
                          Open <ChevronRight size={10} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex-none border-t border-white/10 bg-[#0b0a09]/96 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="grid grid-cols-5 gap-2">
            <ActionButton label={post.liked ? 'Liked' : 'Like'} icon={Heart} active={post.liked} onClick={() => onLike?.(post)} />
            <ActionButton label={post.saved ? 'Saved' : 'Save'} icon={Bookmark} active={post.saved} onClick={() => onSave?.(post)} />
            <ActionButton label={shared ? 'Shared' : 'Share'} icon={Share2} onClick={shareFit} />
            <ActionButton label="Remix" icon={RotateCcw} primary onClick={() => onRemix?.(post)} />
            <ActionButton label="Shop" icon={ShoppingBag} onClick={() => onShop?.(post)} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onBuildAroundHero?.(post)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/45 bg-accent/14 px-3 py-2.5 text-[10px] font-black uppercase tracking-[.14em] text-white transition active:scale-[0.98] hover:border-accent/70"
            >
              <Wand2 size={13} className="text-accent" />
              Build around hero
            </button>
            <button
              type="button"
              onClick={() => onOpenEditor?.(post)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(232,54,93,.28)] bg-[rgba(232,54,93,.1)] px-3 py-2.5 text-[10px] font-black uppercase tracking-[.14em] text-white transition active:scale-[0.98] hover:border-[rgba(232,54,93,.55)]"
              data-viewer-open-editor
            >
              <Wand2 size={13} className="text-accent" />
              Open Editor
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FitPieceRail({
  products,
  selectedProduct,
  onSelect,
  onShop,
  onImageUnavailable,
}: {
  products: Product[];
  selectedProduct: Product | null;
  onSelect: (product: Product) => void;
  onShop: (product: Product) => void;
  onImageUnavailable?: (product: Product) => void;
}) {
  if (!products.length || !selectedProduct) return null;

  const selectedSignals = [
    selectedProduct.colors?.[0],
    selectedProduct.vibes?.[0],
    selectedProduct.occasions?.[0],
  ].filter(Boolean);
  const selectedOutboundUrl = getProductOutboundUrl(selectedProduct);
  const selectedExact = isExactProductUrl(selectedOutboundUrl);
  const selectedHost = getCheckoutUrlHost(selectedOutboundUrl);
  const linkedProducts = products.filter((product) => Boolean(getProductOutboundUrl(product)));
  const exactProducts = linkedProducts.filter((product) => isExactProductUrl(getProductOutboundUrl(product)));

  return (
    <section
      className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.045] p-3"
      data-viewer-piece-rail
      data-viewer-piece-rail-count={products.length}
      data-viewer-piece-rail-linked-count={linkedProducts.length}
      data-viewer-piece-rail-exact-count={exactProducts.length}
      data-viewer-piece-rail-link-quality={`${exactProducts.length}/${linkedProducts.length}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[8px] font-black uppercase tracking-[.2em] text-accent">Look pieces</div>
          <div className="mt-0.5 truncate text-[13px] font-semibold text-ink">
            Inspect real pieces before remixing
          </div>
        </div>
        <button
          type="button"
          onPointerUp={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onShop(selectedProduct);
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onShop(selectedProduct);
          }}
          className="inline-flex flex-none items-center gap-1.5 rounded-full border border-white/12 bg-black/22 px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] text-white/76 transition active:scale-95 hover:border-accent/55 hover:text-white"
          aria-label={`Shop ${selectedProduct.brand} ${selectedProduct.name}`}
          data-shop-product-id={selectedProduct.id}
          data-shop-link-kind={selectedExact ? 'exact' : 'blocked'}
          data-shop-link-host={selectedHost}
        >
          <ShoppingBag size={12} />
          Shop item
        </button>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {products.map((product) => {
          const selected = product.id === selectedProduct.id;
          const outboundUrl = getProductOutboundUrl(product);
          const exact = isExactProductUrl(outboundUrl);
          return (
            <button
              key={`${product.id}-viewer-rail`}
              type="button"
              onClick={() => onSelect(product)}
              className={`group relative h-[76px] w-[62px] flex-none rounded-[18px] border bg-black/24 p-1.5 shadow-[0_14px_28px_rgba(0,0,0,.22)] transition active:scale-95 ${
                selected
                  ? 'border-accent ring-2 ring-accent/45'
                  : 'border-white/12 hover:border-accent/55 hover:ring-2 hover:ring-accent/22'
              }`}
              aria-label={`Inspect ${product.brand} ${product.name}`}
              data-viewer-rail-product-id={product.id}
              data-viewer-rail-link-kind={exact ? 'exact' : 'blocked'}
              data-viewer-rail-link-host={getCheckoutUrlHost(outboundUrl)}
            >
              <ProductImage
                product={product}
                transparentOnly
                displayMode="thumbnail"
                wrapperClassName="h-full w-full overflow-visible bg-transparent"
                className="h-full w-full object-contain p-1.5 drop-shadow-[0_14px_14px_rgba(0,0,0,.28)] transition group-hover:scale-105"
                onUnavailable={onImageUnavailable}
              />
              <span className={`absolute -top-1 left-1 rounded-full px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[.1em] ${
                selected ? 'bg-accent text-white' : 'bg-black/62 text-white/78'
              }`}>
                {product.category}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-[82px_1fr] gap-3 rounded-[22px] border border-white/8 bg-black/18 p-3">
        <div className="h-[82px] rounded-[19px] border border-white/10 bg-black/24 p-1.5">
          <ProductImage
            product={selectedProduct}
            transparentOnly
            displayMode="closet"
            wrapperClassName="h-full w-full overflow-visible bg-transparent"
            className="h-full w-full object-contain p-1.5 drop-shadow-[0_18px_18px_rgba(0,0,0,.32)]"
            onUnavailable={onImageUnavailable}
          />
        </div>
        <div className="min-w-0 self-center">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent/18 px-2 py-0.5 text-[7px] font-black uppercase tracking-[.14em] text-accent">
              {CATEGORY_LABELS[selectedProduct.category]}
            </span>
            <span className="truncate text-[9px] font-semibold uppercase tracking-[.14em] text-white/48">
              {selectedProduct.retailer}
            </span>
          </div>
          <div className="mt-1 truncate text-[10px] font-black uppercase tracking-[.16em] text-accent">{selectedProduct.brand}</div>
          <div className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-tight text-ink">{selectedProduct.name}</div>
          <div className="mt-1 text-[11px] font-semibold text-white/58">{formatPrice(selectedProduct.priceCents)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[7px] font-black uppercase tracking-[.13em] text-white/52">
              {selectedHost}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-[.13em] ${
              selectedExact ? 'bg-emerald-400/10 text-emerald-100 ring-1 ring-emerald-400/20' : 'bg-amber-400/10 text-amber-100 ring-1 ring-amber-400/20'
            }`}>
              {selectedExact ? 'Exact product' : 'Blocked'}
            </span>
            <a
              href={selectedOutboundUrl}
              target="_blank"
              rel="noreferrer"
              data-viewer-product-link-kind={selectedExact ? 'exact' : 'blocked'}
              data-viewer-product-link-host={selectedHost}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[.13em] text-accent transition active:scale-95 hover:border-accent/55"
            >
              Open real link
              <ExternalLink size={9} />
            </a>
          </div>
          {selectedSignals.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedSignals.map((signal) => (
                <span key={signal} className="rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[7px] font-black uppercase tracking-[.12em] text-white/58">
                  {signal}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ViewerStat({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Shirt;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-[18px] border px-3 py-3 ${accent ? 'border-accent/35 bg-accent/12' : 'border-white/10 bg-white/[0.04]'}`}>
      <Icon size={15} className={accent ? 'text-accent' : 'text-white/55'} />
      <div className="mt-2 text-[8px] font-black uppercase tracking-[.14em] text-muted">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function PlannerRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-white/8 bg-black/18 px-3 py-2.5">
      <CheckCircle2 size={15} className={done ? 'text-accent' : 'text-muted'} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-ink">{label}</div>
        <div className="mt-0.5 truncate text-[10px] text-muted-2">{value}</div>
      </div>
    </div>
  );
}

function CollectionPanel({ icon: Icon, label, values }: { icon: typeof Tags; label: string; values: string[] }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.045] p-3">
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.16em] text-accent">
        <Icon size={12} />
        {label}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {values.slice(0, 6).map((value) => (
          <span key={value} className="rounded-full border border-white/10 bg-black/18 px-2 py-1 text-[8px] font-black uppercase tracking-[.12em] text-white/70">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  active = false,
  primary = false,
  onClick,
}: {
  label: string;
  icon: typeof Heart;
  active?: boolean;
  primary?: boolean;
  onClick?: () => void;
}) {
  const className = primary
    ? 'bg-accent text-white shadow-pink-glow'
    : active
      ? 'border-accent/45 bg-accent/18 text-accent'
      : 'border-white/10 bg-white/[0.04] text-white/70';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid min-h-[54px] place-items-center rounded-[18px] border px-1.5 py-2 transition active:scale-95 ${className}`}
    >
      <Icon size={16} fill={active && Icon === Heart ? 'currentColor' : 'none'} />
      <span className="mt-1 text-[8px] font-black uppercase tracking-[.12em]">{label}</span>
    </button>
  );
}

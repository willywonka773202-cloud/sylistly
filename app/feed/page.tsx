'use client';

import { Bookmark, Heart, MessageCircle, RotateCcw, Send, ShoppingBag, Sparkles, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { OutfitBoard } from '@/components/OutfitBoard';
import { ProductImage } from '@/components/ProductImage';
import { ShopFitSheet } from '@/components/ShopFitSheet';
import { getOutfitProducts, repairOrRegenerateOutfit } from '@/lib/catalog-health';
import type { Product } from '@/lib/types';
import { canonicalizeVibeId } from '@/lib/vibes';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { type FeedPost, useSocialFeed } from '@/store/social-feed';
import { useWardrobe, WARDROBE_STATUS_LABELS } from '@/store/wardrobe';

const PRIMARY_FILTERS = ['For You', 'Women', 'Men', 'Clean', 'Streetwear'];
const SECONDARY_FILTERS = [
  'Androgynous',
  'Campus',
  'Gym',
  'Date',
  'Vacation',
  'Travel',
  'Work',
  'Old Money',
  'Techwear',
  'Premium',
  'Budget',
  'Under $150',
  'Closet',
];
const QUICK_REACTIONS = ['Fire', 'Swap shoes', 'Too expensive', 'Clean fit', 'Better without hat'];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US')}`;
}

function safePostItems(post: FeedPost): ReturnType<typeof repairOrRegenerateOutfit> {
  // `canonicalizeVibeId` tolerates null/undefined and legacy/UX labels like
  // 'Saved' or 'Builder' from stale persisted posts. The previous
  // `post.vibe.toLowerCase()` would crash if post.vibe was undefined and
  // could feed a non-canonical key downstream to OUTFIT_RECIPES.
  return repairOrRegenerateOutfit({
    items: post.items,
    vibe: canonicalizeVibeId(post.vibe),
    frame: post.frameBias || 'any',
    budget: post.totalCents <= 25000 ? 'under250' : 'under500',
  });
}

function visibleProducts(post: FeedPost): Product[] {
  return getOutfitProducts(safePostItems(post));
}

function normalizedTags(post: FeedPost) {
  return [post.vibe, ...post.tags].map((tag) => tag.toLowerCase());
}

function postHasAnyTag(post: FeedPost, terms: string[]): boolean {
  const tags = normalizedTags(post);
  return terms.some((term) => tags.some((tag) => tag.includes(term)));
}

function postMatches(
  post: FeedPost,
  filter: string,
  wardrobeItems: Record<string, unknown>,
  visibleProductsMap?: Map<string, Product[]>,
): boolean {
  if (filter === 'For You') return true;
  if (filter === 'Trending') return postHasAnyTag(post, ['trend', 'trending']);
  if (filter === 'Men') return post.frameBias === 'masc';
  if (filter === 'Women') return post.frameBias === 'fem';
  if (filter === 'Androgynous') return post.frameBias === 'androgynous' || post.frameBias === 'any';
  if (filter === 'Budget') return post.totalCents <= 25000 || postHasAnyTag(post, ['budget', 'under 150', 'under 250', 'affordable']);
  if (filter === 'Under $150') return post.totalCents <= 15000;
  if (filter === 'Premium') return post.totalCents >= 50000 || postHasAnyTag(post, ['premium', 'luxury', 'designer', 'quiet luxury', 'splurge']);
  if (filter === 'Clean') return postHasAnyTag(post, ['clean', 'minimal', 'neutral']);
  if (filter === 'Streetwear') return postHasAnyTag(post, ['streetwear', 'street', 'downtown', 'sneaker']);
  if (filter === 'Campus') return postHasAnyTag(post, ['campus', 'college', 'class']);
  if (filter === 'Gym') return postHasAnyTag(post, ['gym', 'athletic', 'training', 'pilates', 'workout']);
  if (filter === 'Date') return postHasAnyTag(post, ['date', 'date night', 'dinner']);
  if (filter === 'Vacation') return postHasAnyTag(post, ['vacation', 'resort', 'beach', 'summer', 'linen']);
  if (filter === 'Travel') return postHasAnyTag(post, ['travel', 'airport', 'trip', 'capsule']);
  if (filter === 'Work') return postHasAnyTag(post, ['work', 'office', 'business casual', 'tailored', 'interview']);
  if (filter === 'Old Money') return postHasAnyTag(post, ['old money', 'preppy', 'quiet luxury', 'heritage']);
  if (filter === 'Techwear') return postHasAnyTag(post, ['techwear', 'technical', 'utility']);
  if (filter === 'Closet') {
    const products = visibleProductsMap?.get(post.id) ?? visibleProducts(post);
    return products.some((product) => Boolean(wardrobeItems[product.id]));
  }
  const needle = filter.toLowerCase().replace('night out', 'night').replace('date', 'date night');
  return normalizedTags(post).some((tag) => tag.includes(needle));
}

export default function FitFeedPage() {
  const posts = useSocialFeed((state) => state.posts);
  const toggleLike = useSocialFeed((state) => state.toggleLike);
  const toggleSave = useSocialFeed((state) => state.toggleSave);
  const addComment = useSocialFeed((state) => state.addComment);
  const replaceItems = useFit((state) => state.replaceItems);
  const setBuilderItem = useFit((state) => state.setItem);
  const saveFit = useSavedFits((state) => state.saveFit);
  const wardrobeItems = useWardrobe((state) => state.items);
  const setWardrobeStatus = useWardrobe((state) => state.setItemStatus);
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('For You');
  const [showFilters, setShowFilters] = useState(false);
  const [commentPost, setCommentPost] = useState<FeedPost | null>(null);
  const [commentText, setCommentText] = useState('');
  const [shopPost, setShopPost] = useState<FeedPost | null>(null);
  const [burstPostId, setBurstPostId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  
  const postSafeItemsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof repairOrRegenerateOutfit>>();
    for (const post of posts) {
      map.set(post.id, safePostItems(post));
    }
    return map;
  }, [posts]);
  
  const postVisibleProductsMap = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const post of posts) {
      const safeItems = postSafeItemsMap.get(post.id);
      map.set(post.id, safeItems ? getOutfitProducts(safeItems) : []);
    }
    return map;
  }, [posts, postSafeItemsMap]);
  
  const filteredPosts = useMemo(
    () => posts.filter((post) => {
      if (!postMatches(post, activeFilter, wardrobeItems, postVisibleProductsMap)) return false;
      return (postVisibleProductsMap.get(post.id)?.length || 0) >= 4;
    }),
    [posts, activeFilter, wardrobeItems, postVisibleProductsMap],
  );
  
  const activePost = filteredPosts.find((post) => post.id === activePostId) || filteredPosts[0] || null;

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        const nextId = active?.target.getAttribute('data-feed-post-id');
        if (nextId) setActivePostId(nextId);
      },
      { root, threshold: [0.55, 0.72, 0.9] },
    );
    root.querySelectorAll<HTMLElement>('[data-feed-post-id]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [filteredPosts]);

  function pulse(postId: string) {
    setBurstPostId(postId);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
    window.setTimeout(() => setBurstPostId(null), 420);
  }

  function remix(post: FeedPost) {
    pulse(post.id);
    window.setTimeout(() => {
      replaceItems(safePostItems(post));
      router.push('/build');
    }, 180);
  }

  function savePost(post: FeedPost) {
    toggleSave(post.id);
    if (!post.saved) saveFit(safePostItems(post));
    pulse(post.id);
  }

  function useProductInBuilder(product: Product) {
    setBuilderItem(product.category, product);
    router.push('/build');
  }

  function submitComment(text = commentText) {
    const trimmed = text.trim();
    if (!commentPost || !trimmed) return;
    addComment(commentPost.id, trimmed);
    setCommentText('');
    setCommentPost(null);
  }

  function selectFilter(filter: string) {
    setActiveFilter(filter);
    setActivePostId(null);
    setShowFilters(false);
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg">
      <div className="relative flex-1 overflow-hidden">
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/38 px-3 py-2 shadow-[0_16px_34px_rgba(0,0,0,.32)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[8px] uppercase tracking-[.2em] text-white/55">Fit Feed</div>
                <div className="font-serif text-[20px] font-semibold leading-none text-white">Swipe <em className="italic text-accent">fits</em></div>
              </div>
              <div className="flex max-w-[250px] gap-2 overflow-x-auto scrollbar-hide">
                {PRIMARY_FILTERS.map((filter) => (
                  <button key={filter} type="button" onClick={() => selectFilter(filter)} className={`flex-none rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${activeFilter === filter ? 'bg-accent text-white shadow-pink-glow' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}>
                    {filter}
                  </button>
                ))}
                {!PRIMARY_FILTERS.includes(activeFilter) && (
                  <button type="button" onClick={() => setShowFilters(true)} className="flex-none rounded-full bg-accent px-3 py-1.5 text-[10px] font-semibold text-white shadow-pink-glow transition">
                    {activeFilter}
                  </button>
                )}
                <button type="button" onClick={() => setShowFilters(true)} className="flex-none rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/70 transition hover:bg-white/15">
                  <SlidersHorizontal size={12} className="inline-block" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div ref={feedRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth">
          {filteredPosts.map((post) => {
            const safeItems = postSafeItemsMap.get(post.id) ?? safePostItems(post);
            const products = postVisibleProductsMap.get(post.id) ?? getOutfitProducts(safeItems);
            const totalCents = products.reduce((sum, product) => sum + (product.priceCents || 0), 0) || post.totalCents;
            const averageCents = Math.round(totalCents / Math.max(1, products.length));
            return (
              <article key={post.id} data-feed-post-id={post.id} className="relative flex h-full snap-start snap-always flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_8%,rgba(246,48,107,.18),transparent_32%),radial-gradient(circle_at_12%_72%,rgba(255,204,153,.12),transparent_30%),linear-gradient(180deg,#171310_0%,#090807_100%)]" onDoubleClick={() => savePost(post)}>
                {burstPostId === post.id ? (
                  <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-accent/10">
                    <div className="grid h-28 w-28 animate-ping place-items-center rounded-full border border-accent/40 bg-accent/15" />
                    <Heart className="absolute text-accent drop-shadow-[0_0_28px_rgba(246,48,107,.95)]" size={74} fill="currentColor" />
                  </div>
                ) : null}

                <div className="absolute inset-x-0 top-[108px] z-[5] px-4">
                  <OutfitBoard items={safeItems} className="h-[48dvh] min-h-[340px] max-h-[460px] shadow-[0_26px_72px_rgba(0,0,0,.38)]" onProductClick={() => setShopPost(post)} />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[42dvh] bg-[linear-gradient(180deg,transparent_0%,rgba(9,8,7,.72)_34%,#090807_100%)]" />

                <div className="absolute right-3 top-[45%] z-20 flex -translate-y-1/2 flex-col items-center gap-2">
                  <button onClick={() => { toggleLike(post.id); pulse(post.id); }} className={`grid h-11 w-11 place-items-center rounded-full border backdrop-blur-md transition ${post.liked ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-white/18 bg-black/38 text-white'}`} aria-label="Like fit"><Heart size={20} fill={post.liked ? 'currentColor' : 'none'} /></button>
                  <div className="-mt-2 text-center text-[10px] font-semibold text-white/80">{post.likeCount}</div>
                  <button onClick={() => setCommentPost(post)} className="grid h-11 w-11 place-items-center rounded-full border border-white/18 bg-black/38 text-white backdrop-blur-md" aria-label="Open comments"><MessageCircle size={20} /></button>
                  <button onClick={() => savePost(post)} className={`grid h-11 w-11 place-items-center rounded-full border backdrop-blur-md ${post.saved ? 'border-accent bg-accent/18 text-accent' : 'border-white/18 bg-black/38 text-white'}`} aria-label="Save fit"><Bookmark size={20} fill={post.saved ? 'currentColor' : 'none'} /></button>
                  <button onClick={() => remix(post)} className="grid h-11 w-11 place-items-center rounded-full border border-accent/45 bg-accent text-white shadow-pink-glow" aria-label="Remix in Builder"><RotateCcw size={20} /></button>
                  <button onClick={() => setShopPost(post)} className="grid h-11 w-11 place-items-center rounded-full border border-white/18 bg-black/38 text-white backdrop-blur-md" aria-label="Shop fit"><ShoppingBag size={20} /></button>
                </div>

                <div className="relative z-10 mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pr-[76px]">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full border border-accent/35 bg-accent text-[12px] font-black text-white shadow-pink-glow">{post.avatar}</div>
                    <div className="min-w-0"><div className="truncate text-[12px] font-semibold text-white">{post.username}</div><div className="text-[9px] uppercase tracking-[.16em] text-white/52">{post.sourceType || 'catalog'} fit</div></div>
                  </div>
                  <h1 className="mt-3 font-serif text-[35px] font-semibold leading-[.94] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,.42)]">{post.title}</h1>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/78">{post.caption || `${post.vibe} outfit, ready to remix in Builder.`}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[post.vibe, post.frameBias && post.frameBias !== 'any' ? `${post.frameBias} bias` : null, formatPrice(totalCents), `Avg ${formatPrice(averageCents)}`, `${products.length} pieces`].filter(Boolean).map((chip) => (
                      <span key={String(chip)} className="rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-white/78 backdrop-blur-md">{chip}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {products.slice(0, 6).map((product) => (
                      <button key={`${post.id}-tray-${product.id}`} type="button" onClick={() => setShopPost(post)} className="group relative h-[94px] w-[78px] flex-none overflow-hidden rounded-[22px] border border-[#eadfd5] bg-[#fff7ef] shadow-[0_14px_34px_rgba(0,0,0,.32)]" aria-label={`Shop ${product.brand} ${product.name}`}>
                        <ProductImage product={product} size="lg" loading="eager" wrapperClassName="h-full w-full" className="h-full w-full object-contain p-2 transition group-active:scale-95" />
                        <div className="absolute left-1 top-1 rounded-full bg-white/88 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[.12em] text-[#6f5248] shadow-sm">{wardrobeItems[product.id] ? WARDROBE_STATUS_LABELS[wardrobeItems[product.id].status] : product.category}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_.78fr] gap-2">
                    <button onClick={() => remix(post)} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow transition active:scale-[.98]"><RotateCcw size={14} />Build this</button>
                    <button onClick={() => setShopPost(post)} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white backdrop-blur-md transition active:scale-[.98]"><ShoppingBag size={14} />Shop Fit</button>
                  </div>
                </div>
              </article>
            );
          })}
          {!filteredPosts.length ? <EmptyFeed onReset={() => selectFilter('For You')} /> : null}
        </div>
      </div>

      <BottomNav />

      {showFilters ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <button className="absolute inset-0" aria-label="Close filters" onClick={() => setShowFilters(false)} />
          <div className="relative z-10 w-full rounded-t-[32px] border-t border-white/10 bg-[#141211] p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-[0_-20px_60px_rgba(0,0,0,.6)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-[22px] font-semibold text-white">More Filters</h2>
                <p className="mt-1 text-[12px] text-white/52">Every lane maps to catalog-backed outfits.</p>
              </div>
              <button onClick={() => setShowFilters(false)} className="rounded-full bg-white/10 p-2 text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {SECONDARY_FILTERS.map(filter => (
                <button
                  key={filter}
                  onClick={() => selectFilter(filter)}
                  className={`rounded-full px-4 py-2.5 text-[11px] font-semibold transition ${activeFilter === filter ? 'bg-accent text-white shadow-pink-glow' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {commentPost ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/55 backdrop-blur-sm">
          <button className="absolute inset-0" aria-label="Close comments" onClick={() => setCommentPost(null)} />
          <section className="relative z-10 w-full rounded-t-[30px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-22px_60px_rgba(0,0,0,.46)]">
            <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20" />
            <div className="font-serif text-[22px] font-semibold text-ink">Comments</div>
            <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto">{commentPost.comments.map((comment) => <div key={comment.id} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[12px] text-muted-2"><span className="font-semibold text-ink">{comment.user}</span> {comment.text}</div>)}</div>
            <div className="mt-3 flex flex-wrap gap-2">{QUICK_REACTIONS.map((reaction) => <button key={reaction} onClick={() => submitComment(reaction)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2">{reaction}</button>)}</div>
            <div className="mt-3 flex gap-2"><input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a comment" className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink outline-none focus:border-accent" /><button onClick={() => submitComment()} className="grid h-11 w-11 place-items-center rounded-full bg-accent text-white shadow-pink-glow"><Send size={15} /></button></div>
          </section>
        </div>
      ) : null}

      <ShopFitSheet open={Boolean(shopPost)} title={shopPost?.title || activePost?.title || 'Shop the fit'} products={shopPost ? visibleProducts(shopPost) : []} onClose={() => setShopPost(null)} onAddToCloset={(product) => setWardrobeStatus(product, 'owned')} onUseInBuilder={useProductInBuilder} onSaveOutfit={() => shopPost && savePost(shopPost)} />
    </main>
  );
}

function EmptyFeed({ onReset }: { onReset: () => void }) {
  return (
    <section className="flex h-full snap-start snap-always items-center justify-center bg-[linear-gradient(180deg,#171310_0%,#090807_100%)] px-6 text-center">
      <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_22px_56px_rgba(0,0,0,.34)]">
        <Sparkles className="mx-auto text-accent" size={22} />
        <h2 className="mt-3 font-serif text-[25px] font-semibold text-ink">No fits in this lane</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-2">Switch filters or post a look from Builder to refresh the feed.</p>
        <button type="button" onClick={onReset} className="mt-4 rounded-full bg-accent px-5 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-white shadow-pink-glow">Back to For You</button>
      </div>
    </section>
  );
}

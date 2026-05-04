'use client';

import { Bookmark, Check, Heart, MessageCircle, Plus, RotateCcw, Send, ShoppingBag, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { OutfitBoard } from '@/components/OutfitBoard';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import { filterFeedRenderableProducts } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { type FeedPost, useSocialFeed } from '@/store/social-feed';
import { useWardrobe } from '@/store/wardrobe';

const FILTERS = ['For You', 'Trending', 'Following', 'Under $100', 'Night Out', 'Streetwear', 'Clean', 'Gym'];
const QUICK_REACTIONS = ['Fire', 'Swap shoes', 'Too expensive', 'Clean fit', 'Better without hat'];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function visibleProducts(post: FeedPost, failedImageIds?: Set<string>): Product[] {
  return filterFeedRenderableProducts(Object.values(post.items).filter(
    (product): product is Product =>
      Boolean(product) && !failedImageIds?.has(product.id),
  ));
}

function itemsFromProducts(products: Product[]): Partial<Record<Category, Product>> {
  return Object.fromEntries(products.map((product) => [product.category, product])) as Partial<Record<Category, Product>>;
}

function postMatches(post: FeedPost, filter: string): boolean {
  if (filter === 'For You') return true;
  if (filter === 'Trending') return post.likeCount >= 250;
  if (filter === 'Following') return post.username !== '@you';
  if (filter === 'Under $100') return post.totalCents / Math.max(1, post.itemCount) <= 10000;
  const needle = filter.toLowerCase().replace(' out', '');
  return [post.vibe, ...post.tags].some((tag) => tag.toLowerCase().includes(needle));
}

function forYouScore(
  post: FeedPost,
  vibes: string[],
  frame: string,
  budget: string | undefined,
): number {
  let score = post.likeCount / 100;
  const postText = [post.vibe, post.title, ...post.tags].join(' ').toLowerCase();
  for (const vibe of vibes) {
    if (postText.includes(vibe.toLowerCase())) score += 8;
  }
  if (post.frameBias && post.frameBias !== 'any' && post.frameBias === frame) score += 5;
  if (post.frameBias === 'any' || !post.frameBias) score += 2;
  if (budget === 'low' && post.totalCents / Math.max(1, post.itemCount) <= 8000) score += 4;
  if (budget === 'mid' && post.totalCents / Math.max(1, post.itemCount) <= 25000) score += 3;
  if (budget === 'luxury' && post.totalCents / Math.max(1, post.itemCount) > 30000) score += 4;
  return score;
}

export default function FitFeedPage() {
  const posts = useSocialFeed((state) => state.posts);
  const toggleLike = useSocialFeed((state) => state.toggleLike);
  const toggleSave = useSocialFeed((state) => state.toggleSave);
  const addComment = useSocialFeed((state) => state.addComment);
  const generateMorePosts = useSocialFeed((state) => state.generateMorePosts);
  const replaceItems = useFit((state) => state.replaceItems);
  const saveFit = useSavedFits((state) => state.saveFit);
  const router = useRouter();
  const profile = useProfile((state) => state.profile);
  const addToWardrobe = useWardrobe((state) => state.addItem);
  const removeFromWardrobe = useWardrobe((state) => state.removeItem);
  const isItemOwned = useWardrobe((state) => state.hasItem);
  const [activeFilter, setActiveFilter] = useState('For You');
  const [commentPost, setCommentPost] = useState<FeedPost | null>(null);
  const [commentText, setCommentText] = useState('');
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState('Fit Feed');
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [burstPostId, setBurstPostId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const profileVibes = profile.stylePrefs.vibes || [];
  const profileFrame = profile.bodyType === 'custom' ? 'androgynous' : profile.bodyType;
  const profileBudget = profile.stylePrefs.budget;
  const filteredPosts = useMemo(() => {
    const matching = posts.filter((post) => postMatches(post, activeFilter) && visibleProducts(post).length >= 3);
    if (activeFilter !== 'For You') return matching;
    return [...matching].sort(
      (a, b) => forYouScore(b, profileVibes, profileFrame, profileBudget) - forYouScore(a, profileVibes, profileFrame, profileBudget),
    );
  }, [posts, activeFilter, profileVibes, profileFrame, profileBudget]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeFilter]);

  useEffect(() => {
    if (posts.length < 24) generateMorePosts(18);
  }, [generateMorePosts, posts.length]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setLoadingMore(true);
        generateMorePosts(14);
        window.setTimeout(() => setLoadingMore(false), 360);
      },
      { root: null, rootMargin: '900px 0px', threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [generateMorePosts, filteredPosts.length]);

  function remix(post: FeedPost) {
    const products = visibleProducts(post, failedImageIds);
    if (products.length < 3) return;
    setBurstPostId(post.id);
    window.setTimeout(() => {
      replaceItems(itemsFromProducts(products));
      router.push('/build');
    }, 180);
  }

  function like(post: FeedPost) {
    toggleLike(post.id);
    setBurstPostId(post.id);
    window.setTimeout(() => setBurstPostId(null), 420);
  }

  function savePost(post: FeedPost) {
    toggleSave(post.id);
    if (!post.saved) {
      const products = visibleProducts(post, failedImageIds);
      if (products.length >= 3) saveFit(itemsFromProducts(products));
    }
  }

  function shop(post: FeedPost) {
    const products = visibleProducts(post, failedImageIds)
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));
    setCheckoutTitle(post.title);
    setCheckoutProducts(products);
  }

  function submitComment(text = commentText) {
    const trimmed = text.trim();
    if (!commentPost || !trimmed) return;
    addComment(commentPost.id, trimmed);
    setCommentText('');
    setCommentPost(null);
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg">
      <div className="relative flex-1 overflow-hidden">
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/38 px-3 py-2 shadow-[0_16px_34px_rgba(0,0,0,.32)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[8px] uppercase tracking-[.2em] text-white/55">Fit Feed</div>
                <div className="font-serif text-[20px] font-semibold leading-none text-white">
                  Swipe <em className="italic text-accent">fits</em>
                </div>
              </div>
              <div className="flex max-w-[250px] gap-2 overflow-x-auto scrollbar-hide">
                {FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`flex-none rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${
                      activeFilter === filter
                        ? 'bg-accent text-white shadow-pink-glow'
                        : 'bg-white/10 text-white/70 hover:bg-white/15'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth">
          {filteredPosts.map((post) => {
            const products = visibleProducts(post, failedImageIds);
            return (
              <article
                key={post.id}
                className="relative flex h-full snap-start snap-always flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_10%,rgba(246,48,107,.14),transparent_34%),linear-gradient(180deg,#14110f_0%,#090807_100%)]"
              >
                {burstPostId === post.id ? (
                  <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-accent/10">
                    <div className="grid h-28 w-28 animate-ping place-items-center rounded-full border border-accent/40 bg-accent/15" />
                    <Heart className="absolute text-accent drop-shadow-[0_0_28px_rgba(246,48,107,.95)]" size={74} fill="currentColor" />
                  </div>
                ) : null}

                <div className="absolute inset-x-0 top-[78px] z-0 px-4">
                  <OutfitBoard
                    items={itemsFromProducts(products)}
                    className="h-[min(58dvh,520px)] min-h-[390px]"
                    onImageUnavailable={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
                  />
                </div>

                <div className="absolute right-3 top-[47%] z-20 flex -translate-y-1/2 flex-col items-center gap-3">
                  <button onClick={() => like(post)} className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-md transition ${post.liked ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-white/18 bg-black/38 text-white'}`} aria-label="Like fit">
                    <Heart size={20} fill={post.liked ? 'currentColor' : 'none'} />
                  </button>
                  <div className="-mt-2 text-center text-[10px] font-semibold text-white/80">{post.likeCount}</div>
                  <button onClick={() => setCommentPost(post)} className="grid h-12 w-12 place-items-center rounded-full border border-white/18 bg-black/38 text-white backdrop-blur-md" aria-label="Open comments">
                    <MessageCircle size={20} />
                  </button>
                  <button onClick={() => savePost(post)} className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur-md ${post.saved ? 'border-accent bg-accent/18 text-accent' : 'border-white/18 bg-black/38 text-white'}`} aria-label="Save fit">
                    <Bookmark size={20} fill={post.saved ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={() => remix(post)} className="grid h-12 w-12 place-items-center rounded-full border border-accent/45 bg-accent text-white shadow-pink-glow" aria-label="Remix in Builder">
                    <RotateCcw size={20} />
                  </button>
                  <button
                    onClick={() => {
                      replaceItems(itemsFromProducts(visibleProducts(post, failedImageIds)));
                      router.push('/try-on');
                    }}
                    className="grid h-12 w-12 place-items-center rounded-full border border-white/18 bg-black/38 text-white backdrop-blur-md"
                    aria-label="Try on"
                  >
                    <Sparkles size={20} />
                  </button>
                  <button onClick={() => shop(post)} className="grid h-12 w-12 place-items-center rounded-full border border-white/18 bg-black/38 text-white backdrop-blur-md" aria-label="Shop fit">
                    <ShoppingBag size={20} />
                  </button>
                </div>

                <div className="relative z-10 mt-auto px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pr-[76px]">
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-black/34 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.16em] text-white/78 backdrop-blur-md">
                      <Sparkles size={12} className="text-accent" />
                      {post.sourceType || 'catalog'} fit
                    </div>
                    {post.isOOTD && (
                      <div className="inline-flex items-center rounded-full border border-accent/50 bg-accent/18 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-accent backdrop-blur-md">
                        OOTD
                      </div>
                    )}
                  </div>
                  <h1 className="mt-3 font-serif text-[35px] font-semibold leading-[.94] text-white drop-shadow-[0_3px_18px_rgba(0,0,0,.42)]">
                    {post.title}
                  </h1>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-white/78">
                    {post.caption || `${post.vibe} outfit, ready to remix in Builder.`}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-white/78 backdrop-blur-md">
                      {post.vibe}
                    </span>
                    {post.frameBias && post.frameBias !== 'any' ? (
                      <span className="rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-white/78 backdrop-blur-md">
                        {post.frameBias} bias
                      </span>
                    ) : null}
                    <span className="rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-white/78 backdrop-blur-md">
                      {formatPrice(post.totalCents)}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {products.slice(0, 6).map((product) => {
                      const owned = isItemOwned(product.id);
                      return (
                        <div key={`${post.id}-tray-${product.id}`} className="relative flex-none">
                          <button
                            type="button"
                            onClick={() => shop(post)}
                            className="group h-[72px] w-[62px] overflow-hidden rounded-[18px] border border-[#eadfd5] bg-[#fff7ef] shadow-[0_12px_30px_rgba(0,0,0,.28)]"
                            aria-label={`Shop ${product.brand} ${product.name}`}
                          >
                            <ProductImage
                              product={product}
                              wrapperClassName="h-full w-full"
                              className="h-full w-full object-contain p-1.5 transition group-active:scale-95"
                              onUnavailable={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
                            />
                            <div className="absolute left-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[.12em] text-white">
                              {product.category}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => owned ? removeFromWardrobe(product.id) : addToWardrobe(product)}
                            aria-label={owned ? 'Remove from wardrobe' : 'Add to wardrobe'}
                            className={`absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border text-[8px] transition ${
                              owned
                                ? 'border-emerald-400/50 bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,.4)]'
                                : 'border-white/20 bg-[#1a1614] text-muted-2 hover:border-accent hover:text-accent'
                            }`}
                          >
                            {owned ? <Check size={9} strokeWidth={3} /> : <Plus size={9} strokeWidth={3} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_.78fr] gap-2">
                    <button onClick={() => remix(post)} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow">
                      <RotateCcw size={14} />
                      Build this
                    </button>
                    <button onClick={() => shop(post)} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white backdrop-blur-md">
                      <ShoppingBag size={14} />
                      Shop Fit
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <div ref={sentinelRef} className="grid min-h-[40dvh] snap-start place-items-center bg-bg px-6 pb-28 text-center">
            <div>
              <div className="font-serif text-[24px] text-ink">{loadingMore ? 'Loading more fits' : 'More fits are coming'}</div>
              <p className="mt-2 text-sm text-muted-2">Keep scrolling for fresh catalog-backed outfits.</p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />

      {commentPost ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/55 backdrop-blur-sm">
          <button className="absolute inset-0" aria-label="Close comments" onClick={() => setCommentPost(null)} />
          <section className="relative z-10 w-full rounded-t-[30px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-22px_60px_rgba(0,0,0,.46)]">
            <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/20" />
            <div className="font-serif text-[22px] font-semibold text-ink">Comments</div>
            <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto">
              {commentPost.comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[12px] text-muted-2">
                  <span className="font-semibold text-ink">{comment.user}</span> {comment.text}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_REACTIONS.map((reaction) => (
                <button key={reaction} onClick={() => submitComment(reaction)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2">
                  {reaction}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Add a comment"
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink outline-none focus:border-accent"
              />
              <button onClick={() => submitComment()} className="grid h-11 w-11 place-items-center rounded-full bg-accent text-white shadow-pink-glow">
                <Send size={15} />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title={checkoutTitle}
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
    </main>
  );
}

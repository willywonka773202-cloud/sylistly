'use client';

import { Bookmark, Camera, Grid3X3, Heart, MessageCircle, RotateCcw, Share2, ShoppingBag, Sparkles, WandSparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { OutfitThumbnail } from '@/components/OutfitThumbnail';
import { ProductImage } from '@/components/ProductImage';
import { getProductOutboundUrl } from '@/lib/product-links';
import { isHighConfidenceRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { type FeedPost, useSocialFeed } from '@/store/social-feed';
import { useWardrobe } from '@/store/wardrobe';

const SKIN_TONES = ['#f5d0b5', '#ddb192', '#c9a98a', '#a47757', '#7d553e', '#4b3025'];
const BODY_TYPES = ['masc', 'fem', 'androgynous', 'custom'] as const;
const BUDGETS = ['low', 'mid', 'high', 'luxury'] as const;
const PROFILE_FILTERS = ['All', 'Streetwear', 'Work', 'Clean', 'Date', 'Night', 'Travel', 'Techwear'];
const BODY_TYPE_LABELS: Record<(typeof BODY_TYPES)[number], string> = {
  masc: 'Male',
  fem: 'Female',
  androgynous: 'Neutral',
  custom: 'Custom',
};

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US')}`;
}

function postProducts(post: FeedPost): Product[] {
  return Object.values(post.items).filter(
    (product): product is Product => isHighConfidenceRenderableProduct(product),
  );
}

export default function ProfilePage() {
  const profile = useProfile((state) => state.profile);
  const setSkinTone = useProfile((state) => state.setSkinTone);
  const setBodyType = useProfile((state) => state.setBodyType);
  const setTopSize = useProfile((state) => state.setTopSize);
  const setBottomSize = useProfile((state) => state.setBottomSize);
  const setShoeSize = useProfile((state) => state.setShoeSize);
  const setBudget = useProfile((state) => state.setBudget);
  const setVibesFromText = useProfile((state) => state.setVibesFromText);
  const setBrandsFromText = useProfile((state) => state.setBrandsFromText);
  const savedCount = useSavedFits((state) => state.fits.length);
  const wardrobeItems = useWardrobe((state) => state.items);
  const posts = useSocialFeed((state) => state.posts);
  const toggleLike = useSocialFeed((state) => state.toggleLike);
  const toggleSave = useSocialFeed((state) => state.toggleSave);
  const replaceItems = useFit((state) => state.replaceItems);
  const router = useRouter();
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState('Style profile');
  const [activeProfileTab, setActiveProfileTab] = useState<'clothes' | 'outfits' | 'collections'>('outfits');
  const [activeFilter, setActiveFilter] = useState('All');

  const userPosts = useMemo(
    () => posts.filter((post) => post.username === '@you' && postProducts(post).length >= 3),
    [posts],
  );
  const gridPosts = userPosts.length
    ? userPosts
    : posts.filter((post) => postProducts(post).length >= 3).slice(0, 8);
  const filteredGridPosts = activeFilter === 'All'
    ? gridPosts
    : gridPosts.filter((post) =>
        [post.vibe, post.occasion, ...post.tags].some((tag) => tag?.toLowerCase().includes(activeFilter.toLowerCase())),
      );
  const wardrobeProducts = Object.values(wardrobeItems)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .map((item) => item.product)
    .filter(isHighConfidenceRenderableProduct);
  const likedCount = posts.filter((post) => post.liked).length;
  const closetCount = Object.keys(wardrobeItems).length;
  const styleBadges = useMemo(() => {
    const text = [
      ...(profile.stylePrefs.vibes || []),
      ...wardrobeProducts.flatMap((product) => [...(product.vibes || []), ...(product.occasions || []), product.category]),
    ].join(' ').toLowerCase();
    return [
      text.includes('clean') || text.includes('minimal') ? 'Clean Fit Expert' : null,
      text.includes('street') || text.includes('cargo') ? 'Streetwear Regular' : null,
      text.includes('gym') || text.includes('athletic') ? 'Gym Core' : null,
      text.includes('old money') || text.includes('preppy') ? 'Old Money' : null,
      text.includes('travel') || text.includes('airport') ? 'Travel Capsule' : null,
      text.includes('office') || text.includes('work') ? 'Workwear Pro' : null,
      text.includes('techwear') || text.includes('utility') ? 'Techwear Builder' : null,
      text.includes('campus') || text.includes('college') ? 'Campus Minimalist' : null,
      text.includes('date') || text.includes('night') ? 'Date Night Curator' : null,
      text.includes('vacation') || text.includes('resort') || text.includes('beach') ? 'Vacation Ready' : null,
      text.includes('premium') || text.includes('luxury') ? 'Premium Picks' : null,
      savedCount >= 5 ? 'Trendsetter' : null,
      closetCount >= 8 ? 'Closet Builder' : null,
      likedCount >= 10 ? 'Style Engaged' : null,
    ].filter((badge): badge is string => Boolean(badge)).slice(0, 6);
  }, [closetCount, profile.stylePrefs.vibes, savedCount, wardrobeProducts]);

  function remix(post: FeedPost) {
    replaceItems(post.items);
    router.push('/build');
  }

  function shop(post: FeedPost) {
    const products = postProducts(post)
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

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <div className="flex-1 overflow-y-auto px-4 pb-[100px] pt-10">
        <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#12100f] p-6 shadow-[0_28px_64px_rgba(0,0,0,.42)]">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(246,48,107,.12),transparent_50%)]" />
           
          <div className="relative z-10 flex items-start gap-5">
            <div className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-[28px] border border-accent/40 bg-accent/10 text-[36px] font-black text-accent shadow-pink-glow">
              S
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center justify-between gap-2">
                <h1 className="font-serif text-[28px] font-semibold leading-none text-white">@you</h1>
                <button
                  type="button"
                  onClick={() => router.push('/try-on')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/15 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-accent shadow-[0_0_12px_rgba(232,54,93,.2)] transition active:scale-[.98]"
                >
                  <Camera size={12} />
                  Try on
                </button>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#c4b6ae]">
                Building swipeable fits around clean layers, sharp night pieces, and image-backed shopping picks.
              </p>
              <div className="mt-4 flex gap-5 text-[11px] uppercase tracking-[.12em] text-muted-2">
                <span><strong className="text-white">0</strong> followers</span>
                <span><strong className="text-white">0</strong> following</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-6 grid grid-cols-3 gap-2.5">
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white transition active:scale-[.98]"
            >
              Edit profile
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white transition active:scale-[.98]"
            >
              <Share2 size={13} />
              Share
            </button>
            <button
              type="button"
              onClick={() => router.push('/saved')}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white transition active:scale-[.98]"
            >
              Saved fits
            </button>
          </div>

          <div className="relative z-10 mt-6 grid grid-cols-4 gap-2">
            {[
              ['Posts', userPosts.length],
              ['Clothes', closetCount],
              ['Saved', savedCount],
              ['Likes', likedCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[20px] border border-white/8 bg-black/20 px-2 py-3.5 text-center">
                <div className="font-serif text-[22px] font-semibold text-white">{value}</div>
                <div className="mt-1.5 text-[8px] font-bold uppercase tracking-[.16em] text-muted-2">{label}</div>
              </div>
            ))}
          </div>

          <div className="relative z-10 mt-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[
              ['Clean', Sparkles],
              ['Streetwear', Grid3X3],
              ['Night Out', Heart],
              ['Saved', Bookmark],
              ['Remixes', RotateCcw],
            ].map(([label, Icon]) => {
              const IconComponent = Icon as typeof Sparkles;
              return (
                <div key={label as string} className="flex-none text-center">
                  <div className="grid h-[64px] w-[64px] place-items-center rounded-full border border-accent/20 bg-accent/5 text-accent ring-1 ring-accent/30 shadow-[0_12px_28px_rgba(0,0,0,.24)]">
                    <IconComponent size={20} />
                  </div>
                  <div className="mt-2 text-[9px] font-semibold uppercase tracking-[.12em] text-white/80">{label as string}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between px-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.2em] text-accent">Creator profile</div>
              <h2 className="mt-1 font-serif text-[26px] font-semibold text-white">Style library</h2>
            </div>
            {!userPosts.length ? (
              <p className="max-w-[18ch] text-right text-[10px] leading-snug text-muted-2">Post from Builder to replace this inspo grid.</p>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-3 border-b border-white/10 text-center">
            {[
              ['clothes', 'Clothes'],
              ['outfits', 'Outfits'],
              ['collections', 'Collections'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveProfileTab(value as 'clothes' | 'outfits' | 'collections')}
                className={`relative px-2 pb-4 text-[11px] font-bold uppercase tracking-[.12em] transition ${
                  activeProfileTab === value ? 'text-white' : 'text-muted-2'
                }`}
              >
                {label}
                {activeProfileTab === value ? <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-accent" /> : null}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {PROFILE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`flex-none rounded-full px-4 py-2 text-[9px] font-bold uppercase tracking-[.14em] transition active:scale-95 ${
                  activeFilter === filter
                    ? 'bg-accent text-white shadow-pink-glow'
                    : 'border border-white/10 bg-white/[0.03] text-muted-2'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {activeProfileTab === 'outfits' ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
            {(filteredGridPosts.length ? filteredGridPosts : gridPosts).map((post) => {
              return (
                <OutfitThumbnail
                  key={post.id}
                  items={post.items}
                  title={post.title}
                  subtitle={`${post.vibe} / ${formatPrice(post.totalCents)}`}
                  onClick={() => setActivePost(post)}
                  className="min-h-[280px]"
                />
              );
            })}
            </div>
          ) : activeProfileTab === 'clothes' ? (
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {wardrobeProducts.length ? wardrobeProducts.slice(0, 18).map((product) => (
                <button
                  key={`profile-clothes-${product.id}`}
                  type="button"
                  onClick={() => router.push('/wardrobe')}
                  className="overflow-hidden rounded-[20px] border border-[#eadfd5] bg-[#fff7ef] p-1.5 text-left shadow-[0_12px_24px_rgba(0,0,0,.18)] transition active:scale-95"
                >
                  <div className="grid aspect-square place-items-center rounded-[14px] bg-white">
                    <ProductImage
                      product={product}
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                  <div className="mt-1.5 truncate px-1 text-[9px] font-bold text-[#221d19]">{product.brand}</div>
                </button>
              )) : (
                <div className="col-span-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center text-[13px] leading-relaxed text-muted-2">
                  Add owned pieces in Closet to fill this profile grid.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {['Clean rotation', 'Night looks', 'Wardrobe core', 'Wishlist'].map((collection, index) => (
                <button
                  key={collection}
                  type="button"
                  onClick={() => setActiveProfileTab('outfits')}
                  className="rounded-[28px] border border-[#eadfd5] bg-[#fff7ef] p-2 text-left shadow-[0_16px_34px_rgba(0,0,0,.22)] transition active:scale-95"
                >
                  <div className="grid h-[140px] grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden rounded-[22px] bg-[#fffaf5] p-2">
                    {(gridPosts[index]?.items ? postProducts(gridPosts[index]).slice(0, 4) : []).map((product, i) => (
                      <div key={`${collection}-${product.id}`} className={`overflow-hidden rounded-xl bg-white ring-1 ring-[#eadfd5] ${i === 0 && postProducts(gridPosts[index]).length < 4 ? 'row-span-2' : ''}`}>
                        <ProductImage product={product} wrapperClassName="h-full w-full" className="h-full w-full object-contain p-1.5" />
                      </div>
                    ))}
                  </div>
                  <div className="px-2 pb-2 pt-3">
                     <div className="font-serif text-[18px] font-semibold text-[#221d19]">{collection}</div>
                     <div className="mt-1 text-[9px] font-bold uppercase tracking-[.14em] text-[#8e7d73]">{Math.max(1, index + userPosts.length)} fits</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-[32px] border border-white/10 bg-[#12100f] p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
              <WandSparkles size={20} />
            </div>
            <div>
              <h2 className="font-serif text-[22px] font-semibold text-white">Style DNA</h2>
              <p className="mt-1 text-[11px] text-muted-2">Preferences still tune Builder generation locally.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(styleBadges.length ? styleBadges : ['Catalog Explorer', 'Closet Builder']).map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-accent"
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {BUDGETS.map((budget) => (
              <button
                key={budget}
                type="button"
                onClick={() => setBudget(budget)}
                className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[.14em] transition ${
                  profile.stylePrefs.budget === budget
                    ? 'bg-accent text-white shadow-pink-glow'
                    : 'border border-white/10 bg-white/[0.04] text-muted-2'
                }`}
              >
                {budget}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {BODY_TYPES.map((bodyType) => (
              <button
                key={bodyType}
                type="button"
                onClick={() => setBodyType(bodyType)}
                className={`rounded-[20px] px-4 py-4 text-[11px] font-bold uppercase tracking-[.14em] transition ${
                  profile.bodyType === bodyType
                    ? 'bg-accent text-white shadow-pink-glow'
                    : 'border border-white/10 bg-white/[0.04] text-muted-2'
                }`}
              >
                {BODY_TYPE_LABELS[bodyType]}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                aria-label={`Select skin tone ${tone}`}
                onClick={() => setSkinTone(tone)}
                className={`h-10 w-10 rounded-full border-2 transition ${profile.skinTone === tone ? 'scale-110 border-white' : 'border-transparent'}`}
                style={{ backgroundColor: tone }}
              />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <label className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-2">
              Top
              <input value={profile.sizes.top || ''} onChange={(event) => setTopSize(event.target.value)} className="mt-2 w-full rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-white outline-none focus:border-accent" placeholder="M" />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-2">
              Waist
              <input value={profile.sizes.bottom?.waist?.toString() || ''} onChange={(event) => setBottomSize(event.target.value)} className="mt-2 w-full rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-white outline-none focus:border-accent" placeholder="30" />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-2">
              Shoe
              <input value={profile.sizes.shoe || ''} onChange={(event) => setShoeSize(event.target.value)} className="mt-2 w-full rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-white outline-none focus:border-accent" placeholder="9" />
            </label>
          </div>

          <label className="mt-5 block text-[10px] font-bold uppercase tracking-[.14em] text-muted-2">
            Vibes
            <input value={(profile.stylePrefs.vibes || []).join(', ')} onChange={(event) => setVibesFromText(event.target.value)} className="mt-2 w-full rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-white outline-none focus:border-accent" placeholder="clean girl, streetwear, date night" />
          </label>
          <label className="mt-4 block text-[10px] font-bold uppercase tracking-[.14em] text-muted-2">
            Favorite brands
            <input value={(profile.stylePrefs.brands || []).join(', ')} onChange={(event) => setBrandsFromText(event.target.value)} className="mt-2 w-full rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-white outline-none focus:border-accent" placeholder="Skims, Nike, Zara" />
          </label>
        </section>
      </div>

      <BottomNav />

      {activePost ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/70 backdrop-blur-md transition-opacity">
          <button className="absolute inset-0" aria-label="Close post" onClick={() => setActivePost(null)} />
          <article className="relative z-10 max-h-[calc(100dvh-28px)] w-full overflow-y-auto rounded-t-[34px] border border-white/12 bg-[#11100f] p-5 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-[0_-24px_70px_rgba(0,0,0,.6)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-muted-2">{activePost.username}</div>
                <h2 className="mt-1 font-serif text-[28px] font-semibold leading-tight text-white">{activePost.title}</h2>
              </div>
              <button onClick={() => setActivePost(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20">
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 rounded-[28px] border border-[#eadfd5] bg-[#fff7ef] p-2">
              <div className="grid h-[390px] grid-cols-2 grid-rows-3 gap-2 overflow-hidden rounded-[22px] bg-[#fffaf5] p-2">
                {postProducts(activePost).slice(0, 6).map((product, index) => (
                  <div key={`${activePost.id}-modal-${product.id}`} className={`overflow-hidden rounded-[16px] bg-white ring-1 ring-[#eadfd5] ${index === 0 ? 'row-span-2' : ''}`}>
                    <ProductImage
                      product={product}
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 text-[14px] leading-relaxed text-muted-2">
              {activePost.vibe} outfit built from image-backed pieces. Remix it in Builder, lock your favorite items, then keep swiping variations.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {activePost.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-muted-2">{tag}</span>
              ))}
              <span className="rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-accent">{formatPrice(activePost.totalCents)}</span>
            </div>
            
            <div className="mt-6 grid grid-cols-3 gap-3">
              <button onClick={() => toggleLike(activePost.id)} className={`inline-flex items-center justify-center gap-1.5 rounded-[20px] border px-2 py-4 text-[11px] font-bold uppercase tracking-[.12em] transition ${activePost.liked ? 'border-accent bg-accent text-white shadow-pink-glow' : 'border-white/10 bg-white/[0.04] text-muted-2 hover:bg-white/10'}`}>
                <Heart size={16} fill={activePost.liked ? 'currentColor' : 'none'} />
                {activePost.likeCount}
              </button>
              <button className="inline-flex items-center justify-center gap-1.5 rounded-[20px] border border-white/10 bg-white/[0.04] px-2 py-4 text-[11px] font-bold uppercase tracking-[.12em] text-muted-2 transition hover:bg-white/10">
                <MessageCircle size={16} />
                {activePost.comments.length}
              </button>
              <button onClick={() => toggleSave(activePost.id)} className={`inline-flex items-center justify-center gap-1.5 rounded-[20px] border px-2 py-4 text-[11px] font-bold uppercase tracking-[.12em] transition ${activePost.saved ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 bg-white/[0.04] text-muted-2 hover:bg-white/10'}`}>
                <Bookmark size={16} fill={activePost.saved ? 'currentColor' : 'none'} />
                Save
              </button>
            </div>
            
            <div className="mt-4 grid grid-cols-[1.15fr_1fr] gap-3">
              <button onClick={() => remix(activePost)} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-4 text-[12px] font-bold uppercase tracking-[.14em] text-white shadow-pink-glow transition active:scale-[.98]">
                <RotateCcw size={15} />
                Remix
              </button>
              <button onClick={() => shop(activePost)} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-4 py-4 text-[12px] font-bold uppercase tracking-[.14em] text-white backdrop-blur-md transition active:scale-[.98]">
                <ShoppingBag size={15} />
                Shop fit
              </button>
            </div>
          </article>
        </div>
      ) : null}

      <CheckoutSheet open={Boolean(checkoutProducts)} title={checkoutTitle} products={checkoutProducts || []} onClose={() => setCheckoutProducts(null)} />
    </main>
  );
}

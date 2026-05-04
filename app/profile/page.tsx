'use client';

import { Bookmark, Camera, Grid3X3, Heart, MessageCircle, RotateCcw, ShoppingBag, Sparkles, Shirt, Trash2, UserPlus, WandSparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { ProductImage } from '@/components/ProductImage';
import { getCatalogProductById } from '@/lib/catalog';
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
const BODY_TYPE_LABELS: Record<(typeof BODY_TYPES)[number], string> = {
  masc: 'Male',
  fem: 'Female',
  androgynous: 'Neutral',
  custom: 'Custom',
};

type ProfileTab = 'outfits' | 'wardrobe' | 'style';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function postProducts(post: FeedPost, failedImageIds: Set<string>): Product[] {
  return Object.values(post.items).filter(
    (product): product is Product =>
      isHighConfidenceRenderableProduct(product) && !failedImageIds.has(product.id),
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
  const setSelfieUrl = useProfile((state) => state.setSelfieUrl);
  const setBodyPhotoUrl = useProfile((state) => state.setBodyPhotoUrl);
  const savedCount = useSavedFits((state) => state.fits.length);
  const posts = useSocialFeed((state) => state.posts);
  const toggleLike = useSocialFeed((state) => state.toggleLike);
  const toggleSave = useSocialFeed((state) => state.toggleSave);
  const replaceItems = useFit((state) => state.replaceItems);
  const ownedItems = useWardrobe((state) => state.ownedItems);
  const removeWardrobeItem = useWardrobe((state) => state.removeItem);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>('outfits');
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState('Style profile');
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());

  const userPosts = useMemo(
    () => posts.filter((post) => post.username === '@you' && postProducts(post, failedImageIds).length >= 3),
    [posts, failedImageIds],
  );
  const gridPosts = userPosts.length
    ? userPosts
    : posts.filter((post) => postProducts(post, failedImageIds).length >= 3).slice(0, 8);
  const likedCount = posts.filter((post) => post.liked).length;
  const savedSocialCount = posts.filter((post) => post.saved).length;
  const remixCount = Math.max(12, userPosts.length * 3 + savedSocialCount);

  function remix(post: FeedPost) {
    replaceItems(post.items);
    router.push('/build');
  }

  function buildFromWardrobe() {
    const productItems: Partial<Record<Category, Product>> = {};
    for (const item of ownedItems) {
      if (productItems[item.category]) continue;
      const catalogProduct = getCatalogProductById(item.productId);
      productItems[item.category] = catalogProduct ?? {
        id: item.productId,
        brand: item.brand,
        name: item.name,
        category: item.category,
        priceCents: item.priceCents,
        currency: 'USD',
        retailer: item.brand,
        retailerUrl: '',
        imageUrl: item.imageUrl,
      };
    }
    replaceItems(productItems);
    const lockCats = Object.keys(productItems).join(',');
    router.push(`/build?lock=${lockCats}`);
  }

  function shop(post: FeedPost) {
    const products = postProducts(post, failedImageIds)
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

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'outfits', label: 'Outfits' },
    { id: 'wardrobe', label: 'Wardrobe' },
    { id: 'style', label: 'Style DNA' },
  ];

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col bg-bg">
      <div className="flex-1 overflow-y-auto pb-7 pt-[calc(env(safe-area-inset-top)+16px)]">

        {/* Profile header card */}
        <section className="mx-4 rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(246,48,107,.16),transparent_32%),linear-gradient(180deg,#191513_0%,#0f0e0d_100%)] p-4 shadow-[0_28px_64px_rgba(0,0,0,.42)]">
          <div className="flex items-start gap-4">
            <div className="grid h-[82px] w-[82px] shrink-0 place-items-center rounded-[28px] border border-accent/35 bg-accent text-[32px] font-black text-white shadow-pink-glow">
              S
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h1 className="font-serif text-[28px] font-semibold leading-none text-ink">Style profile</h1>
                  <p className="mt-1 text-[12px] font-semibold text-muted-2">@you</p>
                </div>
                <button className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-2 text-[10px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow">
                  <UserPlus size={12} />
                  Follow
                </button>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[#cfc0b8]">
                Building swipeable fits around clean layers, sharp night pieces, and image-backed shopping picks.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {[
              ['Posts', userPosts.length],
              ['Saved', savedCount],
              ['Likes', likedCount],
              ['Wardrobe', ownedItems.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] px-2 py-3 text-center">
                <div className="font-serif text-[20px] font-semibold text-ink">{value}</div>
                <div className="mt-1 text-[8px] uppercase tracking-[.15em] text-muted">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
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
                  <div className="grid h-[58px] w-[58px] place-items-center rounded-full border border-accent/25 bg-[#fff6eb] text-accent shadow-[0_12px_28px_rgba(0,0,0,.24)]">
                    <IconComponent size={17} />
                  </div>
                  <div className="mt-1 text-[9px] font-semibold text-muted-2">{label as string}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tab bar */}
        <div className="mt-5 flex gap-1 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-full py-2.5 text-[11px] font-semibold uppercase tracking-[.1em] transition ${
                activeTab === tab.id
                  ? 'bg-accent text-white shadow-pink-glow'
                  : 'border border-white/10 bg-white/[0.04] text-muted-2'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Outfits */}
        {activeTab === 'outfits' && (
          <section className="mt-5 px-4">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-[9px] uppercase tracking-[.18em] text-accent">Posted fits</div>
                <h2 className="mt-1 font-serif text-[24px] font-semibold text-ink">Outfit grid</h2>
              </div>
              {!userPosts.length ? (
                <p className="max-w-[18ch] text-right text-[10px] leading-snug text-muted">Post from Builder to replace this inspo grid.</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {gridPosts.map((post) => {
                const products = postProducts(post, failedImageIds);
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => setActivePost(post)}
                    className="group overflow-hidden rounded-[24px] border border-white/10 bg-[#151311] text-left shadow-[0_18px_38px_rgba(0,0,0,.32)]"
                  >
                    <div className="m-2 grid h-[190px] grid-cols-2 grid-rows-3 gap-1.5 overflow-hidden rounded-[18px] border border-[#eadfd5] bg-[#fff7ef] p-1.5">
                      {products.slice(0, 5).map((product, index) => (
                        <div key={`${post.id}-${product.id}`} className={`overflow-hidden rounded-[12px] bg-white/80 ${index === 0 ? 'row-span-2' : ''}`}>
                          <ProductImage
                            product={product}
                            wrapperClassName="h-full w-full"
                            className="h-full w-full object-contain p-1.5"
                            onUnavailable={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="px-3 pb-3">
                      <h3 className="line-clamp-1 font-serif text-[18px] font-semibold text-ink">{post.title}</h3>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                        <span>{post.vibe}</span>
                        <span>{formatPrice(post.totalCents)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Tab: Wardrobe */}
        {activeTab === 'wardrobe' && (
          <section className="mt-5 px-4">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-[9px] uppercase tracking-[.18em] text-accent">Your clothes</div>
                <h2 className="mt-1 font-serif text-[24px] font-semibold text-ink">Wardrobe</h2>
              </div>
              {ownedItems.length > 0 && (
                <button
                  type="button"
                  onClick={buildFromWardrobe}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[.1em] text-white shadow-pink-glow"
                >
                  <Sparkles size={11} />
                  Build fit
                </button>
              )}
            </div>

            {ownedItems.length === 0 ? (
              <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(232,54,93,.1),transparent_38%),linear-gradient(180deg,#161412_0%,#0d0c0b_100%)] p-7 text-center shadow-[0_24px_60px_rgba(0,0,0,.35)]">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-accent/12 text-accent">
                  <Shirt size={22} />
                </div>
                <h2 className="mt-4 font-serif text-[22px] font-semibold text-ink">No pieces yet</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-2">
                  Mark items as owned in the Builder or Discover to track your wardrobe.
                </p>
                <button
                  onClick={() => router.push('/discover')}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow"
                >
                  Browse Discover
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {ownedItems.map((item) => (
                  <div
                    key={item.productId}
                    className="group relative overflow-hidden rounded-[20px] border border-white/10 bg-[#151311]"
                  >
                    <div className="aspect-square overflow-hidden rounded-[16px] m-1.5 border border-[#eadfd5] bg-[#fff8f2]">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-contain p-2"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="px-2 pb-2.5">
                      <div className="text-[8px] uppercase tracking-[.1em] text-accent mb-0.5">{item.category}</div>
                      <p className="line-clamp-1 text-[10px] font-semibold text-ink">{item.brand}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWardrobeItem(item.productId)}
                      aria-label="Remove from wardrobe"
                      className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-rose-400/70 opacity-0 transition group-hover:opacity-100 group-active:opacity-100"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: Style DNA */}
        {activeTab === 'style' && (
          <section className="mt-5 mx-4 rounded-[28px] border border-white/10 bg-surface-1 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent/10 text-accent">
                <WandSparkles size={17} />
              </div>
              <div>
                <h2 className="font-serif text-[20px] font-semibold text-ink">Style DNA</h2>
                <p className="mt-1 text-[12px] text-muted-2">Tunes Builder generation.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {BUDGETS.map((budget) => (
                <button
                  key={budget}
                  type="button"
                  onClick={() => setBudget(budget)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.12em] ${
                    profile.stylePrefs.budget === budget
                      ? 'border-accent bg-accent text-white'
                      : 'border-hairline bg-surface-2 text-muted-2'
                  }`}
                >
                  {budget}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {BODY_TYPES.map((bodyType) => (
                <button
                  key={bodyType}
                  type="button"
                  onClick={() => setBodyType(bodyType)}
                  className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[.14em] ${
                    profile.bodyType === bodyType
                      ? 'border-accent bg-accent text-white'
                      : 'border-hairline bg-surface-2 text-muted-2'
                  }`}
                >
                  {BODY_TYPE_LABELS[bodyType]}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  aria-label={`Select skin tone ${tone}`}
                  onClick={() => setSkinTone(tone)}
                  className={`h-9 w-9 rounded-full border-2 transition ${profile.skinTone === tone ? 'scale-105 border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: tone }}
                />
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <label className="text-[11px] text-muted-2">
                Top
                <input value={profile.sizes.top || ''} onChange={(event) => setTopSize(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="M" />
              </label>
              <label className="text-[11px] text-muted-2">
                Waist
                <input value={profile.sizes.bottom?.waist?.toString() || ''} onChange={(event) => setBottomSize(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="30" />
              </label>
              <label className="text-[11px] text-muted-2">
                Shoe
                <input value={profile.sizes.shoe || ''} onChange={(event) => setShoeSize(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="9" />
              </label>
            </div>

            <label className="mt-4 block text-[11px] text-muted-2">
              Vibes
              <input value={(profile.stylePrefs.vibes || []).join(', ')} onChange={(event) => setVibesFromText(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="clean girl, streetwear, date night" />
            </label>
            <label className="mt-3 block text-[11px] text-muted-2">
              Favorite brands
              <input value={(profile.stylePrefs.brands || []).join(', ')} onChange={(event) => setBrandsFromText(event.target.value)} className="mt-1 w-full rounded-2xl border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent" placeholder="Skims, Nike, Zara" />
            </label>

            {/* Try-on setup */}
            <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent/10 text-accent">
                  <Camera size={14} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-ink">Try-on setup</div>
                  <div className="text-[10px] text-muted-2">Paste photo URLs for AI outfit preview</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-muted-2 mb-1.5">Selfie / face photo</div>
                  {profile.selfieUrl ? (
                    <div className="relative mb-1.5">
                      <div className="h-24 overflow-hidden rounded-[14px] border border-[#eadfd5] bg-[#fff8f2]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={profile.selfieUrl} alt="Selfie" className="h-full w-full object-cover" onError={() => setSelfieUrl('')} />
                      </div>
                      <button onClick={() => setSelfieUrl('')} className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white text-[9px]">×</button>
                    </div>
                  ) : (
                    <div className="mb-1.5 flex h-24 flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-white/15 bg-white/[0.03] text-[10px] text-muted-2">
                      <Camera size={16} className="opacity-40" />
                      Face photo
                    </div>
                  )}
                  <input type="text" value={profile.selfieUrl || ''} onChange={(e) => setSelfieUrl(e.target.value)} placeholder="Paste image URL" className="w-full rounded-xl border border-hairline bg-surface-2 px-2.5 py-1.5 text-[10px] text-ink outline-none focus:border-accent" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-2 mb-1.5">Full-body photo</div>
                  {profile.bodyPhotoUrl ? (
                    <div className="relative mb-1.5">
                      <div className="h-24 overflow-hidden rounded-[14px] border border-[#eadfd5] bg-[#fff8f2]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={profile.bodyPhotoUrl} alt="Body photo" className="h-full w-full object-cover" onError={() => setBodyPhotoUrl('')} />
                      </div>
                      <button onClick={() => setBodyPhotoUrl('')} className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white text-[9px]">×</button>
                    </div>
                  ) : (
                    <div className="mb-1.5 flex h-24 flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-white/15 bg-white/[0.03] text-[10px] text-muted-2">
                      <Camera size={16} className="opacity-40" />
                      Full-length
                    </div>
                  )}
                  <input type="text" value={profile.bodyPhotoUrl || ''} onChange={(e) => setBodyPhotoUrl(e.target.value)} placeholder="Paste image URL" className="w-full rounded-xl border border-hairline bg-surface-2 px-2.5 py-1.5 text-[10px] text-ink outline-none focus:border-accent" />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <BottomNav />

      {/* Post detail modal */}
      {activePost ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[480px] items-end bg-black/70 backdrop-blur-sm">
          <button className="absolute inset-0" aria-label="Close post" onClick={() => setActivePost(null)} />
          <article className="relative z-10 max-h-[calc(100dvh-28px)] w-full overflow-y-auto rounded-t-[34px] border border-white/12 bg-[#11100f] p-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-24px_70px_rgba(0,0,0,.55)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold text-muted-2">{activePost.username}</div>
                <h2 className="mt-1 font-serif text-[27px] font-semibold leading-tight text-ink">{activePost.title}</h2>
              </div>
              <button onClick={() => setActivePost(null)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-2">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-[28px] border border-[#eadfd5] bg-[#fff7ef] p-2">
              <div className="grid h-[360px] grid-cols-2 grid-rows-3 gap-2 overflow-hidden rounded-[22px] bg-[#fffaf5] p-2">
                {postProducts(activePost, failedImageIds).slice(0, 6).map((product, index) => (
                  <div key={`${activePost.id}-modal-${product.id}`} className={`overflow-hidden rounded-[16px] bg-white/80 ring-1 ring-[#eadfd5] ${index === 0 ? 'row-span-2' : ''}`}>
                    <ProductImage
                      product={product}
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-contain p-2"
                      onUnavailable={(failedProduct) => setFailedImageIds((current) => new Set(current).add(failedProduct.id))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-muted-2">
              {activePost.vibe} outfit built from image-backed pieces. Remix it in Builder, lock your favorite items, then keep swiping variations.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activePost.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-muted-2">{tag}</span>
              ))}
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-muted-2">{formatPrice(activePost.totalCents)}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => toggleLike(activePost.id)} className={`inline-flex items-center justify-center gap-1 rounded-full border px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] ${activePost.liked ? 'border-accent bg-accent text-white' : 'border-white/10 bg-white/[0.04] text-muted-2'}`}>
                <Heart size={13} fill={activePost.liked ? 'currentColor' : 'none'} />
                {activePost.likeCount}
              </button>
              <button className="inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-2">
                <MessageCircle size={13} />
                {activePost.comments.length}
              </button>
              <button onClick={() => toggleSave(activePost.id)} className={`inline-flex items-center justify-center gap-1 rounded-full border px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] ${activePost.saved ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 bg-white/[0.04] text-muted-2'}`}>
                <Bookmark size={13} fill={activePost.saved ? 'currentColor' : 'none'} />
                Save
              </button>
            </div>
            <div className="mt-3 grid grid-cols-[1.2fr_1fr] gap-2">
              <button onClick={() => remix(activePost)} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white shadow-pink-glow">
                <RotateCcw size={13} />
                Remix
              </button>
              <button onClick={() => shop(activePost)} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-2">
                <ShoppingBag size={13} />
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

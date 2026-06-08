'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  ExternalLink,
  MessageCircle,
  Send,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { CheckoutSheet, type CheckoutProduct } from '@/components/CheckoutSheet';
import { OutfitLookCard } from '@/components/OutfitBoard';
import { ProductImage } from '@/components/ProductImage';
import { getCheckoutUrlHost, isExactProductUrl } from '@/lib/checkout';
import { hasExactProductLink, sortTransparentFeedRenderableProducts } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import { getStylistCatalogProducts } from '@/lib/client-catalog';
import { buildStylistContext } from '@/lib/stylist/context';
import { generateLocalStylistResponse } from '@/lib/stylist/local-response';
import type { StylistAction, StylistContext, StylistMessage, StylistUserIntent } from '@/lib/stylist/types';
import type { Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

interface PromptCard {
  intent: StylistUserIntent;
  title: string;
  detail: string;
  prompt: string;
  icon: typeof Sparkles;
}

interface PromptGroup {
  label: string;
  prompts: PromptCard[];
}

const PROMPT_GROUPS: PromptGroup[] = [
  {
    label: 'Outfit help',
    prompts: [
      { intent: 'outfit_request', title: 'Build a fit for today', detail: 'Top, bottom, shoes, then layers.', prompt: 'Build a fit for today using real linked cutout pieces', icon: Sparkles },
      { intent: 'build_around_piece', title: 'Build around white sneakers', detail: 'Anchor the look on shoes.', prompt: 'Build around white sneakers with real linked products', icon: Shirt },
    ],
  },
  {
    label: 'Wardrobe help',
    prompts: [
      { intent: 'complete_closet', title: 'Complete my closet', detail: 'Fill missing core categories.', prompt: 'Complete my closet with real linked transparent pieces', icon: Boxes },
      { intent: 'packing_list', title: 'Create a packing list', detail: 'Use saved fits and gaps.', prompt: 'Create a packing list from my saved fits and closet gaps', icon: ClipboardList },
    ],
  },
  {
    label: 'Shopping help',
    prompts: [
      { intent: 'shopping_advice', title: 'What should I buy next?', detail: 'Prioritize exact merchant links.', prompt: 'What should I buy next? Use only real linked cutout products', icon: ShoppingBag },
      { intent: 'build_around_piece', title: 'Find a black jacket fit', detail: 'Outerwear-led outfit.', prompt: 'Build around a black jacket with real linked products', icon: Wand2 },
    ],
  },
  {
    label: 'Style review',
    prompts: [
      { intent: 'rate_current_fit', title: 'Rate current fit', detail: 'Score what is already built.', prompt: 'Rate my current fit', icon: Star },
      { intent: 'style_dna', title: 'Read my style DNA', detail: 'Saved, closet, likes.', prompt: 'What is my style DNA?', icon: MessageCircle },
    ],
  },
];

const COMPOSER_PROMPTS = [
  'Build around white sneakers',
  'Build around a black jacket',
  'What should I buy next?',
  'Rate my current fit',
];

function emptyContext(): StylistContext {
  return buildStylistContext({
    currentFitItems: {},
    savedFits: [],
    wardrobeItems: [],
    feedPosts: [],
    catalogProducts: getStylistCatalogProducts(),
    profile: null,
  });
}

function messageFromResponse(id: string, text: string, actions: StylistAction[]): StylistMessage {
  return {
    id,
    role: 'syli',
    text,
    ctas: actions,
    mode: 'local',
    createdAt: new Date().toISOString(),
  };
}

async function requestStylistResponse(prompt: string, context: StylistContext, signal?: AbortSignal) {
  const response = await fetch('/api/stylist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prompt, context }),
    signal,
  });
  if (!response.ok) throw new Error(`Syli API failed with ${response.status}`);
  return (await response.json()) as ReturnType<typeof generateLocalStylistResponse>;
}

export default function StylistPage() {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<StylistMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isSlowRequest, setIsSlowRequest] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [apiMode, setApiMode] = useState<'api' | 'local' | 'unknown'>('unknown');
  const [checkoutProducts, setCheckoutProducts] = useState<CheckoutProduct[] | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState('Syli recommendations');
  const autoPromptRef = useRef<string | null>(null);

  useEffect(() => setHasMounted(true), []);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/stylist')
      .then((response) => response.json())
      .then((status: { mode?: 'api' | 'local' }) => {
        if (!cancelled && (status.mode === 'api' || status.mode === 'local')) setApiMode(status.mode);
      })
      .catch(() => {
        if (!cancelled) setApiMode('local');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentFitItems = useFit((state) => state.items);
  const replaceFitItems = useFit((state) => state.replaceItems);
  const savedFits = useSavedFits((state) => state.fits);
  const wardrobeItems = useWardrobe(selectWardrobeItems);
  const addToWishlist = useWardrobe((state) => state.addToWishlist);
  const feedPosts = useSocialFeed((state) => state.posts);
  const profile = useProfile((state) => state.profile);

  const context = useMemo(
    () =>
      hasMounted
        ? buildStylistContext({
          currentFitItems,
          savedFits,
          wardrobeItems,
          feedPosts,
          catalogProducts: getStylistCatalogProducts(),
          profile,
        })
        : emptyContext(),
    [currentFitItems, feedPosts, hasMounted, profile, savedFits, wardrobeItems],
  );
  const productsById = useMemo(
    () => new Map(context.knownProducts.map((product) => [product.id, product])),
    [context.knownProducts],
  );
  const stylistCatalogPicks = useMemo(
    () => pickStylistCatalogProducts(context.knownProducts, 8),
    [context.knownProducts],
  );

  const submitPrompt = useCallback(async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || isThinking) return;

    const now = Date.now();
    setMessages((current) => [
      ...current,
      {
        id: `user-${now}`,
        role: 'user',
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput('');
    setIsThinking(true);
    setIsSlowRequest(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const slowTimer = setTimeout(() => setIsSlowRequest(true), 3500);
    const timeoutTimer = setTimeout(() => controller.abort(), 18_000);

    try {
      const response = await requestStylistResponse(trimmed, context, controller.signal);
      setMessages((current) => [
        ...current,
        {
          ...messageFromResponse(`syli-${now}`, response.message, response.actions),
          mode: response.mode,
          recommendedProducts: response.recommendedProducts,
        },
      ]);
    } catch (error) {
      // On timeout/cancel/error, fall back to the real local context — never a blank hang.
      const response = generateLocalStylistResponse(trimmed, context);
      const note = error instanceof DOMException && error.name === 'AbortError'
        ? ' (Syli was taking too long, so here’s a pick from your saved fits and closet.)'
        : '';
      setMessages((current) => [
        ...current,
        {
          ...messageFromResponse(`syli-${now}`, `${response.message}${note}`, response.actions),
          mode: response.mode,
          recommendedProducts: response.recommendedProducts,
        },
      ]);
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
      abortControllerRef.current = null;
      setIsThinking(false);
      setIsSlowRequest(false);
    }
  }, [context, isThinking]);

  const cancelRequest = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsThinking(false);
    setIsSlowRequest(false);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(input);
  }

  useEffect(() => {
    if (!hasMounted || isThinking) return;
    const prompt = new URLSearchParams(window.location.search).get('prompt')?.trim();
    if (!prompt || autoPromptRef.current === prompt) return;
    autoPromptRef.current = prompt;
    void submitPrompt(prompt);
  }, [hasMounted, isThinking, submitPrompt]);

  function productsForRecommendations(recommendations: Array<{ productId: string }>): Product[] {
    const usedCategories = new Set<string>();
    const products = recommendations
      .map((recommendation) => productsById.get(recommendation.productId))
      .filter((product): product is Product => Boolean(product))
      .filter((product) => {
        if (usedCategories.has(product.category)) return false;
        usedCategories.add(product.category);
        return true;
      });
    return upgradeProductsWithExactLinks(sortTransparentFeedRenderableProducts(products), context.knownProducts);
  }

  function applyRecommendationsToBuilder(recommendations: Array<{ productId: string }>) {
    const products = productsForRecommendations(recommendations);
    if (!products.length) return;
    replaceFitItems(Object.fromEntries(products.map((product) => [product.category, product])));
    router.push('/build?source=syli');
  }

  function applyRecommendationsToStudio(recommendations: Array<{ productId: string }>) {
    const products = productsForRecommendations(recommendations);
    if (!products.length) return;
    replaceFitItems(Object.fromEntries(products.map((product) => [product.category, product])));
    router.push('/canvas?source=syli');
  }

  function wishlistRecommendations(recommendations: Array<{ productId: string }>) {
    const products = productsForRecommendations(recommendations);
    for (const product of products) addToWishlist(product, 'manual');
    if (products.length) router.push('/wardrobe?status=wishlist');
  }

  function openCheckoutForProducts(products: Product[], title: string) {
    const checkoutItems = sortTransparentFeedRenderableProducts(products)
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));
    if (!checkoutItems.length) return;
    setCheckoutTitle(checkoutItems.length === 1 ? `${checkoutItems[0].brand} ${checkoutItems[0].name}` : title);
    setCheckoutProducts(checkoutItems);
  }

  function shopRecommendations(recommendations: Array<{ productId: string }>) {
    openCheckoutForProducts(productsForRecommendations(recommendations), 'Syli recommendations');
  }

  function buildWithCatalogPicks(products: Product[]) {
    const outfitProducts = uniqueOutfitProducts(products);
    if (!outfitProducts.length) return;
    replaceFitItems(Object.fromEntries(outfitProducts.map((product) => [product.category, product])));
    router.push('/build?source=syli-catalog');
  }

  function editCatalogPicks(products: Product[]) {
    const outfitProducts = uniqueOutfitProducts(products);
    if (!outfitProducts.length) return;
    replaceFitItems(Object.fromEntries(outfitProducts.map((product) => [product.category, product])));
    router.push('/canvas?source=syli-catalog');
  }

  return (
    <main
      className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg"
      data-stylist-page
      data-stylist-mode={apiMode}
      data-stylist-known-product-count={context.knownProducts.length}
      data-stylist-catalog-pick-count={stylistCatalogPicks.length}
    >
      <style>{`
        @keyframes syliMessage {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .syli-message { animation: syliMessage .22s ease-out both; }
        }
      `}</style>

      <header className="border-b border-hairline px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[.24em] text-accent">Syli</div>
            <h1 className="mt-0.5 font-serif text-[28px] font-semibold leading-tight text-ink">AI Stylist</h1>
          </div>
          <span className="rounded-full border border-accent/45 bg-accent/14 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-accent">
            {isThinking ? 'Thinking' : apiMode === 'api' ? 'AI ready' : 'Local mode'}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-2">
          Syli uses AI to style you. If it&rsquo;s ever briefly unavailable, you&rsquo;ll still get suggestions from your saved fits and closet — never made-up picks.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-5 pt-4">
        <section className="rounded-[28px] border border-accent/24 bg-[radial-gradient(circle_at_18%_0%,rgba(246,48,107,.18),transparent_42%),rgba(255,255,255,.045)] p-4 shadow-[0_18px_44px_rgba(0,0,0,.26)]">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
              <Wand2 size={21} />
            </span>
            <div className="min-w-0">
              <div className="font-serif text-[22px] font-semibold leading-tight text-ink">Ask with real style context.</div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
                Syli routes you to real app flows and does not invent wardrobe items, purchases, or imaginary product answers.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <ContextPill label="Saved" value={context.savedFitCount} />
            <ContextPill label="Closet" value={context.closetCount} />
            <ContextPill label="Wish" value={context.wishlistCount} />
            <ContextPill label="Build" value={context.currentFitPieceCount} />
          </div>
        </section>

        <SyliCatalogStrip
          products={stylistCatalogPicks}
          onShopAll={() => openCheckoutForProducts(stylistCatalogPicks, 'Real catalog picks')}
          onBuild={() => buildWithCatalogPicks(stylistCatalogPicks)}
          onStudio={() => editCatalogPicks(stylistCatalogPicks)}
        />

        <section className="mt-5 space-y-4">
          {PROMPT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-2 text-[8px] font-bold uppercase tracking-[.22em] text-accent">{group.label}</div>
              <div className="grid grid-cols-2 gap-2">
                {group.prompts.map((prompt) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={`${group.label}-${prompt.title}`}
                      type="button"
                      onClick={() => submitPrompt(prompt.prompt)}
                      disabled={isThinking}
                      data-syli-prompt-card={prompt.intent}
                      data-syli-prompt-text={prompt.prompt}
                      className="sy-lift sy-press group flex min-h-[102px] flex-col rounded-[20px] border border-white/12 bg-white/[0.05] p-3 text-left shadow-[0_12px_26px_rgba(0,0,0,.2)] transition hover:border-accent/50 hover:bg-white/[0.08] motion-safe:transition-all motion-safe:duration-200"
                    >
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-2xl bg-accent/16 text-accent transition group-hover:bg-accent group-hover:text-white">
                        <Icon size={16} />
                      </span>
                      <span className="mt-2 block font-serif text-[15px] font-semibold leading-tight text-ink">{prompt.title}</span>
                      <span className="mt-1 line-clamp-2 text-[10px] font-semibold leading-snug text-muted-2">{prompt.detail}</span>
                      <ArrowRight size={14} className="mt-auto text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-5 space-y-3">
          <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.22em] text-accent">
            <MessageCircle size={12} />
            Chat
          </div>

          {messages.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 text-[12px] leading-relaxed text-muted-2">
              Try “Rate my current fit” or “What should I buy next?” Syli will answer from real local state and send you to Builder, Wardrobe, Discover, Saved, Feed, Canvas, or Profile when useful.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`syli-message ${message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-[24px] px-4 py-3 text-[12px] leading-relaxed shadow-[0_12px_28px_rgba(0,0,0,.22)] ${
                    message.role === 'user'
                      ? 'bg-accent text-white'
                      : 'border border-white/12 bg-white/[0.06] text-muted-2'
                  }`}
                >
                  <p>{message.text}</p>
                  {message.ctas?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {message.ctas.map((cta) => (
                        <Link
                          key={`${message.id}-${cta.href}-${cta.label}`}
                          href={cta.href}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] transition active:scale-95 ${
                            cta.primary
                              ? 'bg-accent text-white shadow-pink-glow'
                              : 'border border-[rgba(232,54,93,.3)] bg-[rgba(232,54,93,.1)] text-ink hover:border-[rgba(232,54,93,.55)]'
                          }`}
                        >
                          {cta.label}
                          <ArrowRight size={11} />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {message.recommendedProducts?.length ? (
                    <RecommendedProducts
                      productsById={productsById}
                      recommendations={message.recommendedProducts}
                      onApply={() => applyRecommendationsToBuilder(message.recommendedProducts || [])}
                      onStudio={() => applyRecommendationsToStudio(message.recommendedProducts || [])}
                      onWishlist={() => wishlistRecommendations(message.recommendedProducts || [])}
                      onShop={() => shopRecommendations(message.recommendedProducts || [])}
                    />
                  ) : null}
                </div>
              </div>
            ))
          )}

          {isThinking ? (
            <div className="syli-message flex justify-start">
              <div className="max-w-[88%] rounded-[24px] border border-accent/25 bg-accent/10 px-4 py-3 text-[12px] font-semibold text-accent shadow-[0_12px_28px_rgba(0,0,0,.22)]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  {isSlowRequest
                    ? 'Syli is taking a little longer than usual…'
                    : 'Syli is reading your current fit, closet, saved fits, and catalog context…'}
                </div>
                {isSlowRequest ? (
                  <button
                    type="button"
                    onClick={cancelRequest}
                    className="mt-2 rounded-full border border-accent/50 bg-accent/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-accent transition active:scale-95 hover:bg-accent/30"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-muted-2">
            API-backed mode uses server-side AI when configured and local fallback when not. Syli only recommends real app routes and known products from your context.
          </div>
        </section>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-hairline bg-bg px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Quick Syli prompts">
          {COMPOSER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => submitPrompt(prompt)}
              disabled={isThinking}
              className="flex-none rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[9px] font-black uppercase tracking-[.12em] text-white/62 transition active:scale-95 hover:border-accent/45 hover:text-white disabled:opacity-45"
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="rounded-[26px] border border-accent/35 bg-[radial-gradient(circle_at_18%_0%,rgba(246,48,107,.18),transparent_44%),rgba(255,255,255,.07)] p-2 shadow-[0_0_34px_rgba(246,48,107,.18)]">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Syli about your fit, closet, shopping, or trip..."
              suppressHydrationWarning
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[14px] text-ink outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              className="grid h-11 w-11 flex-none place-items-center rounded-full bg-accent text-white shadow-pink-glow transition active:scale-90 disabled:opacity-45"
              disabled={!input.trim() || isThinking}
              aria-label="Send prompt"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      </form>

      <BottomNav />
      <CheckoutSheet
        open={Boolean(checkoutProducts)}
        title={checkoutTitle}
        products={checkoutProducts || []}
        onClose={() => setCheckoutProducts(null)}
      />
    </main>
  );
}

function pickStylistCatalogProducts(products: Product[], limit: number): Product[] {
  const realProducts = sortTransparentFeedRenderableProducts(products);
  const selected: Product[] = [];
  const selectedIds = new Set<string>();
  const selectedCategories = new Set<string>();

  for (const product of realProducts) {
    if (selectedCategories.has(product.category)) continue;
    selected.push(product);
    selectedIds.add(product.id);
    selectedCategories.add(product.category);
    if (selected.length >= limit) return selected;
  }

  for (const product of realProducts) {
    if (selectedIds.has(product.id)) continue;
    selected.push(product);
    if (selected.length >= limit) break;
  }

  return selected;
}

function formatProductPrice(cents: number): string {
  if (!cents || cents <= 0) return 'Price varies';
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function productLinkStats(products: Product[]): { exactCount: number; linkedCount: number } {
  const linkedProducts = products.filter((product) => Boolean(getProductOutboundUrl(product)));
  return {
    exactCount: linkedProducts.filter((product) => isExactProductUrl(getProductOutboundUrl(product))).length,
    linkedCount: linkedProducts.length,
  };
}

function upgradeProductsWithExactLinks(products: Product[], productPool: Iterable<Product>): Product[] {
  const exactPool = sortTransparentFeedRenderableProducts(Array.from(productPool)).filter(hasExactProductLink);
  if (!products.length || !exactPool.length) return products;

  const usedIds = new Set<string>();
  const upgraded = products.map((product) => {
    if (hasExactProductLink(product)) {
      usedIds.add(product.id);
      return product;
    }

    const sameCategoryExact = exactPool.find(
      (candidate) => candidate.category === product.category && !usedIds.has(candidate.id),
    );
    const selected = sameCategoryExact || product;
    usedIds.add(selected.id);
    return selected;
  });

  if (!upgraded.some(hasExactProductLink)) {
    const fallback = exactPool.find((candidate) => !usedIds.has(candidate.id)) || exactPool[0];
    if (fallback) upgraded[upgraded.length - 1] = fallback;
  }

  return upgraded;
}

function uniqueOutfitProducts(products: Product[], limit = 6): Product[] {
  const selected: Product[] = [];
  const usedCategories = new Set<string>();
  const usedIds = new Set<string>();

  for (const product of sortTransparentFeedRenderableProducts(products)) {
    if (usedIds.has(product.id) || usedCategories.has(product.category)) continue;
    selected.push(product);
    usedIds.add(product.id);
    usedCategories.add(product.category);
    if (selected.length >= limit) return selected;
  }

  for (const product of sortTransparentFeedRenderableProducts(products)) {
    if (usedIds.has(product.id)) continue;
    selected.push(product);
    usedIds.add(product.id);
    if (selected.length >= limit) break;
  }

  return selected;
}

function SyliCatalogStrip({
  products,
  onShopAll,
  onBuild,
  onStudio,
}: {
  products: Product[];
  onShopAll: () => void;
  onBuild: () => void;
  onStudio: () => void;
}) {
  if (!products.length) return null;
  const previewProducts = uniqueOutfitProducts(products, 6);
  const linkStats = productLinkStats(products);
  const previewLinkStats = productLinkStats(previewProducts);
  const catalogHosts = Array.from(
    new Set(products.map((product) => getCheckoutUrlHost(getProductOutboundUrl(product)))),
  )
    .slice(0, 8)
    .join(',');

  return (
    <section
      className="mt-5 rounded-[26px] border border-white/10 bg-white/[0.045] p-3 shadow-[0_18px_44px_rgba(0,0,0,.18)]"
      data-syli-real-catalog
      data-syli-catalog-link-quality={`${linkStats.exactCount}/${linkStats.linkedCount}`}
      data-syli-catalog-product-count={products.length}
      data-syli-catalog-exact-count={linkStats.exactCount}
      data-syli-catalog-linked-count={linkStats.linkedCount}
      data-syli-catalog-link-hosts={catalogHosts}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[8px] font-black uppercase tracking-[.22em] text-accent">Real catalog</div>
          <h2 className="mt-0.5 font-serif text-[20px] font-semibold leading-tight text-ink">Pieces Syli can use</h2>
          <p className="mt-1 max-w-[30ch] text-[11px] leading-snug text-muted-2">
            Tap a piece to open the exact merchant product page Syli can use.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.13em] text-emerald-100">
            <ShoppingBag size={10} />
            {linkStats.exactCount}/{linkStats.linkedCount} exact
          </div>
        </div>
        <button
          type="button"
          onClick={onShopAll}
          className="inline-flex flex-none items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-[8px] font-black uppercase tracking-[.14em] text-emerald-100 transition active:scale-95"
        >
          Shop
          <ShoppingBag size={12} />
        </button>
      </div>

      {previewProducts.length >= 3 ? (
        <div className="mt-3 rounded-[24px] border border-white/10 bg-black/18 p-2">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div className="text-[8px] font-black uppercase tracking-[.18em] text-accent">Starter fit</div>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[.13em] text-emerald-100">
              {previewLinkStats.exactCount}/{previewLinkStats.linkedCount} exact
            </span>
          </div>
          <OutfitLookCard
            items={previewProducts}
            title="Syli starter fit"
            subtitle="Real, shoppable pieces"
            compact
            presentation="flatlay"
            className="h-[260px]"
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onBuild}
              className="rounded-full bg-accent px-3 py-2 text-[9px] font-black uppercase tracking-[.14em] text-white shadow-pink-glow transition active:scale-95"
            >
              Build
            </button>
            <button
              type="button"
              onClick={onStudio}
              className="rounded-full border border-accent/35 bg-accent/12 px-3 py-2 text-[9px] font-black uppercase tracking-[.14em] text-ink transition active:scale-95"
            >
              Editor
            </button>
            <button
              type="button"
              onClick={onShopAll}
              className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-[9px] font-black uppercase tracking-[.14em] text-emerald-100 transition active:scale-95"
            >
              Shop
            </button>
          </div>
        </div>
      ) : null}

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => {
          const outboundUrl = getProductOutboundUrl(product);
          const exact = isExactProductUrl(outboundUrl);
          return (
            <a
              key={product.id}
              href={outboundUrl}
              target="_blank"
              rel="noreferrer"
              data-syli-catalog-link-kind={exact ? 'exact' : 'blocked'}
              data-syli-catalog-link-host={getCheckoutUrlHost(outboundUrl)}
              data-syli-catalog-category={product.category}
              className="group w-[132px] flex-none rounded-[22px] border border-white/10 bg-black/22 p-2 transition hover:border-accent/40 hover:bg-black/32"
            >
              <div className="h-[112px] overflow-hidden rounded-[18px] border border-white/10 bg-black/24">
                <ProductImage
                  product={product}
                  transparentOnly
                  displayMode="closet"
                  wrapperClassName="h-full w-full overflow-visible bg-transparent"
                  className="h-full w-full object-contain p-2 drop-shadow-[0_20px_20px_rgba(0,0,0,.3)]"
                />
              </div>
              <div className="mt-2 min-w-0">
                <div className="truncate text-[8px] font-black uppercase tracking-[.16em] text-accent">{product.brand}</div>
                <div className="mt-0.5 line-clamp-2 min-h-[30px] text-[11px] font-semibold leading-tight text-ink">
                  {product.name}
                </div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="truncate text-[10px] font-semibold text-white/58">{formatProductPrice(product.priceCents)}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[.11em] ${
                    exact ? 'bg-emerald-400/10 text-emerald-100' : 'bg-amber-400/10 text-amber-100'
                  }`}>
                    {exact ? 'Exact' : 'Refresh'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[8px] font-bold text-white/36 group-hover:text-white/60">
                  <span className="truncate">{getCheckoutUrlHost(outboundUrl)}</span>
                  <ExternalLink size={10} className="flex-none" />
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function ContextPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-2 py-2.5 text-center">
      <div className="font-serif text-[19px] font-semibold leading-none text-ink">{value}</div>
      <div className="mt-1 text-[8px] font-black uppercase tracking-[.16em] text-muted">{label}</div>
    </div>
  );
}

function RecommendedProducts({
  productsById,
  recommendations,
  onApply,
  onStudio,
  onWishlist,
  onShop,
}: {
  productsById: Map<string, Product>;
  recommendations: Array<{ productId: string; reason: string }>;
  onApply: () => void;
  onStudio: () => void;
  onWishlist: () => void;
  onShop: () => void;
}) {
  const products = recommendations
    .map((recommendation) => {
      const product = productsById.get(recommendation.productId);
      return product ? { product, reason: recommendation.reason } : null;
    })
    .filter((entry): entry is { product: Product; reason: string } => Boolean(entry));
  const visibleProductIds = new Set(sortTransparentFeedRenderableProducts(products.map(({ product }) => product)).map((product) => product.id));
  const visibleProducts = products.filter(({ product }) => visibleProductIds.has(product.id));

  if (!visibleProducts.length) return null;
  const reasonByProductId = new Map(visibleProducts.map(({ product, reason }) => [product.id, reason]));
  const previewProducts = upgradeProductsWithExactLinks(
    visibleProducts.map(({ product }) => product),
    productsById.values(),
  );
  const upgradedVisibleProducts = previewProducts.map((product) => ({
    product,
    reason:
      reasonByProductId.get(product.id)
      || `${product.brand} has a real merchant product page and a clean cutout, so Syli swapped it in to keep this set shoppable.`,
  }));
  const canPreview = previewProducts.length >= 3;
  const linkStats = productLinkStats(previewProducts);
  const recommendationHosts = Array.from(
    new Set(previewProducts.map((product) => getCheckoutUrlHost(getProductOutboundUrl(product)))),
  )
    .slice(0, 8)
    .join(',');

  return (
    <div
      className="mt-3 space-y-2"
      data-syli-recommendation-link-quality={`${linkStats.exactCount}/${linkStats.linkedCount}`}
      data-syli-recommendation-product-count={previewProducts.length}
      data-syli-recommendation-exact-count={linkStats.exactCount}
      data-syli-recommendation-linked-count={linkStats.linkedCount}
      data-syli-recommendation-link-hosts={recommendationHosts}
    >
      {canPreview ? (
        <div className="rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(246,48,107,.14),transparent_44%),rgba(0,0,0,.18)] p-2">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <div className="text-[7px] font-black uppercase tracking-[.2em] text-accent">Syli outfit preview</div>
              <div className="mt-0.5 text-[10px] font-semibold text-white/64">Real catalog pieces with shopping links</div>
            </div>
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[.12em] text-accent">
              {linkStats.exactCount}/{linkStats.linkedCount} exact
            </span>
          </div>
            <OutfitLookCard
              items={previewProducts}
              title="Syli outfit preview"
              subtitle="Real catalog pick"
              compact
              presentation="flatlay"
              className="h-[260px]"
            />
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={onApply}
          className="rounded-full bg-accent px-3 py-2 text-[9px] font-black uppercase tracking-[.14em] text-white shadow-pink-glow transition active:scale-95"
        >
          Build
        </button>
        <button
          type="button"
          onClick={onStudio}
          className="rounded-full border border-accent/35 bg-accent/12 px-3 py-2 text-[9px] font-black uppercase tracking-[.14em] text-ink transition active:scale-95"
        >
          Studio
        </button>
        <button
          type="button"
          onClick={onShop}
          className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-[.14em] text-emerald-100 transition active:scale-95"
        >
          Shop
        </button>
        <button
          type="button"
          onClick={onWishlist}
          className="rounded-full border border-white/18 bg-white/[0.06] px-3 py-2 text-[9px] font-black uppercase tracking-[.14em] text-ink transition active:scale-95"
        >
          Wishlist
        </button>
      </div>
      {upgradedVisibleProducts.map(({ product, reason }) => {
        const outboundUrl = getProductOutboundUrl(product);
        const exact = isExactProductUrl(outboundUrl);
        return (
        <a
          key={product.id}
          href={outboundUrl}
          target="_blank"
          rel="noreferrer"
          data-syli-product-link-kind={exact ? 'exact' : 'blocked'}
          data-syli-product-link-host={getCheckoutUrlHost(outboundUrl)}
          data-syli-product-category={product.category}
          className="flex gap-2 rounded-[18px] border border-white/10 bg-black/20 p-2 text-left transition hover:border-accent/40 hover:bg-black/30"
        >
          <div className="h-14 w-14 flex-none overflow-hidden rounded-[14px] border border-white/10 bg-black/24">
            <ProductImage
              product={product}
              transparentOnly
              displayMode="thumbnail"
              wrapperClassName="h-full w-full overflow-visible bg-transparent"
              className="h-full w-full object-contain p-1.5 drop-shadow-[0_14px_14px_rgba(0,0,0,.28)]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[9px] font-black uppercase tracking-[.16em] text-accent">{product.brand}</div>
            <div className="truncate text-[12px] font-semibold text-ink">{product.name}</div>
            <div className="max-h-[28px] overflow-hidden text-[10px] leading-snug text-muted-2">{reason}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[.13em] text-white/54">
                {getCheckoutUrlHost(outboundUrl)}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-[.13em] ${
                exact ? 'bg-emerald-400/10 text-emerald-100 ring-1 ring-emerald-400/20' : 'bg-amber-400/10 text-amber-100 ring-1 ring-amber-400/20'
              }`}>
                {exact ? 'Exact' : 'Refresh'}
              </span>
            </div>
          </div>
          <ExternalLink size={13} className="mt-1 flex-none text-white/38" />
        </a>
        );
      })}
    </div>
  );
}

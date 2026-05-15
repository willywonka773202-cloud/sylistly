'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Send,
  Shirt,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import type { Category, Product } from '@/lib/types';
import { useFit } from '@/store/fit';
import { useSavedFits } from '@/store/saved-fits';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

type StylistIntent = 'make' | 'rate' | 'packing' | 'closet' | 'piece';

interface PromptCard {
  intent: StylistIntent;
  title: string;
  body: string;
  prompt: string;
  icon: typeof Sparkles;
}

interface Message {
  id: string;
  role: 'user' | 'syli';
  text: string;
  cta?: {
    label: string;
    href: string;
  };
}

const REQUIRED_CATEGORIES: Category[] = ['top', 'bottom', 'shoes'];
const PLANNING_CATEGORIES: Category[] = ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'];

const PROMPTS: PromptCard[] = [
  {
    intent: 'make',
    title: 'Make me an outfit',
    body: 'Start a real build from the Builder.',
    prompt: 'Make me an outfit',
    icon: Sparkles,
  },
  {
    intent: 'rate',
    title: 'Rate my current fit',
    body: 'Check filled slots, required pieces, and total.',
    prompt: 'Rate my current fit',
    icon: Star,
  },
  {
    intent: 'packing',
    title: 'Create a packing list',
    body: 'Use your closet and saved fits as the base.',
    prompt: 'Create a packing list',
    icon: ClipboardList,
  },
  {
    intent: 'closet',
    title: 'Complete my closet',
    body: 'Find gaps from your real wardrobe.',
    prompt: 'Complete my closet',
    icon: Boxes,
  },
  {
    intent: 'piece',
    title: 'Build around a piece',
    body: 'Open wardrobe or Builder to choose the anchor.',
    prompt: 'Build around a piece',
    icon: Shirt,
  },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

function categoryLabel(category: Category): string {
  if (category === 'hat') return 'headwear';
  return category;
}

function productsByCategory(products: Product[]): Partial<Record<Category, number>> {
  return products.reduce<Partial<Record<Category, number>>>((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});
}

function detectIntent(input: string): StylistIntent {
  const normalized = input.toLowerCase();
  if (normalized.includes('pack') || normalized.includes('trip') || normalized.includes('travel')) return 'packing';
  if (normalized.includes('closet') || normalized.includes('gap') || normalized.includes('missing') || normalized.includes('complete')) return 'closet';
  if (normalized.includes('rate') || normalized.includes('score') || normalized.includes('current fit') || normalized.includes('review')) return 'rate';
  if (normalized.includes('piece') || normalized.includes('around') || normalized.includes('anchor') || normalized.includes('item')) return 'piece';
  return 'make';
}

export default function StylistPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => setHasMounted(true), []);

  const currentFitItems = useFit((state) => state.items);
  const savedFits = useSavedFits((state) => state.fits);
  const wardrobeItems = useWardrobe(selectWardrobeItems);

  const currentProducts = useMemo(
    () => (hasMounted ? Object.values(currentFitItems).filter((item): item is Product => Boolean(item)) : []),
    [currentFitItems, hasMounted],
  );
  const closetProducts = useMemo(
    () => (hasMounted ? wardrobeItems.filter((item) => item.status === 'closet').map((item) => item.product) : []),
    [wardrobeItems, hasMounted],
  );
  const savedProducts = useMemo(
    () =>
      hasMounted
        ? savedFits.flatMap((fit) => Object.values(fit.items).filter((item): item is Product => Boolean(item)))
        : [],
    [savedFits, hasMounted],
  );

  const localContext = useMemo(() => {
    const currentTotal = currentProducts.reduce((sum, product) => sum + product.priceCents, 0);
    const currentCategories = new Set(currentProducts.map((product) => product.category));
    const closetCategories = new Set(closetProducts.map((product) => product.category));
    const savedCategories = new Set(savedProducts.map((product) => product.category));
    const availableCategories = new Set([...closetCategories, ...savedCategories]);
    const missingRequired = REQUIRED_CATEGORIES.filter((category) => !currentCategories.has(category));
    const closetGaps = PLANNING_CATEGORIES.filter((category) => !closetCategories.has(category));
    const packingGaps = PLANNING_CATEGORIES.filter((category) => !availableCategories.has(category));
    const closetDistribution = productsByCategory(closetProducts);

    return {
      currentTotal,
      missingRequired,
      closetGaps,
      packingGaps,
      closetDistribution,
    };
  }, [closetProducts, currentProducts, savedProducts]);

  function buildResponse(intent: StylistIntent, rawPrompt: string): Message {
    if (intent === 'rate') {
      const filled = currentProducts.length;
      if (filled === 0) {
        return {
          id: `syli-${Date.now()}`,
          role: 'syli',
          text: 'I do not see a current build yet. Open Builder, add a top, bottom, and shoes, then I can rate the real fit from those local pieces.',
          cta: { label: 'Open Builder', href: '/build' },
        };
      }

      const missing = localContext.missingRequired.map(categoryLabel);
      const score = Math.min(10, Math.max(4, filled + (missing.length === 0 ? 3 : 0)));
      return {
        id: `syli-${Date.now()}`,
        role: 'syli',
        text:
          missing.length === 0
            ? `Your current fit has ${filled} piece${filled === 1 ? '' : 's'} and covers the required top, bottom, and shoes slots. Local read: ${score}/10. Estimated visible total is ${formatPrice(localContext.currentTotal)}. Next move: refine accessories or save it.`
            : `Your current fit has ${filled} piece${filled === 1 ? '' : 's'} with an estimated total of ${formatPrice(localContext.currentTotal)}. Local read: ${score}/10 because it is missing ${missing.join(', ')}. Fill those slots before styling accessories.`,
        cta: { label: missing.length === 0 ? 'Save or refine fit' : 'Finish in Builder', href: '/build' },
      };
    }

    if (intent === 'packing') {
      const owned = closetProducts.length;
      const saved = savedFits.length;
      const gaps = localContext.packingGaps.map(categoryLabel);
      return {
        id: `syli-${Date.now()}`,
        role: 'syli',
        text:
          gaps.length === 0
            ? `Packing base is strong: I can see ${owned} closet piece${owned === 1 ? '' : 's'} and ${saved} saved fit${saved === 1 ? '' : 's'} covering the core categories. Use saved outfits as complete looks, then add one backup top and shoes from your closet.`
            : `For a packing list, I can use ${owned} closet piece${owned === 1 ? '' : 's'} and ${saved} saved fit${saved === 1 ? '' : 's'}. Your local data is light on ${gaps.slice(0, 4).join(', ')}, so add those before relying on this as a complete trip list.`,
        cta: { label: gaps.length ? 'Fill wardrobe gaps' : 'Review saved fits', href: gaps.length ? '/wardrobe' : '/saved' },
      };
    }

    if (intent === 'closet') {
      const gaps = localContext.closetGaps.map(categoryLabel);
      const strongest = Object.entries(localContext.closetDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([category]) => categoryLabel(category as Category));
      return {
        id: `syli-${Date.now()}`,
        role: 'syli',
        text:
          gaps.length === 0
            ? `Your closet covers all core Sylistly categories. Strongest areas: ${strongest.join(', ') || 'balanced basics'}. Next move is editing quality, not adding volume.`
            : `Your closet has ${closetProducts.length} real piece${closetProducts.length === 1 ? '' : 's'}. The clearest gaps are ${gaps.slice(0, 5).join(', ')}. Start with top, bottom, and shoes if any are missing, then add outerwear and bag for complete outfit range.`,
        cta: { label: 'Open Wardrobe', href: '/wardrobe' },
      };
    }

    if (intent === 'piece') {
      return {
        id: `syli-${Date.now()}`,
        role: 'syli',
        text: `I can help you build around a real selected piece, but this beta does not invent items from "${rawPrompt}". Open Wardrobe to choose an owned or wished item, or open Builder and lock the anchor piece before generating around it.`,
        cta: { label: wardrobeItems.length > 0 ? 'Choose from Wardrobe' : 'Open Builder', href: wardrobeItems.length > 0 ? '/wardrobe' : '/build' },
      };
    }

    return {
      id: `syli-${Date.now()}`,
      role: 'syli',
      text: 'I can start the outfit in Builder using the real generator and catalog-backed products. This chat is local guidance only, so I will not pretend to generate a fit here.',
      cta: { label: 'Make outfit in Builder', href: '/build' },
    };
  }

  function submitPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const intent = detectIntent(trimmed);
    const now = Date.now();
    setMessages((current) => [
      ...current,
      { id: `user-${now}`, role: 'user', text: trimmed },
      buildResponse(intent, trimmed),
    ]);
    setInput('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(input);
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col overflow-hidden bg-bg">
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
            <h1 className="mt-0.5 font-serif text-[26px] font-semibold leading-tight text-ink">AI Stylist</h1>
          </div>
          <span className="rounded-full border border-accent/45 bg-accent/14 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-accent">
            Local stylist beta
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
        <section className="rounded-[28px] border border-white/12 bg-[radial-gradient(circle_at_20%_0%,rgba(246,48,107,.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03))] p-4 shadow-[0_24px_60px_rgba(0,0,0,.34)]">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
              <Wand2 size={20} />
            </span>
            <div>
              <div className="font-serif text-[21px] font-semibold leading-tight text-ink">Syli uses your local style data.</div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-2">
                Responses are rule-based from your saved fits, wardrobe, wishlist, and current build. No backend AI is called here.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <ContextPill label="Saved" value={hasMounted ? savedFits.length : 0} />
            <ContextPill label="Closet" value={hasMounted ? closetProducts.length : 0} />
            <ContextPill label="Build" value={hasMounted ? currentProducts.length : 0} />
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[8px] font-bold uppercase tracking-[.22em] text-accent">Prompts</div>
              <div className="font-serif text-[18px] font-semibold leading-tight text-ink">Ask Syli</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {PROMPTS.map((prompt) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={prompt.intent}
                  type="button"
                  onClick={() => submitPrompt(prompt.prompt)}
                  className="group flex items-center gap-3 rounded-[22px] border border-white/12 bg-white/[0.05] p-3 text-left shadow-[0_12px_26px_rgba(0,0,0,.2)] transition active:scale-[0.98] hover:border-accent/50 hover:bg-white/[0.08] motion-safe:transition-all motion-safe:duration-200"
                >
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-accent/16 text-accent transition group-hover:bg-accent group-hover:text-white">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[15px] font-semibold leading-tight text-ink">{prompt.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-2">{prompt.body}</span>
                  </span>
                  <ArrowRight size={15} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 space-y-3">
          <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.22em] text-accent">
            <MessageCircle size={12} />
            Chat
          </div>

          {messages.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 text-[12px] leading-relaxed text-muted-2">
              Start with a prompt above or type a request. Syli will answer with local guidance and route you to the real app flow.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`syli-message ${message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
              >
                <div
                  className={`max-w-[86%] rounded-[24px] px-4 py-3 text-[12px] leading-relaxed shadow-[0_12px_28px_rgba(0,0,0,.22)] ${
                    message.role === 'user'
                      ? 'bg-accent text-white'
                      : 'border border-white/12 bg-white/[0.06] text-muted-2'
                  }`}
                >
                  <p>{message.text}</p>
                  {message.cta ? (
                    <Link
                      href={message.cta.href}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-black transition active:scale-95"
                    >
                      {message.cta.label}
                      <ArrowRight size={11} />
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-hairline bg-bg px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] p-1.5">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about your fit, closet, or packing..."
            className="min-w-0 flex-1 bg-transparent px-3 text-[13px] text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent text-white shadow-pink-glow transition active:scale-90 disabled:opacity-45"
            disabled={!input.trim()}
            aria-label="Send prompt"
          >
            <Send size={16} />
          </button>
        </div>
      </form>

      <BottomNav />
    </main>
  );
}

function ContextPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[.18em] text-muted">
        <CheckCircle2 size={10} className="text-accent" />
        {label}
      </div>
      <div className="mt-1 font-serif text-[20px] font-semibold leading-none text-ink">{value}</div>
    </div>
  );
}

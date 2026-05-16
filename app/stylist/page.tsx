'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  MessageCircle,
  Send,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { buildStylistContext } from '@/lib/stylist/context';
import { generateLocalStylistResponse } from '@/lib/stylist/local-response';
import type { StylistAction, StylistContext, StylistMessage, StylistUserIntent } from '@/lib/stylist/types';
import { useFit } from '@/store/fit';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { useSocialFeed } from '@/store/social-feed';
import { selectWardrobeItems, useWardrobe } from '@/store/wardrobe';

interface PromptCard {
  intent: StylistUserIntent;
  title: string;
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
      { intent: 'outfit_request', title: 'Build a fit for today', prompt: 'Build a fit for today', icon: Sparkles },
      { intent: 'build_around_piece', title: 'Build around a piece', prompt: 'Build around a piece', icon: Shirt },
    ],
  },
  {
    label: 'Wardrobe help',
    prompts: [
      { intent: 'complete_closet', title: 'Complete my closet', prompt: 'Complete my closet', icon: Boxes },
      { intent: 'packing_list', title: 'Create a packing list', prompt: 'Create a packing list', icon: ClipboardList },
    ],
  },
  {
    label: 'Shopping help',
    prompts: [
      { intent: 'shopping_advice', title: 'What should I buy next?', prompt: 'What should I buy next?', icon: ShoppingBag },
      { intent: 'saved_fit_remix', title: 'Remix saved fits', prompt: 'Remix my saved style', icon: Wand2 },
    ],
  },
  {
    label: 'Style review',
    prompts: [
      { intent: 'rate_current_fit', title: 'Rate current fit', prompt: 'Rate my current fit', icon: Star },
      { intent: 'style_dna', title: 'Read my style DNA', prompt: 'What is my style DNA?', icon: MessageCircle },
    ],
  },
];

function emptyContext(): StylistContext {
  return buildStylistContext({
    currentFitItems: {},
    savedFits: [],
    wardrobeItems: [],
    feedPosts: [],
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

export default function StylistPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<StylistMessage[]>([]);

  useEffect(() => setHasMounted(true), []);

  const currentFitItems = useFit((state) => state.items);
  const savedFits = useSavedFits((state) => state.fits);
  const wardrobeItems = useWardrobe(selectWardrobeItems);
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
            profile,
          })
        : emptyContext(),
    [currentFitItems, feedPosts, hasMounted, profile, savedFits, wardrobeItems],
  );

  function submitPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const response = generateLocalStylistResponse(trimmed, context);
    const now = Date.now();
    setMessages((current) => [
      ...current,
      {
        id: `user-${now}`,
        role: 'user',
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
      messageFromResponse(`syli-${now}`, response.message, response.actions),
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
            <h1 className="mt-0.5 font-serif text-[28px] font-semibold leading-tight text-ink">AI Stylist</h1>
          </div>
          <span className="rounded-full border border-accent/45 bg-accent/14 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-accent">
            Local beta
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-2">
          Local beta until cloud AI is connected. Responses are rule-based from your saved fits, wardrobe, wishlist, feed likes, profile, and current build. No backend AI is called here.
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
                Syli routes you to real app flows and does not invent wardrobe items, purchases, or cloud-generated answers.
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

        <section className="mt-5 space-y-4">
          {PROMPT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-2 text-[8px] font-bold uppercase tracking-[.22em] text-accent">{group.label}</div>
              <div className="grid grid-cols-2 gap-2">
                {group.prompts.map((prompt) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.intent}
                      type="button"
                      onClick={() => submitPrompt(prompt.prompt)}
                      className="sy-lift sy-press group flex min-h-[102px] flex-col rounded-[20px] border border-white/12 bg-white/[0.05] p-3 text-left shadow-[0_12px_26px_rgba(0,0,0,.2)] transition hover:border-accent/50 hover:bg-white/[0.08] motion-safe:transition-all motion-safe:duration-200"
                    >
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-2xl bg-accent/16 text-accent transition group-hover:bg-accent group-hover:text-white">
                        <Icon size={16} />
                      </span>
                      <span className="mt-2 block font-serif text-[15px] font-semibold leading-tight text-ink">{prompt.title}</span>
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
                            cta.primary ? 'bg-accent text-white shadow-pink-glow' : 'bg-white text-black'
                          }`}
                        >
                          {cta.label}
                          <ArrowRight size={11} />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}

          <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-muted-2">
            Connect real AI later: replace the local response call with the `/api/stylist` backend once server-side provider keys are configured.
          </div>
        </section>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-hairline bg-bg px-4 py-3">
        <div className="rounded-[26px] border border-accent/35 bg-[radial-gradient(circle_at_18%_0%,rgba(246,48,107,.18),transparent_44%),rgba(255,255,255,.07)] p-2 shadow-[0_0_34px_rgba(246,48,107,.18)]">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Syli about your fit, closet, shopping, or trip..."
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[14px] text-ink outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              className="grid h-11 w-11 flex-none place-items-center rounded-full bg-accent text-white shadow-pink-glow transition active:scale-90 disabled:opacity-45"
              disabled={!input.trim()}
              aria-label="Send prompt"
            >
              <Send size={17} />
            </button>
          </div>
        </div>
      </form>

      <BottomNav />
    </main>
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

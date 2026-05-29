'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Sparkles, Wand2, Bookmark, ChevronDown } from 'lucide-react';
import { AppShell, AppHeader } from '@/components/AppShell';
import { Avatar, Chip, PremiumButton } from '@/components/Primitives';
import { OutfitCollage } from '@/components/OutfitCollage';
import { successToast } from '@/components/Toast';
import { STYLIST_ACTIONS, composeReply, type DraftOutfit, type StylistActionId } from '@/lib/stylist';
import { OCCASIONS_SOCIAL, type OccasionKey, type Outfit } from '@/lib/social-types';
import { dnaInsights } from '@/lib/recommend';
import { aestheticLabel } from '@/lib/style';
import { useMyClosetItems } from '@/store/closet';
import { useStyleDNA } from '@/store/style-dna';
import { useOutfits } from '@/store/outfits';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  bullets?: string[];
  draft?: DraftOutfit;
}

const PERSONALITIES = [
  { id: 'editorial', name: 'Editorial' },
  { id: 'hype', name: 'Hype' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'bestie', name: 'Bestie' },
];

function detectAction(text: string): StylistActionId {
  const t = text.toLowerCase();
  if (/pack|trip|travel|vacation|suitcase/.test(t)) return 'pack';
  if (/rate|score|feedback|how.?s my/.test(t)) return 'rate';
  if (/capsule|versatile|essential/.test(t)) return 'capsule';
  if (/improve|gap|missing|better|elevate/.test(t)) return 'improve';
  if (/today|wear today|what should i wear/.test(t)) return 'today';
  return 'make-outfit';
}

function detectOccasion(text: string): OccasionKey | undefined {
  const t = text.toLowerCase();
  return OCCASIONS_SOCIAL.find((o) => t.includes(o.key) || t.includes(o.label.toLowerCase()))?.key;
}

function StylistChat() {
  const router = useRouter();
  const params = useSearchParams();
  const closet = useMyClosetItems();
  const dna = useStyleDNA((s) => s.dna);
  const saveOutfit = useOutfits((s) => s.saveOutfit);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [persona, setPersona] = useState(PERSONALITIES[0]);
  const [personaOpen, setPersonaOpen] = useState(false);
  const seed = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const ranAction = useRef(false);

  const insights = dnaInsights(dna);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function run(actionId: StylistActionId, userText: string, occasion?: OccasionKey) {
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text: userText };
    const reply = composeReply(actionId, { closet, dna, occasion, seed: seed.current++ });
    const aId = `a-${Date.now()}`;
    const asstMsg: Msg = { id: aId, role: 'assistant', text: reply.text, bullets: reply.bullets, draft: reply.outfit };
    setMessages((m) => [...m, userMsg, asstMsg]);

    // best-effort AI enhancement of the lead text
    const counts: Record<string, number> = {};
    closet.forEach((i) => (counts[i.category] = (counts[i.category] || 0) + 1));
    fetch('/api/stylist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: actionId,
        message: userText,
        context: {
          topAesthetic: insights.topAesthetic ? aestheticLabel(insights.topAesthetic) : undefined,
          occasion,
          closetSummary: Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', '),
        },
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.text) setMessages((m) => m.map((msg) => (msg.id === aId ? { ...msg, text: d.text } : msg)));
      })
      .catch(() => {});
  }

  // auto-run action from query
  useEffect(() => {
    if (ranAction.current) return;
    ranAction.current = true;
    const a = params.get('action') as StylistActionId | null;
    if (a && STYLIST_ACTIONS.some((x) => x.id === a)) {
      const def = STYLIST_ACTIONS.find((x) => x.id === a)!;
      run(a, def.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    run(detectAction(text), text, detectOccasion(text));
  }

  function draftToOutfit(d: DraftOutfit): Outfit {
    return {
      id: `stylist-${Date.now()}`,
      title: d.title,
      caption: '',
      itemIds: d.itemIds,
      layout: d.layout,
      background: d.background,
      preset: 'editorial',
      occasion: d.occasion,
      aesthetics: d.aesthetics,
      visibility: 'private',
      ownerId: 'me',
      createdAt: new Date().toISOString(),
      likes: 0,
      saves: 0,
      source: 'user',
    };
  }

  const suggestions = useMemo(() => STYLIST_ACTIONS, []);

  return (
    <AppShell
      showTabBar={false}
      pad={false}
      header={
        <AppHeader
          back
          right={
            <div className="relative">
              <button onClick={() => setPersonaOpen((v) => !v)} className="flex items-center gap-1 px-3 h-9 rounded-full bg-surface-1 border border-hairline text-[13px] font-medium text-ink-soft">
                {persona.name} <ChevronDown size={14} />
              </button>
              {personaOpen && (
                <div className="absolute right-0 mt-1 w-36 rounded-2xl bg-surface-1 border border-hairline shadow-float overflow-hidden z-30">
                  {PERSONALITIES.map((p) => (
                    <button key={p.id} onClick={() => { setPersona(p); setPersonaOpen(false); }} className={`w-full text-left px-3 py-2.5 text-[13px] ${p.id === persona.id ? 'bg-surface-2 text-ink font-semibold' : 'text-ink-soft'}`}>
                      {p.name} stylist
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
        />
      }
    >
      {/* stylist identity */}
      <div className="px-5 flex items-center gap-3 pb-2">
        <div className="relative">
          <div className="story-ring rounded-full p-[2.5px]"><div className="rounded-full p-[2px] bg-bg"><Avatar name="Sylistly Stylist" color="#16140f" size={48} /></div></div>
        </div>
        <div>
          <div className="font-display text-xl text-ink">Sylistly Stylist</div>
          <div className="text-[12px] text-muted">AI Stylist · {persona.name} tone</div>
        </div>
      </div>

      <div className="px-5 pb-44">
        {messages.length === 0 && (
          <div className="mt-2">
            <div className="rounded-3xl bg-surface-1 border border-hairline p-4">
              <Sparkles size={20} className="text-accent" />
              <p className="text-[15px] text-ink mt-2 leading-relaxed">
                Hi — I’m your stylist. I can build outfits from your closet, rate a fit, pack for a trip, or find gaps in your wardrobe. What are we doing today?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              {suggestions.map((a) => (
                <button key={a.id} onClick={() => run(a.id, a.title)} className="flex items-center gap-2.5 p-3 rounded-2xl border border-hairline text-left btn-press" style={{ background: a.tone }}>
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-ink text-cream shrink-0"><a.icon size={17} /></span>
                  <span className="text-[13px] font-semibold text-ink leading-tight">{a.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 mt-3">
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] px-4 py-2.5 rounded-3xl rounded-br-lg bg-ink text-cream text-sm">{m.text}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2.5">
                <Avatar name="S" color="#16140f" size={30} />
                <div className="max-w-[85%]">
                  <div className="px-4 py-3 rounded-3xl rounded-bl-lg bg-surface-1 border border-hairline">
                    <p className="text-[15px] text-ink leading-relaxed">{m.text}</p>
                    {m.bullets && (
                      <ul className="mt-2 space-y-1.5">
                        {m.bullets.map((b, i) => (
                          <li key={i} className="flex gap-2 text-[13px] text-ink-soft">
                            <span className="text-accent mt-0.5">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {m.draft && (
                    <div className="mt-2 rounded-3xl bg-surface-1 border border-hairline overflow-hidden">
                      <OutfitCollage outfit={{ layout: m.draft.layout, background: m.draft.background, itemIds: m.draft.itemIds }} className="w-full aspect-[5/4]" rounded="rounded-none" />
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink">{m.draft.title}</span>
                          <div className="flex gap-1.5">
                            {m.draft.aesthetics.slice(0, 1).map((a) => <Chip key={a}>{aestheticLabel(a)}</Chip>)}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <PremiumButton
                            size="sm"
                            className="flex-1"
                            icon={<Wand2 size={15} />}
                            onClick={() => {
                              const o = draftToOutfit(m.draft!);
                              saveOutfit(o);
                              router.push(`/create?edit=${o.id}`);
                            }}
                          >
                            Open in editor
                          </PremiumButton>
                          <PremiumButton
                            size="sm"
                            variant="secondary"
                            className="flex-1"
                            icon={<Bookmark size={15} />}
                            onClick={() => {
                              saveOutfit(draftToOutfit(m.draft!));
                              successToast('Saved to your looks');
                            }}
                          >
                            Save
                          </PremiumButton>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* input */}
      <div className="fixed bottom-0 inset-x-0 z-30">
        <div className="mx-auto max-w-[440px] px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 glass border-t border-hairline">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask your stylist anything…"
              className="flex-1 h-12 px-4 rounded-full bg-surface-1 border border-hairline text-sm text-ink placeholder:text-muted focus:outline-none focus:border-hairline-2"
            />
            <button onClick={send} className="grid place-items-center w-12 h-12 rounded-full bg-ink text-cream shrink-0 btn-press" aria-label="Send">
              <Send size={19} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function StylistPage() {
  return (
    <Suspense fallback={<AppShell showTabBar={false} header={<AppHeader title="Stylist" back />}><div className="grid place-items-center h-[60vh] text-muted"><Sparkles className="animate-pulse" /></div></AppShell>}>
      <StylistChat />
    </Suspense>
  );
}

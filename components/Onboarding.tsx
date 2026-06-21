'use client';

import { ArrowLeft, Check, Share2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { track } from '@/lib/analytics';
import { getLibraryLook } from '@/lib/outfit-library';
import {
  deriveIdentity,
  type StyleAnswers,
  type StyleIdentity,
} from '@/lib/style-identity';
import { VIBES, type GeneratorFrame } from '@/lib/vibes';
import { useDialogBehavior } from '@/lib/use-dialog-behavior';
import { FloatingCutouts } from './FloatingCutouts';
import { WornFlatlay } from './WornFlatlay';

const VIBE_LABEL = new Map(VIBES.map((vibe) => [vibe.id, vibe.label]));

type Question = {
  key: keyof StyleAnswers;
  title: string;
  cols: 2 | 3;
  options: { value: string; label: string; sub?: string }[];
};

const QUESTIONS: Question[] = [
  {
    key: 'lane',
    title: "What's your lane?",
    cols: 2,
    options: [
      { value: 'street', label: 'Street', sub: 'Relaxed & cool' },
      { value: 'clean', label: 'Clean', sub: 'Minimal & sharp' },
      { value: 'dressy', label: 'Dressy', sub: 'Going out' },
      { value: 'sport', label: 'Sport', sub: 'Active & sleek' },
    ],
  },
  {
    key: 'palette',
    title: 'Your colors?',
    cols: 2,
    options: [
      { value: 'neutral', label: 'Neutrals', sub: 'Cream, grey, tan' },
      { value: 'dark', label: 'All black', sub: 'Noir' },
      { value: 'earth', label: 'Earth tones', sub: 'Olive, brown, rust' },
      { value: 'bold', label: 'Bold color', sub: 'Stand out' },
    ],
  },
  {
    key: 'fit',
    title: 'Your fit?',
    cols: 3,
    options: [
      { value: 'oversized', label: 'Oversized' },
      { value: 'tailored', label: 'Tailored' },
      { value: 'relaxed', label: 'Relaxed' },
    ],
  },
  {
    key: 'budget',
    title: 'Your budget?',
    cols: 2,
    options: [
      { value: 'low', label: 'Thrifty', sub: 'Best value' },
      { value: 'mid', label: 'Mid', sub: 'Everyday' },
      { value: 'high', label: 'High', sub: 'Investment' },
      { value: 'luxury', label: 'Luxe', sub: 'No ceiling' },
    ],
  },
  {
    key: 'frame',
    title: 'Styling for?',
    cols: 3,
    options: [
      { value: 'fem', label: 'Womenswear' },
      { value: 'masc', label: 'Menswear' },
      { value: 'androgynous', label: 'Everything' },
    ],
  },
];

export function Onboarding({
  onComplete,
  onSkip,
}: {
  onComplete: (answers: StyleAnswers, identity: StyleIdentity) => void;
  onSkip: () => void;
}) {
  // -1 = welcome, 0..n-1 = questions, n = result
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<Partial<StyleAnswers>>({});
  const [identity, setIdentity] = useState<StyleIdentity | null>(null);
  const [shared, setShared] = useState(false);

  // A real outfit in the user's freshly-derived style — the payoff of finishing
  // the quiz is SEEING a look, not just reading the persona name. Uses their own
  // chosen frame; deterministic seed (per-identity) so it's stable.
  const resultLook = useMemo(() => {
    if (!identity) return null;
    const seed = identity.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const frame = (answers.frame as GeneratorFrame) || 'androgynous';
    return getLibraryLook(identity.vibes[0], frame, { seed });
  }, [identity, answers.frame]);

  // Modal behavior: focus moves into the flow, focus is trapped, background
  // scroll is locked. Escape only skips from the WELCOME screen — never
  // mid-quiz, so a stray keypress can't discard a half-finished quiz.
  const dialogRef = useDialogBehavior<HTMLDivElement>(() => {
    if (step === -1) onSkip();
  });

  function answer(question: Question, value: string) {
    const next = { ...answers, [question.key]: value } as Partial<StyleAnswers>;
    setAnswers(next);
    const isLast = step === QUESTIONS.length - 1;
    window.setTimeout(() => {
      if (isLast) {
        const full = next as StyleAnswers;
        const derived = deriveIdentity(full);
        setIdentity(derived);
        track('quiz_completed', { identity: derived.id, lane: full.lane, palette: full.palette });
        setStep(QUESTIONS.length);
      } else {
        setStep((current) => current + 1);
      }
    }, 160);
  }

  async function shareIdentity() {
    if (!identity) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.sylistly.com';
    const url = `${origin}/style/${identity.id}`;
    const text = `I'm a ${identity.name} on Sylistly ✨ what's your style?`;
    track('quiz_shared', { identity: identity.id });
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Sylistly', text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(true);
        window.setTimeout(() => setShared(false), 1600);
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Style quiz — find your look"
      tabIndex={-1}
      className="fixed inset-0 z-[90] flex flex-col bg-bg outline-none"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-8%,rgba(255,45,109,.2),transparent_46%)]" />
      {step === -1 ? <FloatingCutouts /> : null}
      <div className="relative mx-auto flex w-full max-w-[480px] flex-1 flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+40px)]">
        {/* Welcome */}
        {step === -1 ? (
          <div className="flex flex-1 flex-col">
            <div className="flex-1" />
            <div className="sy-stagger flex flex-col">
              <span className="sy-glow-breathe grid h-14 w-14 place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
                <Sparkles size={26} />
              </span>
              <div className="sy-eyebrow mt-7">Welcome to Sylistly</div>
              <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[0.95] tracking-[-0.02em] text-ink">
                Real outfits,
                <br />
                <span className="italic text-accent">styled by AI.</span>
              </h1>
              <p className="mt-4 max-w-[32ch] text-[15px] leading-relaxed text-muted-2">
                Answer 5 quick taps and we&apos;ll find your style — then your scroll fills with
                complete, shoppable fits made for it.
              </p>
            </div>
            <div className="flex-1" />
            <div className="sy-stagger flex flex-col">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="sy-cta-primary w-full px-5 py-4 text-[13px] font-bold uppercase tracking-[.14em]"
              >
                Find my style
              </button>
              <button type="button" onClick={onSkip} className="mt-3 py-2 text-[12px] font-semibold uppercase tracking-[.14em] text-muted">
                Skip — just start scrolling
              </button>
            </div>
          </div>
        ) : null}

        {/* Questions */}
        {step >= 0 && step < QUESTIONS.length ? (
          (() => {
            const question = QUESTIONS[step];
            const selected = answers[question.key];
            return (
              <div key={question.key} className="sy-enter flex flex-1 flex-col">
                {/* progress dots */}
                <div className="flex items-center gap-1.5">
                  {QUESTIONS.map((q, i) => (
                    <span
                      key={q.key}
                      className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-accent' : 'bg-hairline-2'}`}
                    />
                  ))}
                </div>
                <div className="mt-6 sy-eyebrow">
                  Step {step + 1} of {QUESTIONS.length}
                </div>
                <h2 className="mt-2 font-serif text-[32px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                  {question.title}
                </h2>

                <div className={`sy-stagger mt-7 grid gap-2.5 ${question.cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {question.options.map((option) => {
                    const active = selected === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => answer(question, option.value)}
                        className={`sy-press min-w-0 rounded-card border px-3 py-5 text-left transition ${
                          active ? 'border-accent bg-accent-soft' : 'border-hairline-2 bg-surface-1'
                        }`}
                      >
                        <div className={`text-[15px] font-bold ${active ? 'text-accent' : 'text-ink'}`}>{option.label}</div>
                        {option.sub ? <div className="mt-0.5 text-[11px] text-muted">{option.sub}</div> : null}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1" />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep((current) => current - 1)}
                    className="inline-flex items-center gap-1.5 py-2 text-[12px] font-semibold uppercase tracking-[.14em] text-muted"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                  <button type="button" onClick={onSkip} className="py-2 text-[12px] font-semibold uppercase tracking-[.14em] text-muted">
                    Skip
                  </button>
                </div>
              </div>
            );
          })()
        ) : null}

        {/* Result */}
        {step === QUESTIONS.length && identity ? (
          <div className="sy-enter flex flex-1 flex-col">
            <div className="flex-1" />
            <div className="sy-stagger flex flex-col items-start">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.16em] text-accent">
                <Sparkles size={12} />
                Your style
              </span>
              <h1 className="mt-4 font-serif text-[44px] font-semibold italic leading-[0.95] tracking-[-0.02em] text-ink">
                {identity.name}
              </h1>
              <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-muted-2">{identity.tagline}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {identity.vibes.map((vibe) => (
                  <span
                    key={vibe}
                    className="rounded-full border border-hairline-2 bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-muted-2"
                  >
                    {VIBE_LABEL.get(vibe) || vibe}
                  </span>
                ))}
              </div>
              {resultLook ? (
                <div className="mt-6 w-full max-w-[168px] self-center">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-card-lg ring-1 ring-hairline shadow-card">
                    <WornFlatlay items={resultLook.products} active loading="eager" className="h-full w-full" />
                  </div>
                  <p className="mt-2 text-center text-[11px] font-semibold text-muted">A look in your style</p>
                </div>
              ) : null}
            </div>
            <div className="flex-1" />
            <div className="sy-stagger flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => identity && onComplete(answers as StyleAnswers, identity)}
                className="sy-cta-primary w-full px-5 py-4 text-[13px] font-bold uppercase tracking-[.14em]"
              >
                <Sparkles size={15} />
                Style my feed
              </button>
              <button
                type="button"
                onClick={shareIdentity}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-hairline-2 bg-surface-2 px-5 py-3.5 text-[13px] font-bold uppercase tracking-[.14em] text-ink"
              >
                {shared ? <Check size={15} className="text-money" /> : <Share2 size={15} />}
                {shared ? 'Copied' : 'Share my style'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

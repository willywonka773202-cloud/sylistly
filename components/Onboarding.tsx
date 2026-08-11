'use client';

import { ArrowLeft, Check, Share2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { track } from '@/lib/analytics';
import { buildCatalogLook } from '@/lib/client-catalog';
import {
  deriveIdentity,
  type StyleAnswers,
  type StyleIdentity,
} from '@/lib/style-identity';
import { VIBES, type GeneratorBudget, type GeneratorFrame } from '@/lib/vibes';
import { useDialogBehavior } from '@/lib/use-dialog-behavior';
import { FloatingCutouts } from './FloatingCutouts';
import { WornFlatlay } from './WornFlatlay';

const VIBE_LABEL = new Map(VIBES.map((vibe) => [vibe.id, vibe.label]));

const PREVIEW_BUDGETS: Record<StyleAnswers['budget'], {
  budget: GeneratorBudget;
  customMaxCents?: number;
  maxTotalCents: number | null;
}> = {
  low: { budget: 'under250', maxTotalCents: 25_000 },
  mid: { budget: 'under500', maxTotalCents: 50_000 },
  high: { budget: 'custom', customMaxCents: 100_000, maxTotalCents: 100_000 },
  luxury: { budget: 'any', maxTotalCents: null },
};

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
    title: 'Your whole-look budget?',
    cols: 2,
    options: [
      { value: 'low', label: 'Under $250', sub: 'Complete outfit' },
      { value: 'mid', label: 'Under $500', sub: 'Complete outfit' },
      { value: 'high', label: 'Under $1,000', sub: 'Complete outfit' },
      { value: 'luxury', label: 'Any budget', sub: 'No ceiling' },
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

  // The payoff is a real complete outfit, built with the same strict commerce
  // contract as the feed — not a non-shoppable mood-board preview.
  const resultLook = useMemo(() => {
    if (!identity) return null;
    const seed = identity.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const frame = (answers.frame as GeneratorFrame) || 'androgynous';
    const preference = PREVIEW_BUDGETS[(answers.budget as StyleAnswers['budget']) || 'mid'];
    for (let index = 0; index < identity.vibes.length; index += 1) {
      const built = buildCatalogLook({
        vibe: identity.vibes[index],
        frame,
        budget: preference.budget,
        customMaxCents: preference.customMaxCents,
        maxTotalCents: preference.maxTotalCents,
        mode: 'full',
        seed: seed + index * 97,
        requireCompleteBuyable: true,
      });
      if (built.buyability.ok) return built;
    }
    return null;
  }, [identity, answers.frame, answers.budget]);

  // Modal behavior: focus moves into the flow, focus is trapped, background
  // scroll is locked. Escape only skips from the WELCOME screen — never
  // mid-quiz, so a stray keypress can't discard a half-finished quiz.
  const dialogRef = useDialogBehavior<HTMLDivElement>(() => {
    if (step === -1) onSkip();
  });

  // Each answer replaces the current panel. Move focus to the new heading so
  // keyboard and screen-reader users do not fall back to the document body
  // when the selected button unmounts.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>('[data-onboarding-heading]')
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dialogRef, step]);

  function answer(question: Question, value: string) {
    // Per-step funnel signal — reveals WHERE users drop off in onboarding
    // (activation is the key early metric; quiz_completed only catches finishers).
    track('onboarding_step_completed', {
      surface: 'onboarding',
      step: step + 1,
      totalSteps: QUESTIONS.length,
      stepKey: question.key,
    });
    const next = { ...answers, [question.key]: value } as Partial<StyleAnswers>;
    setAnswers(next);
    const isLast = step === QUESTIONS.length - 1;
    window.setTimeout(() => {
      if (isLast) {
        const full = next as StyleAnswers;
        const derived = deriveIdentity(full);
        setIdentity(derived);
        track('onboarding_completed', {
          surface: 'onboarding',
          style_identity_id: derived.id,
          lane: full.lane,
          palette: full.palette,
          fit: full.fit,
          budget: full.budget,
          frame: full.frame,
        });
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
    track('onboarding_shared', { surface: 'onboarding-result', style_identity_id: identity.id });
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
              <h1 data-onboarding-heading tabIndex={-1} className="mt-3 font-serif text-[40px] font-semibold leading-[0.95] tracking-[-0.02em] text-ink outline-none">
                Complete outfits,
                <br />
                <span className="italic text-accent">ready to shop.</span>
              </h1>
              <p className="mt-4 max-w-[32ch] text-[15px] leading-relaxed text-muted-2">
                Five quick choices set your style, frame, and whole-outfit budget. Then we show only complete looks with exact product pages.
              </p>
            </div>
            <div className="flex-1" />
            <div className="sy-stagger flex flex-col">
              <button
                type="button"
                onClick={() => { track('onboarding_started', { surface: 'onboarding' }); setStep(0); }}
                className="sy-cta-primary w-full px-5 py-4 text-[13px] font-bold uppercase tracking-[.14em]"
              >
                Find my style
              </button>
              <button type="button" onClick={() => { track('onboarding_skipped', { surface: 'onboarding', step: 0 }); onSkip(); }} className="mt-3 min-h-11 py-2 text-[12px] font-semibold uppercase tracking-[.14em] text-muted">
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
                <div
                  className="flex items-center gap-1.5"
                  role="progressbar"
                  aria-label="Style quiz progress"
                  aria-valuemin={1}
                  aria-valuemax={QUESTIONS.length}
                  aria-valuenow={step + 1}
                >
                  {QUESTIONS.map((q, i) => (
                    <span
                      key={q.key}
                      aria-hidden
                      className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-accent' : 'bg-hairline-2'}`}
                    />
                  ))}
                </div>
                {/* Centered between the progress dots (top) and Back/Skip (bottom),
                    matching the welcome + result steps so the quiz never pools at
                    the top with an empty void beneath on tall screens. */}
                <div className="flex flex-1 flex-col justify-center">
                  <div className="sy-eyebrow">
                    Step {step + 1} of {QUESTIONS.length}
                  </div>
                  <h2 data-onboarding-heading tabIndex={-1} className="mt-2 font-serif text-[32px] font-semibold leading-tight tracking-[-0.01em] text-ink outline-none">
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
                          aria-pressed={active}
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
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep((current) => current - 1)}
                    className="inline-flex min-h-11 items-center gap-1.5 py-2 text-[12px] font-semibold uppercase tracking-[.14em] text-muted"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                  <button type="button" onClick={() => { track('onboarding_skipped', { surface: 'onboarding', step: step + 1 }); onSkip(); }} className="min-h-11 py-2 text-[12px] font-semibold uppercase tracking-[.14em] text-muted">
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
              <h1 data-onboarding-heading tabIndex={-1} className="mt-4 font-serif text-[44px] font-semibold italic leading-[0.95] tracking-[-0.02em] text-ink outline-none">
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
                  <p className="mt-2 text-center text-[11px] font-semibold text-money">
                    Complete · ${(resultLook.buyability.totalCents / 100).toFixed(0)} total
                  </p>
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
              <span className="sr-only" role="status" aria-live="polite">
                {shared ? 'Style link copied to clipboard.' : ''}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

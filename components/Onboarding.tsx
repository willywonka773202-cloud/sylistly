'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { GeneratorFrame, VibeId } from '@/lib/vibes';

const FRAMES: { id: GeneratorFrame; label: string; sub: string }[] = [
  { id: 'fem', label: 'Womenswear', sub: 'Fem-leaning' },
  { id: 'masc', label: 'Menswear', sub: 'Masc-leaning' },
  { id: 'androgynous', label: 'Everything', sub: 'No bias' },
];

const VIBES: { id: VibeId; label: string }[] = [
  { id: 'clean', label: 'Clean' },
  { id: 'street', label: 'Streetwear' },
  { id: 'office', label: 'Office' },
  { id: 'date', label: 'Date night' },
  { id: 'gym', label: 'Athleisure' },
  { id: 'cozy', label: 'Cozy' },
];

export function Onboarding({
  onComplete,
  onSkip,
}: {
  onComplete: (frame: GeneratorFrame, vibe: VibeId) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState(0);
  const [frame, setFrame] = useState<GeneratorFrame | null>(null);
  const [vibe, setVibe] = useState<VibeId | null>(null);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-8%,rgba(255,59,99,.2),transparent_46%)]" />
      <div className="relative mx-auto flex w-full max-w-[480px] flex-1 flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+40px)]">
        {step === 0 ? (
          <div className="flex flex-1 flex-col">
            <div className="flex-1" />
            <div className="sy-stagger flex flex-col">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-white shadow-pink-glow">
                <Sparkles size={26} />
              </span>
              <div className="sy-eyebrow mt-7">Welcome to Sylistly</div>
              <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[0.95] tracking-[-0.02em] text-ink">
                Real outfits,
                <br />
                <span className="italic text-accent">styled by AI.</span>
              </h1>
              <p className="mt-4 max-w-[32ch] text-[15px] leading-relaxed text-muted-2">
                Pick a vibe and Syli composes a complete, color-matched fit from real, shoppable pieces — then save it, shop it, or remix it.
              </p>
            </div>
            <div className="flex-1" />
            <div className="sy-stagger flex flex-col">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="sy-cta-primary w-full px-5 py-4 text-[13px] font-bold uppercase tracking-[.14em]"
              >
                Get started
              </button>
              <button type="button" onClick={onSkip} className="mt-3 py-2 text-[12px] font-semibold uppercase tracking-[.14em] text-muted">
                Skip for now
              </button>
            </div>
          </div>
        ) : (
          <div className="sy-enter flex flex-1 flex-col">
            <div className="sy-eyebrow">Step 2 of 2</div>
            <h2 className="mt-2 font-serif text-[30px] font-semibold leading-tight tracking-[-0.01em] text-ink">Set your style</h2>

            <div className="mt-6 text-[12px] font-bold uppercase tracking-[.14em] text-muted-2">Styling for</div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {FRAMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFrame(option.id)}
                  className={`sy-press min-w-0 rounded-2xl border px-1.5 py-3 text-center transition ${
                    frame === option.id ? 'border-accent bg-accent-soft' : 'border-hairline-2 bg-surface-1'
                  }`}
                >
                  <div className={`truncate text-[12.5px] font-bold ${frame === option.id ? 'text-accent' : 'text-ink'}`}>{option.label}</div>
                  <div className="mt-0.5 truncate text-[10px] text-muted">{option.sub}</div>
                </button>
              ))}
            </div>

            <div className="mt-7 text-[12px] font-bold uppercase tracking-[.14em] text-muted-2">Start with a vibe</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {VIBES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setVibe(option.id)}
                  className={`sy-press rounded-full border px-4 py-2.5 text-[13px] font-semibold transition ${
                    vibe === option.id ? 'sy-chip-active' : 'sy-chip'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex-1" />
            <button
              type="button"
              disabled={!frame || !vibe}
              onClick={() => frame && vibe && onComplete(frame, vibe)}
              className="sy-cta-primary w-full px-5 py-4 text-[13px] font-bold uppercase tracking-[.14em] disabled:opacity-50"
            >
              <Sparkles size={15} />
              Style my first fit
            </button>
            <button type="button" onClick={() => setStep(0)} className="mt-3 py-2 text-[12px] font-semibold uppercase tracking-[.14em] text-muted">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

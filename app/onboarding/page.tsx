'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Heart, X, Sparkles } from 'lucide-react';
import { OutfitCollage } from '@/components/OutfitCollage';
import { PremiumButton } from '@/components/Primitives';
import { AESTHETICS, OCCASIONS_SOCIAL, type AestheticId, type OccasionKey } from '@/lib/social-types';
import { publicOutfits } from '@/lib/data';
import { dnaInsights } from '@/lib/recommend';
import { aestheticLabel } from '@/lib/style';
import { useMe } from '@/store/me';
import { useStyleDNA } from '@/store/style-dna';

const STEPS = 5;

export default function OnboardingPage() {
  const router = useRouter();
  const setAesthetics = useMe((s) => s.setAesthetics);
  const setOccasions = useMe((s) => s.setOccasions);
  const complete = useMe((s) => s.completeOnboarding);
  const swipe = useStyleDNA((s) => s.swipe);
  const dna = useStyleDNA((s) => s.dna);

  const [step, setStep] = useState(0);
  const [aes, setAes] = useState<Set<AestheticId>>(new Set());
  const [occ, setOcc] = useState<Set<OccasionKey>>(new Set());
  const [swipeIdx, setSwipeIdx] = useState(0);

  const deck = useMemo(() => publicOutfits().slice(0, 6), []);
  const insights = dnaInsights(dna);

  function finish() {
    setAesthetics([...aes]);
    setOccasions([...occ]);
    complete();
    router.replace('/');
  }
  function skip() {
    complete();
    router.replace('/');
  }
  function next() {
    if (step === STEPS - 1) finish();
    else setStep((s) => s + 1);
  }

  function doSwipe(action: 'like' | 'dislike') {
    const o = deck[swipeIdx];
    if (o) swipe(o, action);
    const ni = swipeIdx + 1;
    setSwipeIdx(ni);
    if (ni >= deck.length) setTimeout(() => setStep((s) => Math.min(STEPS - 1, s + 1)), 250);
  }

  const canContinue = step === 1 ? aes.size >= 1 : step === 2 ? occ.size >= 1 : true;

  return (
    <div className="mx-auto w-full max-w-[440px] min-h-[100dvh] bg-bg flex flex-col">
      {/* top bar */}
      <div className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))] pb-2">
        <button onClick={() => (step === 0 ? skip() : setStep((s) => s - 1))} className="grid place-items-center w-9 h-9 rounded-full text-ink-soft">
          {step === 0 ? <span className="text-[13px] font-medium text-muted">Skip</span> : <ArrowLeft size={20} />}
        </button>
        <div className="flex gap-1.5">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-ink' : i < step ? 'w-1.5 bg-ink' : 'w-1.5 bg-surface-3'}`} />
          ))}
        </div>
        <button onClick={skip} className="text-[13px] font-medium text-muted w-9 text-right">{step > 0 ? 'Skip' : ''}</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-10 text-center">
              <div className="grid place-items-center w-20 h-20 mx-auto rounded-[28px] bg-ink text-cream mb-6">
                <Sparkles size={32} />
              </div>
              <h1 className="font-display text-4xl text-ink leading-tight">Welcome to<br />Sylistly</h1>
              <p className="text-muted-2 mt-3 max-w-[300px] mx-auto text-balance">
                Build outfit collages, swipe to discover your Style DNA, and get styled by AI. Let’s set up your taste in 60 seconds.
              </p>
              <div className="flex justify-center gap-2 mt-8">
                {publicOutfits().slice(0, 3).map((o) => (
                  <OutfitCollage key={o.id} outfit={o} className="w-24 h-32" rounded="rounded-2xl" />
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="pt-4">
              <h2 className="font-display text-2xl text-ink">Pick your aesthetics</h2>
              <p className="text-sm text-muted mt-1">Choose a few that feel like you.</p>
              <div className="grid grid-cols-2 gap-2.5 mt-5">
                {AESTHETICS.map((a) => {
                  const on = aes.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAes((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}
                      className={`relative flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-colors ${on ? 'border-ink bg-surface-2' : 'border-hairline bg-surface-1'}`}
                    >
                      <span className="w-7 h-7 rounded-full shrink-0" style={{ background: a.swatch }} />
                      <span className="text-[13px] font-semibold text-ink leading-tight">{a.label}</span>
                      {on && <span className="absolute top-2 right-2 grid place-items-center w-4 h-4 rounded-full bg-ink text-cream"><Check size={11} /></span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="pt-4">
              <h2 className="font-display text-2xl text-ink">What do you dress for?</h2>
              <p className="text-sm text-muted mt-1">We’ll tailor recommendations to your life.</p>
              <div className="flex flex-wrap gap-2 mt-5">
                {OCCASIONS_SOCIAL.map((o) => {
                  const on = occ.has(o.key);
                  return (
                    <button
                      key={o.key}
                      onClick={() => setOcc((s) => { const n = new Set(s); n.has(o.key) ? n.delete(o.key) : n.add(o.key); return n; })}
                      className={`px-4 h-11 rounded-full border text-[14px] font-medium transition-colors ${on ? 'bg-ink text-cream border-ink' : 'bg-surface-1 text-ink-soft border-hairline'}`}
                    >
                      {o.emoji} {o.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="pt-4">
              <h2 className="font-display text-2xl text-ink">Swipe to train your DNA</h2>
              <p className="text-sm text-muted mt-1">Love it or pass — {Math.max(0, deck.length - swipeIdx)} to go.</p>
              <div className="relative w-full aspect-[3/4] mt-5">
                {deck[swipeIdx] ? (
                  <OutfitCollage outfit={deck[swipeIdx]} className="w-full h-full shadow-card" rounded="rounded-[28px]" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center rounded-[28px] bg-surface-1 border border-hairline">
                    <Check className="text-emerald" size={40} />
                  </div>
                )}
              </div>
              {deck[swipeIdx] && (
                <div className="flex items-center justify-center gap-6 mt-5">
                  <button onClick={() => doSwipe('dislike')} className="grid place-items-center w-16 h-16 rounded-full bg-surface-1 border border-hairline shadow-card"><X size={26} className="text-accent" strokeWidth={2.4} /></button>
                  <button onClick={() => doSwipe('like')} className="grid place-items-center w-16 h-16 rounded-full bg-ink shadow-card"><Heart size={26} className="text-cream fill-cream" /></button>
                </div>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-6 text-center">
              <div className="grid place-items-center w-16 h-16 mx-auto rounded-3xl bg-ink text-cream mb-4"><Sparkles size={26} /></div>
              <h2 className="font-display text-3xl text-ink">Your Style DNA</h2>
              <p className="text-muted-2 mt-2">Here’s what we learned. You can refine it anytime by swiping.</p>
              <div className="mt-6 rounded-3xl bg-surface-1 border border-hairline p-5 text-left space-y-3">
                <Row label="Top aesthetic" value={insights.topAesthetic ? aestheticLabel(insights.topAesthetic) : ([...aes][0] ? aestheticLabel([...aes][0]) : 'Building…')} />
                <Row label="Favorite color" value={insights.topColor || 'Learning'} />
                <Row label="Formality" value={insights.formality ? cap(insights.formality) : 'Balanced'} />
                <Row label="Dressing for" value={[...occ].slice(0, 3).map((o) => OCCASIONS_SOCIAL.find((x) => x.key === o)?.label).join(', ') || 'Everything'} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* footer */}
      {step !== 3 && (
        <div className="px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <PremiumButton fullWidth size="lg" onClick={next} disabled={!canContinue} iconRight={<ArrowRight size={18} />}>
            {step === STEPS - 1 ? 'Enter Sylistly' : step === 0 ? 'Get started' : 'Continue'}
          </PremiumButton>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

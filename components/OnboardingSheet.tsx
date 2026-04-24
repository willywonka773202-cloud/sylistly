'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ArrowLeft, Check, User, Palette, WandSparkles } from 'lucide-react';
import { useProfile } from '@/store/profile';
import { useRouter } from 'next/navigation';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Sylistly',
    subtitle: 'Build your perfect vibe',
    emoji: '✨',
  },
  {
    id: 'frame',
    title: 'Your Style',
    subtitle: 'Pick your frame',
    emoji: '🧑',
  },
  {
    id: 'skin',
    title: 'Your Look',
    subtitle: 'Match your tone',
    emoji: '🎨',
  },
  {
    id: 'budget',
    title: 'Budget',
    subtitle: 'Set your range',
    emoji: '💰',
  },
  {
    id: 'done',
    title: 'Ready',
    subtitle: 'Let\'s build',
    emoji: '🔥',
  },
];

export function OnboardingSheet({ open, onComplete }: { open: boolean; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedFrame, setSelectedFrame] = useState<'masc' | 'fem' | 'androgynous'>('androgynous');
  const [selectedSkin, setSelectedSkin] = useState('#c9a98a');
  const [selectedBudget, setSelectedBudget] = useState<'mid'>('mid');
  const setBodyType = useProfile((s) => s.setBodyType);
  const setSkinTone = useProfile((s) => s.setSkinTone);
  const setBudget = useProfile((s) => s.setBudget);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      setStep(0);
    }
  }, [open]);

  function handleNext() {
    if (step === STEPS.length - 1) {
      setBodyType(selectedFrame);
      setSkinTone(selectedSkin);
      setBudget(selectedBudget);
      onComplete();
      return;
    }
    setStep(s => s + 1);
  }

  function handleBack() {
    if (step === 0) return;
    setStep(s => s - 1);
  }

  if (!open) return null;

  const currentStep = STEPS[step];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-bg flex items-center justify-center"
      >
        <div className="w-full max-w-[360px] px-6">
          <div className="mb-8">
            <div className="text-4xl mb-2">{currentStep.emoji}</div>
            <div className="font-serif text-2xl font-semibold">{currentStep.title}</div>
            <div className="text-muted">{currentStep.subtitle}</div>
          </div>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted">
                  Your AI-powered style companion. Build looks for any occasion and shop them in one tap.
                </p>
                <div className="flex gap-2 justify-center py-6">
                  {['🌙', '🔥', '💕', '💼', '✈️'].map((e, i) => (
                    <span key={i} className="text-3xl animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>{e}</span>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                {(['androgynous', 'fem', 'masc'] as const).map((frame) => (
                  <button
                    key={frame}
                    onClick={() => setSelectedFrame(frame)}
                    className={`w-full p-4 rounded-xl border flex items-center gap-3 transition ${
                      selectedFrame === frame
                        ? 'bg-accent/10 border-accent'
                        : 'bg-surface-2 border-hairline'
                    }`}
                  >
                    <span className="text-2xl">
                      {frame === 'masc' ? '👨' : frame === 'fem' ? '👩' : '🧑'}
                    </span>
                    <span className="font-medium capitalize">{frame === 'androgynous' ? 'Neutral' : frame}</span>
                    {selectedFrame === frame && <Check className="w-5 h-5 text-accent ml-auto" />}
                  </button>
                ))}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-3 gap-2">
                  {['#f5d0b5', '#ddb192', '#c9a98a', '#a47757', '#7d553e', '#4b3025'].map((skin) => (
                    <button
                      key={skin}
                      onClick={() => setSelectedSkin(skin)}
                      className={`aspect-square rounded-xl border-2 transition ${
                        selectedSkin === skin ? 'border-accent' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: skin }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted text-center">Tap to match your tone</p>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                {(['low', 'mid', 'high', 'luxury'] as const).map((budget) => (
                  <button
                    key={budget}
                    onClick={() => setSelectedBudget(budget as typeof selectedBudget)}
                    className={`w-full p-4 rounded-xl border text-left transition ${
                      selectedBudget === budget
                        ? 'bg-accent/10 border-accent'
                        : 'bg-surface-2 border-hairline'
                    }`}
                  >
                    <span className="font-medium capitalize">{budget}</span>
                    <span className="text-xs text-muted ml-2">
                      {budget === 'low' ? 'Under $100' :budget === 'mid' ? '$100-300' : budget === 'high' ? '$300-500' : '$500+'}
                    </span>
                    {selectedBudget === budget && <Check className="w-5 h-5 text-accent inline ml-auto" />}
                  </button>
                ))}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center py-8"
              >
                <Check className="w-16 h-16 text-emerald mx-auto mb-4" />
                <div className="font-serif text-xl font-semibold">You\'re all set!</div>
                <p className="text-sm text-muted mt-2">Ready to build your first vibe</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className={`p-3 rounded-full ${step === 0 ? 'opacity-0' : ''}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition ${
                    i === step ? 'bg-accent w-4' : 'bg-surface-3'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="p-3 rounded-full bg-accent text-white"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
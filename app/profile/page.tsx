'use client';

import { ArrowRight, Bookmark, Check, Share2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { OutfitLookCard } from '@/components/OutfitBoard';
import { track } from '@/lib/analytics';
import { loadIdentity, type StyleIdentity } from '@/lib/style-identity';
import type { Profile } from '@/lib/types';
import { VIBES } from '@/lib/vibes';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';

const ONBOARDED_KEY = 'sylistly.onboarded.v1';

const SKIN_TONES = ['#f2d6c0', '#e4b894', '#c9a98a', '#a87f5e', '#8a5f3f', '#5d3f29'];

const FRAMES: Array<{ id: Profile['bodyType']; label: string }> = [
  { id: 'masc', label: 'Masc' },
  { id: 'androgynous', label: 'Fluid' },
  { id: 'fem', label: 'Fem' },
];

const BUDGETS: Array<{ id: NonNullable<Profile['stylePrefs']['budget']>; label: string }> = [
  { id: 'low', label: 'Thrifty' },
  { id: 'mid', label: 'Mid' },
  { id: 'high', label: 'High' },
  { id: 'luxury', label: 'Luxe' },
];

/**
 * You — honest profile: the style settings that actually steer generation
 * (frame, skin tone, sizes, vibes, budget) plus your saved looks. No fake
 * followers, no synthetic stats; everything here feeds the scroll and builder.
 */
export default function ProfilePage() {
  const profile = useProfile((state) => state.profile);
  const setSkinTone = useProfile((state) => state.setSkinTone);
  const setBodyType = useProfile((state) => state.setBodyType);
  const setTopSize = useProfile((state) => state.setTopSize);
  const setBottomSize = useProfile((state) => state.setBottomSize);
  const setShoeSize = useProfile((state) => state.setShoeSize);
  const setBudget = useProfile((state) => state.setBudget);
  const setVibesFromText = useProfile((state) => state.setVibesFromText);
  const fits = useSavedFits((state) => state.fits);
  const router = useRouter();

  const [hasMounted, setHasMounted] = useState(false);
  const [identity, setIdentity] = useState<StyleIdentity | null>(null);
  const [shared, setShared] = useState(false);
  useEffect(() => {
    setHasMounted(true);
    setIdentity(loadIdentity()?.identity ?? null);
  }, []);

  function retakeQuiz() {
    window.localStorage.removeItem(ONBOARDED_KEY);
    router.push('/');
  }

  async function shareIdentity() {
    if (!identity) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sylistly.com';
    const url = `${origin}/style/${identity.id}`;
    const text = `I'm a ${identity.name} on Sylistly ✨ what's your style?`;
    track('quiz_shared', { identity: identity.id, surface: 'profile' });
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

  // Stored prefs are free text (legacy setVibesFromText), so match either the
  // vibe id ('street') or its label ('Streetwear').
  const selectedVibes = useMemo(() => {
    const raw = new Set((profile.stylePrefs.vibes || []).map((vibe) => vibe.toLowerCase()));
    return new Set<string>(
      VIBES.filter((vibe) => raw.has(vibe.id) || raw.has(vibe.label.toLowerCase())).map((vibe) => vibe.id),
    );
  }, [profile.stylePrefs.vibes]);

  function toggleVibe(vibeId: string) {
    const next = new Set(selectedVibes);
    if (next.has(vibeId)) next.delete(vibeId);
    else next.add(vibeId);
    setVibesFromText(Array.from(next).join(', '));
  }

  const recentFits = hasMounted ? fits.slice(0, 4) : [];

  return (
    <main className="relative mx-auto min-h-[100dvh] max-w-[480px] bg-bg px-5 pb-[140px] pt-[calc(env(safe-area-inset-top)+22px)]">
      <header>
        <p className="text-eyebrow font-extrabold uppercase text-champagne">Sylistly profile</p>
        <h1 className="mt-2 font-serif text-display font-semibold text-ink">You</h1>
        <p className="mt-2 max-w-[36ch] text-[13px] leading-relaxed text-muted">
          These settings steer every look in your scroll and builder. Stored on this device.
        </p>
      </header>

      {/* Style identity */}
      {hasMounted ? (
        <section className="mt-7 overflow-hidden rounded-card-lg border border-hairline bg-[radial-gradient(130%_90%_at_15%_0%,rgba(255,45,109,.16),transparent_60%)] p-5">
          <p className="inline-flex items-center gap-1.5 text-eyebrow font-extrabold uppercase text-accent">
            <Sparkles size={12} />
            Your style
          </p>
          {identity ? (
            <>
              <h2 className="mt-3 font-serif text-[30px] font-semibold italic leading-[.95] text-ink">
                {identity.name}
              </h2>
              <p className="mt-2 max-w-[40ch] text-[13px] leading-relaxed text-muted-2">{identity.tagline}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={shareIdentity}
                  className="sy-press inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-4 py-2.5 text-[12px] font-bold text-white shadow-pink-glow"
                >
                  {shared ? <Check size={14} /> : <Share2 size={14} />}
                  {shared ? 'Copied' : 'Share'}
                </button>
                <button
                  type="button"
                  onClick={retakeQuiz}
                  className="sy-press inline-flex items-center gap-2 rounded-full border border-hairline-2 bg-surface-2 px-4 py-2.5 text-[12px] font-semibold text-ink"
                >
                  Retake quiz
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 max-w-[38ch] text-[13px] leading-relaxed text-muted-2">
                Take the 5-tap quiz to get your style identity and tune your feed.
              </p>
              <button
                type="button"
                onClick={retakeQuiz}
                className="sy-press mt-4 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-4 py-2.5 text-[12px] font-bold text-white shadow-pink-glow"
              >
                <Sparkles size={14} />
                Find my style
              </button>
            </>
          )}
        </section>
      ) : null}

      {/* Frame */}
      <Section title="Frame">
        <div className="grid grid-cols-3 gap-2">
          {FRAMES.map((frameOption) => {
            const active = profile.bodyType === frameOption.id;
            return (
              <button
                key={frameOption.id}
                type="button"
                onClick={() => setBodyType(frameOption.id)}
                aria-pressed={active}
                className={`sy-press rounded-card border px-3 py-3.5 text-[13px] font-semibold transition ${
                  active
                    ? 'border-accent bg-accent-soft text-ink shadow-pink-glow'
                    : 'border-hairline bg-surface-1 text-muted-2'
                }`}
              >
                {frameOption.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Skin tone */}
      <Section title="Skin tone">
        <div className="flex items-center gap-3">
          {SKIN_TONES.map((tone) => {
            const active = profile.skinTone.toLowerCase() === tone;
            return (
              <button
                key={tone}
                type="button"
                onClick={() => setSkinTone(tone)}
                aria-label={`Skin tone ${tone}`}
                aria-pressed={active}
                className={`sy-press grid h-10 w-10 place-items-center rounded-full transition ${
                  active ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'ring-1 ring-hairline-2'
                }`}
                style={{ backgroundColor: tone }}
              >
                {active ? <Check size={14} className="text-bg" /> : null}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Sizes — 16px inputs so iOS doesn't zoom on focus */}
      <Section title="Sizes">
        <div className="grid grid-cols-3 gap-2">
          <SizeField
            label="Top"
            placeholder="M"
            defaultValue={hasMounted ? profile.sizes.top || '' : ''}
            onCommit={setTopSize}
          />
          <SizeField
            label="Waist"
            placeholder="32"
            inputMode="numeric"
            defaultValue={hasMounted ? `${profile.sizes.bottom?.waist || ''}` : ''}
            onCommit={setBottomSize}
          />
          <SizeField
            label="Shoe"
            placeholder="10.5"
            inputMode="decimal"
            defaultValue={hasMounted ? profile.sizes.shoe || '' : ''}
            onCommit={setShoeSize}
          />
        </div>
      </Section>

      {/* Vibes */}
      <Section title="Your vibes">
        <div className="flex flex-wrap gap-2">
          {VIBES.map((vibe) => {
            const active = selectedVibes.has(vibe.id);
            return (
              <button
                key={vibe.id}
                type="button"
                onClick={() => toggleVibe(vibe.id)}
                aria-pressed={active}
                className={`sy-press rounded-full border px-3.5 py-2 text-[12px] font-semibold transition ${
                  active
                    ? 'border-accent bg-accent text-white shadow-pink-glow'
                    : 'border-hairline bg-surface-1 text-muted-2'
                }`}
              >
                {vibe.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Budget */}
      <Section title="Budget">
        <div className="grid grid-cols-4 gap-2">
          {BUDGETS.map((budgetOption) => {
            const active = profile.stylePrefs.budget === budgetOption.id;
            return (
              <button
                key={budgetOption.id}
                type="button"
                onClick={() => setBudget(budgetOption.id)}
                aria-pressed={active}
                className={`sy-press rounded-card border px-2 py-3 text-[12px] font-semibold transition ${
                  active
                    ? 'border-accent bg-accent-soft text-ink'
                    : 'border-hairline bg-surface-1 text-muted-2'
                }`}
              >
                {budgetOption.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Saved looks */}
      <Section
        title="Saved looks"
        aside={
          <Link
            href="/saved"
            className="sy-press inline-flex items-center gap-1 text-[12px] font-semibold text-accent"
          >
            All {hasMounted && fits.length ? `(${fits.length})` : ''}
            <ArrowRight size={13} />
          </Link>
        }
      >
        {recentFits.length ? (
          <div className="grid grid-cols-2 gap-3">
            {recentFits.map((fit) => (
              <Link
                key={fit.id}
                href="/saved"
                className="sy-press overflow-hidden rounded-card ring-1 ring-hairline"
              >
                <OutfitLookCard items={fit.items} presentation="flatlay" productLinks={false} compact className="h-[150px]" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid place-items-center rounded-card border border-dashed border-hairline-2 bg-surface-1 px-6 py-9 text-center">
            <Bookmark size={18} className="text-muted" />
            <p className="mt-2 text-[13px] font-semibold text-muted-2">Nothing saved yet</p>
            <p className="mt-1 text-[12px] text-muted">Save fits from the scroll and they&apos;ll live here.</p>
          </div>
        )}
      </Section>

      <BottomNav />
    </main>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-eyebrow font-extrabold uppercase text-muted">{title}</h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SizeField({
  label,
  placeholder,
  defaultValue,
  inputMode,
  onCommit,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
  inputMode?: 'numeric' | 'decimal';
  onCommit: (value: string) => void;
}) {
  return (
    <label className="block rounded-card border border-hairline bg-surface-1 px-3 py-2.5">
      <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        defaultValue={defaultValue}
        onBlur={(event) => onCommit(event.target.value.trim())}
        className="mt-1 w-full bg-transparent text-[16px] font-semibold text-ink outline-none placeholder:text-muted/60"
      />
    </label>
  );
}

'use client';

import { ArrowRight, Bookmark, Check, Flame, Gift, Plus, Share2, Sparkles, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AmbientField } from '@/components/AmbientField';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { BottomNav } from '@/components/BottomNav';
import { OutfitLookCard } from '@/components/OutfitBoard';
import { Reveal } from '@/components/Reveal';
import { track } from '@/lib/analytics';
import { isEditorialCutoutProduct } from '@/lib/product-image-quality';
import { safeStorageRemove } from '@/lib/safe-storage';
import { loadIdentity, type StyleIdentity } from '@/lib/style-identity';
import type { Product, Profile } from '@/lib/types';
import { VIBES } from '@/lib/vibes';
import { useProfile } from '@/store/profile';
import { useSavedFits } from '@/store/saved-fits';
import { usePosts, type OutfitPost } from '@/store/posts';
import { PostComposer } from '@/components/PostComposer';
import { PostCanvas } from '@/components/PostCanvas';
import { useDialogBehavior } from '@/lib/use-dialog-behavior';
import {
  bestStreak,
  currentStreak,
  dropClaimedToday,
  vaultStats,
  type VaultStats,
} from '@/lib/drop-vault';
import { getLevel, type LevelState } from '@/lib/stylist-xp';

const ONBOARDED_KEY = 'sylistly.onboarded.v1';

/** Rarity-tier hues — shared with the Drop shop so a vault tile reads the same
 *  tier colour wherever it appears. */
const TIER_META: Array<{ id: keyof VaultStats['byTier']; label: string; hue: string }> = [
  { id: 'heat', label: 'Heat', hue: '#FFC24B' },
  { id: 'showpiece', label: 'Showpiece', hue: '#FF2D6D' },
  { id: 'standout', label: 'Standout', hue: '#5fa8ff' },
  { id: 'everyday', label: 'Everyday', hue: '#b8b1a4' },
];

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
  const posts = usePosts((state) => state.posts);
  const removePost = usePosts((state) => state.removePost);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerPost, setViewerPost] = useState<OutfitPost | null>(null);
  const router = useRouter();

  const [hasMounted, setHasMounted] = useState(false);
  const [identity, setIdentity] = useState<StyleIdentity | null>(null);
  const [shared, setShared] = useState(false);
  // Brief "saved" checkmark per size field. Owned by the parent (which doesn't
  // remount) so it survives SizeField's remount-on-commit (its key changes).
  const [savedSizeField, setSavedSizeField] = useState<'top' | 'bottom' | 'shoe' | null>(null);
  const sizeSaveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (sizeSaveTimer.current) window.clearTimeout(sizeSaveTimer.current); }, []);
  function flashSizeSaved(field: 'top' | 'bottom' | 'shoe') {
    setSavedSizeField(field);
    if (sizeSaveTimer.current) window.clearTimeout(sizeSaveTimer.current);
    sizeSaveTimer.current = window.setTimeout(() => setSavedSizeField(null), 1400);
  }
  const [stats, setStats] = useState<{
    level: LevelState;
    streak: number;
    best: number;
    vault: VaultStats;
    dropReady: boolean;
  } | null>(null);
  useEffect(() => {
    setHasMounted(true);
    setIdentity(loadIdentity()?.identity ?? null);
    setStats({
      level: getLevel(),
      streak: currentStreak(),
      best: bestStreak(),
      vault: vaultStats(),
      dropReady: !dropClaimedToday(),
    });
  }, []);

  function retakeQuiz() {
    safeStorageRemove(ONBOARDED_KEY);
    router.push('/');
  }

  async function shareIdentity() {
    if (!identity) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.sylistly.com';
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

  // Only show fits the card can actually render (≥3 editorial-cutout pieces) —
  // OutfitLookCard returns null below that, which would leave blank, clickable
  // boxes in the grid.
  const recentFits = hasMounted
    ? fits
        .filter(
          (fit) =>
            Object.values(fit.items).filter(
              (product): product is Product => Boolean(product) && isEditorialCutoutProduct(product),
            ).length >= 3,
        )
        .slice(0, 4)
    : [];

  return (
    <main className="relative mx-auto min-h-[100dvh] max-w-[480px] overflow-hidden bg-bg px-5 pb-[140px] pt-[calc(env(safe-area-inset-top)+22px)]">
      <AmbientField className="opacity-70" />
      <div className="relative z-10 sy-stagger">
      <header>
        <p className="text-eyebrow font-extrabold uppercase sy-sheen">Sylistly profile</p>
        <h1 className="mt-2 font-serif text-display font-semibold text-ink">You</h1>
        <p className="mt-2 max-w-[36ch] text-[13px] leading-relaxed text-muted">
          These settings steer every look in your scroll and builder. Stored on this device.
        </p>
      </header>

      {/* Your collection — surfaces the real engagement systems (level/XP from
          actions, the Drop streak, vault pulls). All honest counts, device-local. */}
      {stats ? (
        <Reveal>
          <section className="mt-7 overflow-hidden rounded-card-lg border border-hairline bg-[linear-gradient(160deg,rgba(255,45,109,.10),transparent_46%),linear-gradient(0deg,rgba(231,199,155,.06),rgba(231,199,155,.06))] p-5">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-1.5 text-eyebrow font-extrabold uppercase text-champagne">
                <Sparkles size={12} />
                Your collection
              </p>
              {stats.dropReady ? (
                <Link
                  href="/drop"
                  className="sy-press inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-[11px] font-bold text-accent"
                >
                  <Gift size={12} />
                  Drop ready
                </Link>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <StatTile prefix="Lv " count={stats.level.level} label={stats.level.title} />
              <StatTile
                count={stats.streak}
                label="day streak"
                icon={<Flame size={13} className="text-accent" />}
                hint={stats.best > stats.streak ? `best ${stats.best}` : undefined}
              />
              <StatTile count={stats.vault.total} label={stats.vault.total === 1 ? 'pull' : 'pulls'} />
            </div>

            {/* XP progress to next level */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-muted-2">
                  {stats.level.maxed ? 'Max level reached' : `${stats.level.intoLevel}/${stats.level.span} XP`}
                </span>
                <span className="text-muted">
                  {stats.level.nextTitle ? `Next: ${stats.level.nextTitle}` : '★ Icon'}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="sy-bar-fill relative h-full overflow-hidden rounded-full bg-[linear-gradient(90deg,#FF2D6D,#E7C79B)] transition-[width] duration-700 ease-out"
                  style={{ width: `${stats.level.pct}%` }}
                >
                  <span aria-hidden className="sy-xp-sheen pointer-events-none absolute inset-0 rounded-full" />
                </div>
              </div>
            </div>

            {/* Vault rarity breakdown / empty nudge */}
            {stats.vault.total ? (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
                {TIER_META.filter((tier) => stats.vault.byTier[tier.id]).map((tier, i) => (
                  <span key={tier.id} className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                    <span
                      className="sy-gem h-2 w-2 rounded-full"
                      style={{ ['--gem']: tier.hue, background: tier.hue, animationDelay: `${i * 350}ms` } as React.CSSProperties}
                    />
                    <span className="text-muted-2">
                      {stats.vault.byTier[tier.id]} {tier.label}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <Link
                href="/drop"
                className="sy-press mt-4 flex items-center justify-between rounded-card border border-dashed border-hairline-2 bg-surface-1/60 px-4 py-3 text-[12px]"
              >
                <span className="text-muted-2">Open Daily Drops to start your collection</span>
                <ArrowRight size={14} className="text-accent" />
              </Link>
            )}
          </section>
        </Reveal>
      ) : null}

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

      {/* Your posts — the Studio: compose an outfit post (arrange + caption) and
          it lands in your Instagram-style grid. HONEST v0: local to this device;
          real cross-user accounts + like/comment/share is the next phase. */}
      {hasMounted ? (
        <Section
          title="Your posts"
          aside={
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="sy-press inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5 text-[12px] font-bold text-accent"
            >
              <Plus size={13} /> Create
            </button>
          }
        >
          {posts.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {posts.map((post, i) => (
                <Reveal key={post.id} delay={(i % 3) * 70}>
                  <button
                    type="button"
                    onClick={() => setViewerPost(post)}
                    aria-label={post.caption ? `Post: ${post.caption}` : 'Outfit post'}
                    className="sy-press block w-full overflow-hidden rounded-card ring-1 ring-hairline"
                  >
                    <PostCanvas post={post} />
                  </button>
                </Reveal>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="sy-press grid w-full place-items-center rounded-card border border-dashed border-hairline-2 bg-surface-1 px-6 py-9 text-center"
            >
              <Sparkles size={18} className="text-accent" />
              <p className="mt-2 text-[13px] font-semibold text-ink">Make your first post</p>
              <p className="mt-1 max-w-[30ch] text-[12px] text-muted">
                Arrange a saved fit on a canvas, caption it, and post it to your grid.
              </p>
            </button>
          )}
        </Section>
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
          {/* key includes hasMounted + the stored value so the uncontrolled
              input remounts to show the saved size once the store hydrates
              (uncontrolled inputs ignore defaultValue changes after mount). */}
          <SizeField
            key={`top-${hasMounted}-${profile.sizes.top || ''}`}
            label="Top"
            placeholder="M"
            defaultValue={hasMounted ? profile.sizes.top || '' : ''}
            onCommit={(value) => { const changed = !!value && value !== (profile.sizes.top || ''); setTopSize(value); if (changed) flashSizeSaved('top'); }}
            justSaved={savedSizeField === 'top'}
          />
          <SizeField
            key={`waist-${hasMounted}-${profile.sizes.bottom?.waist || ''}`}
            label="Waist"
            placeholder="32"
            inputMode="numeric"
            defaultValue={hasMounted ? `${profile.sizes.bottom?.waist || ''}` : ''}
            onCommit={(value) => { const changed = !!value && value !== `${profile.sizes.bottom?.waist || ''}`; setBottomSize(value); if (changed) flashSizeSaved('bottom'); }}
            justSaved={savedSizeField === 'bottom'}
          />
          <SizeField
            key={`shoe-${hasMounted}-${profile.sizes.shoe || ''}`}
            label="Shoe"
            placeholder="10.5"
            inputMode="decimal"
            defaultValue={hasMounted ? profile.sizes.shoe || '' : ''}
            onCommit={(value) => { const changed = !!value && value !== (profile.sizes.shoe || ''); setShoeSize(value); if (changed) flashSizeSaved('shoe'); }}
            justSaved={savedSizeField === 'shoe'}
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
            {recentFits.map((fit, i) => (
              <Reveal key={fit.id} delay={(i % 2) * 80}>
              <Link
                href="/saved"
                className="sy-press block overflow-hidden rounded-card ring-1 ring-hairline"
              >
                <OutfitLookCard items={fit.items} presentation="flatlay" productLinks={false} compact className="h-[150px]" />
              </Link>
              </Reveal>
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

      <footer className="mt-8 flex items-center justify-center gap-3 text-[11px] font-semibold text-muted">
        <Link href="/privacy" className="transition hover:text-ink">Privacy</Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="transition hover:text-ink">Terms</Link>
      </footer>
      </div>

      <PostComposer open={composerOpen} fits={fits} onClose={() => setComposerOpen(false)} />
      {viewerPost ? (
        <PostViewer
          post={viewerPost}
          onClose={() => setViewerPost(null)}
          onDelete={() => {
            removePost(viewerPost.id);
            setViewerPost(null);
          }}
        />
      ) : null}

      <BottomNav />
    </main>
  );
}

function PostViewer({
  post,
  onClose,
  onDelete,
}: {
  post: OutfitPost;
  onClose: () => void;
  onDelete: () => void;
}) {
  const ref = useDialogBehavior<HTMLDivElement>(onClose, true);
  const date = new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Outfit post"
      className="fixed inset-0 z-[120] flex flex-col bg-[rgba(8,7,9,.9)] backdrop-blur-xl sy-fade-in"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sy-press grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-surface-2 text-muted-2"
        >
          <X size={17} />
        </button>
        <p className="text-eyebrow font-extrabold uppercase text-muted">{date}</p>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete post"
          className="sy-press grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-surface-2 text-muted-2"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-10">
        <PostCanvas post={post} className="mx-auto w-full max-w-[360px] rounded-[24px] border border-hairline" />
        {post.caption ? (
          <p className="mx-auto mt-4 max-w-[360px] text-[15px] leading-snug text-ink">{post.caption}</p>
        ) : null}
        <p className="mx-auto mt-3 max-w-[360px] text-[12px] text-muted">
          Saved to this device. Posting to friends with their own accounts is on the way.
        </p>
      </div>
    </div>
  );
}

function StatTile({
  value,
  count,
  prefix,
  label,
  icon,
  hint,
}: {
  /** Static display value (used when `count` is not provided). */
  value?: string;
  /** When set, the number counts up from 0 on mount (honest — real stat). */
  count?: number;
  /** Static text rendered before the count-up (e.g. "Lv "). */
  prefix?: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-hairline bg-surface-1/70 px-3 py-3 text-center">
      <p className="inline-flex items-center justify-center gap-1 font-serif text-[26px] font-semibold leading-none text-ink">
        {icon}
        {count != null ? (
          <span>
            {prefix}
            <AnimatedNumber value={count} durationMs={900} />
          </span>
        ) : (
          value
        )}
      </p>
      <p className="mt-1.5 text-[11px] font-semibold text-muted-2">{label}</p>
      {hint ? <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{hint}</p> : null}
    </div>
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
  justSaved,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
  inputMode?: 'numeric' | 'decimal';
  onCommit: (value: string) => void;
  justSaved?: boolean;
}) {
  // `justSaved` is parent-owned (survives this field's remount-on-commit) and
  // briefly flashes a checkmark — sizes drive the fit recs, so a silent onBlur
  // left users unsure it stuck.
  return (
    <label className="relative block rounded-card border border-hairline bg-surface-1 px-3 py-2.5">
      <span className="block text-[10px] font-bold uppercase tracking-[.14em] text-muted">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        defaultValue={defaultValue}
        onBlur={(event) => onCommit(event.target.value.trim())}
        className="mt-1 w-full bg-transparent text-[16px] font-semibold text-ink outline-none placeholder:text-muted/60"
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute right-2.5 top-2.5 text-money transition-opacity duration-300 ${justSaved ? 'opacity-100' : 'opacity-0'}`}
      >
        <Check size={13} />
      </span>
      <span className="sr-only" aria-live="polite">{justSaved ? `${label} size saved` : ''}</span>
    </label>
  );
}

'use client';

import { Archive, Bookmark, Check, ChevronLeft, Flame, Gift, Heart, Snowflake, Trophy, Volume2, VolumeX } from 'lucide-react';
import { useAppViewportLock } from '@/lib/use-app-viewport-lock';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AmbientField } from '@/components/AmbientField';
import { BottomNav } from '@/components/BottomNav';
import { DailyDrop, type DropLook } from '@/components/DailyDrop';
import { ProductImage } from '@/components/ProductImage';
import { track } from '@/lib/analytics';
import { computeBundleDeal } from '@/lib/bundle-deals';
import { getVerifiedDropLooks, resolveVerifiedDropProducts } from '@/lib/drop-look-library';
import {
  bestStreak,
  currentStreak,
  dropClaimedToday,
  getVault,
  MILESTONES,
  nextMilestone,
  streakFreezes,
  vaultStats,
  type VaultEntry,
} from '@/lib/drop-vault';
import { feedback, isMuted, setMuted } from '@/lib/feedback';
import { lookRarity } from '@/lib/look-rarity';
import { bumpDaily, getLevel, questStatus } from '@/lib/stylist-xp';
import { getProductOutboundUrl } from '@/lib/product-links';
import { isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { VIBES, type VibeId } from '@/lib/vibes';
import { useCheckout } from '@/store/checkout';

const DAY_MS = 86_400_000;

function fmt(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

const TIER_HUE: Record<string, string> = {
  everyday: '#b8b1a4',
  standout: '#5fa8ff',
  showpiece: '#FF2D6D',
  heat: '#FFC24B',
};
const TIER_LABEL: Record<string, string> = {
  everyday: 'Everyday',
  standout: 'Standout',
  showpiece: 'Statement',
  heat: 'Signature',
};
const HERO_ORDER = ['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

function vaultHero(entry: VaultEntry): Product | null {
  const products = resolveVerifiedDropProducts(entry.productIds)
    .filter((p) => isEditorialCutoutProduct(p));
  for (const cat of HERO_ORDER) {
    const found = products.find((p) => p.category === cat);
    if (found) return found;
  }
  return products[0] ?? null;
}

interface Crate {
  id: string;
  label: string;
  daily: boolean;
  looks: DropLook[];
  winnerKey?: string;
}

/** A date-seeded pool of complete catalog-verified looks (mixed when vibeId is
 *  null, or a single vibe for a themed crate). Stable all day, rotates daily. */
function buildPool(day: number, vibeId: VibeId | null, salt: number): { looks: DropLook[]; winnerKey?: string } {
  const out = getVerifiedDropLooks(vibeId, day * 131 + salt * 7, 10);
  return { looks: out, winnerKey: out.length ? out[day % out.length].key : undefined };
}

/**
 * The Drop — a browsable CRATE SHOP. Today's free daily crate is featured up
 * top (streak + once-a-day), and below it a grid of themed bundle crates you can
 * open + shop anytime. Each crate reveals a curated, shoppable bundle with
 * honest "& save" pricing. See components/DailyDrop.tsx + [[sylistly-bundle-deals]].
 */
export default function DropPage() {
  // Full-screen route: pin it to the visible viewport so iOS Safari's toolbar
  // can't resize the shell mid-gesture.
  useAppViewportLock();
  const router = useRouter();
  const setCheckout = useCheckout((state) => state.setCheckout);
  const [muted, setMutedState] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusIdRef = useRef<string | null>(null);

  function showCrate(id: string) {
    returnFocusIdRef.current = id;
    setOpenId(id);
  }

  function closeCrate() {
    const triggerId = returnFocusIdRef.current;
    setOpenId(null);
    window.requestAnimationFrame(() => {
      if (!triggerId) return;
      document
        .querySelector<HTMLElement>(`[data-crate-trigger="${triggerId}"]`)
        ?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    if (!openId) return;
    const frame = window.requestAnimationFrame(() => backButtonRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [openId]);

  useEffect(() => {
    setMutedState(isMuted());
    setMounted(true);
    track('daily_drop_viewed', { surface: 'daily-drop' });
  }, []);

  const crates = useMemo<Crate[]>(() => {
    const day = Math.floor(Date.now() / DAY_MS);
    const list: Crate[] = [];
    const dailyPool = buildPool(day, null, 0);
    list.push({ id: 'daily', label: "Today's Drop", daily: true, ...dailyPool });
    VIBES.forEach((vibe, idx) => {
      const p = buildPool(day, vibe.id, idx + 1);
      if (p.looks.length) list.push({ id: vibe.id, label: vibe.label, daily: false, ...p });
    });
    // Streak-reward crate: today's highest-rarity fit (the "best of" payoff you
    // unlock by keeping a streak). Always built; only SHOWN once you reach day 3.
    if (dailyPool.looks.length) {
      const best = [...dailyPool.looks]
        .map((l) => ({ l, lvl: lookRarity(l.items, l.source).level }))
        .sort((a, b) => b.lvl - a.lvl)[0]?.l;
      list.push({ id: 'reward', label: 'Streak Reward', daily: false, looks: dailyPool.looks, winnerKey: best?.key ?? dailyPool.winnerKey });
    }
    return list;
  }, []);

  function previewOf(crate: Crate) {
    const winner = crate.looks.find((l) => l.key === crate.winnerKey) ?? crate.looks[0];
    if (!winner) return { fromCents: 0, pct: 0, pieces: 0, hero: null as Product | null };
    const products = Object.values(winner.items).filter(
      (p): p is Product => Boolean(p) && (p.priceCents || 0) > 0,
    );
    const deal = computeBundleDeal(products);
    const cutouts = Object.values(winner.items).filter(
      (p): p is Product => Boolean(p) && isEditorialCutoutProduct(p),
    );
    // Representative hero cutout for the card — the most recognisable garment.
    const HERO_ORDER: Category[] = ['top', 'outer', 'bottom', 'shoes', 'bag'];
    let hero: Product | null = null;
    for (const cat of HERO_ORDER) {
      const candidate = winner.items[cat];
      if (candidate && isEditorialCutoutProduct(candidate)) {
        hero = candidate;
        break;
      }
    }
    if (!hero) hero = cutouts[0] ?? null;
    return { fromCents: deal.retailCents, pct: deal.pct, pieces: cutouts.length, hero };
  }

  function shopLook(look: DropLook) {
    const products = (Object.values(look.items) as (Product | undefined)[])
      .filter((product): product is Product => Boolean(product))
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));
    track('daily_drop_shopped', {
      lookId: look.key,
      productIds: products.map((product) => product.id),
      pieces: products.length,
      totalCents: products.reduce((sum, product) => sum + (product.priceCents || 0), 0),
      source: look.source,
      surface: 'daily-drop',
      crate_id: openId || 'unknown',
    });
    bumpDaily('bundlesShopped');
    setCheckout({ title: `${look.label} bundle`, lookId: look.key, products });
    router.push('/checkout');
  }

  function reshopVault(entry: VaultEntry) {
    const products = resolveVerifiedDropProducts(entry.productIds)
      .map((product) => ({
        id: product.id,
        brand: product.brand,
        name: product.name,
        retailer: product.retailer,
        url: getProductOutboundUrl(product),
        priceCents: product.priceCents,
      }))
      .filter((product) => Boolean(product.url));
    if (!products.length) return;
    track('daily_drop_shopped', {
      lookId: entry.key,
      productIds: products.map((product) => product.id),
      pieces: products.length,
      totalCents: products.reduce((sum, product) => sum + (product.priceCents || 0), 0),
      source: 'vault',
      surface: 'daily-drop-vault',
    });
    bumpDaily('bundlesShopped');
    setCheckout({ title: `${entry.label} bundle`, lookId: entry.key, products });
    router.push('/checkout');
  }

  const openCrate = openId ? crates.find((c) => c.id === openId) : null;
  const dailyCrate = crates.find((c) => c.daily);
  const rewardCrate = crates.find((c) => c.id === 'reward');

  return (
    <main className="sy-game-screen relative flex h-[100svh] w-full flex-col overflow-hidden bg-bg text-ink">
      <AmbientField />
      <div aria-hidden className="sy-grain pointer-events-none absolute inset-0 opacity-[.05] mix-blend-overlay" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] lg:px-8 lg:pt-7">
        <div className="flex items-center gap-2">
          {openCrate ? (
            <button
              ref={backButtonRef}
              type="button"
              onClick={closeCrate}
              aria-label="Back to all drops"
              className="sy-press -ml-1 grid h-11 w-11 place-items-center rounded-full border border-hairline-2 bg-surface-2/80 text-ink backdrop-blur-md"
            >
              <ChevronLeft size={17} />
            </button>
          ) : null}
          <div className="flex flex-col">
            <span className="text-eyebrow font-extrabold uppercase tracking-[.3em] text-champagne">
              {openCrate && !openCrate.daily ? 'Style edit' : 'Daily edit'}
            </span>
            <h1 className="font-serif text-[26px] font-semibold italic leading-none text-ink">
              {openCrate && !openCrate.daily ? (
                <>
                  {openCrate.label} <span className="text-accent">drop</span>
                </>
              ) : (
                <>
                  The <span className="text-accent">Drop</span>
                </>
              )}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setMutedState(next);
            if (!next) feedback.tick();
          }}
          aria-pressed={!muted}
          aria-label="Sound and haptics"
          className={`sy-press grid h-11 w-11 place-items-center rounded-full border backdrop-blur-md ${
            muted ? 'border-hairline-2 bg-surface-2/80 text-muted' : 'border-accent/50 bg-accent-soft text-accent'
          }`}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </header>

      {/* Open crate → the reveal experience. Otherwise → the shop grid. */}
      {openCrate ? (
        <div className="relative z-10 mx-auto flex w-full flex-1 flex-col overflow-hidden pb-[calc(env(safe-area-inset-bottom)+96px)] lg:max-w-[1000px] lg:pb-8">
          <DailyDrop
            key={openCrate.id}
            looks={openCrate.looks}
            winnerKey={openCrate.winnerKey}
            daily={openCrate.daily}
            onWear={shopLook}
          />
        </div>
      ) : (
        <div className="sy-stagger relative z-10 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+108px)] pt-5 scrollbar-hide lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)] lg:items-start lg:gap-x-6 lg:px-8 lg:pb-10 lg:pt-7">
          {mounted && dailyCrate ? (
            <div className="lg:col-start-1 lg:row-start-1">
              <FeaturedCrate
                crate={dailyCrate}
                preview={previewOf(dailyCrate)}
                claimed={dropClaimedToday()}
                onOpen={() => {
                  feedback.tick();
                  track('daily_drop_opened', {
                    lookId: dailyCrate.winnerKey,
                    crateId: dailyCrate.id,
                    reward: false,
                    surface: 'daily-drop',
                  });
                  showCrate(dailyCrate.id);
                }}
              />
            </div>
          ) : null}

          {mounted ? (
            <aside aria-labelledby="drop-activity-heading" className="lg:sticky lg:top-0 lg:col-start-2 lg:row-span-3 lg:row-start-1">
              <h2 id="drop-activity-heading" className="sr-only lg:not-sr-only lg:mb-3 lg:block lg:text-eyebrow lg:font-extrabold lg:uppercase lg:tracking-[.24em] lg:text-champagne">
                Your activity
              </h2>
              <StreakRail />
              <LevelRail />
              <DailyQuests />

              {rewardCrate && currentStreak() >= MILESTONES[0].day ? (
                <RewardCrateCard
                  crate={rewardCrate}
                  onOpen={() => {
                    feedback.tick();
                    track('reward_opened', {
                      lookId: rewardCrate.winnerKey,
                      crateId: 'reward',
                      streak: currentStreak(),
                      surface: 'daily-drop',
                    });
                    showCrate('reward');
                  }}
                />
              ) : null}
            </aside>
          ) : null}

          {mounted && crates.length > 1 ? (
            <section className="lg:col-start-1 lg:row-start-2">
              <h2 className="mb-3 mt-7 text-eyebrow font-extrabold uppercase tracking-[.28em] text-muted">
                Shop by style
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {crates
                  .filter((c) => !c.daily && c.id !== 'reward')
                  .map((crate, i) => {
                    const preview = previewOf(crate);
                    return (
                      <ThemedCrate
                        key={crate.id}
                        crate={crate}
                        preview={preview}
                        delay={(i % 2) * 70}
                        onOpen={() => {
                          feedback.tick();
                          track('daily_drop_opened', {
                            lookId: crate.winnerKey,
                            crateId: crate.id,
                            reward: false,
                            surface: 'daily-drop',
                          });
                          showCrate(crate.id);
                        }}
                      />
                    );
                  })}
              </div>
            </section>
          ) : null}

          {mounted ? (
            <div className="lg:col-start-1 lg:row-start-3">
              <VaultStrip onReshop={reshopVault} />
            </div>
          ) : null}
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function FeaturedCrate({
  crate,
  preview,
  claimed,
  onOpen,
}: {
  crate: Crate;
  preview: { fromCents: number; pct: number; pieces: number };
  claimed: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      data-crate-trigger={crate.id}
      type="button"
      onClick={onOpen}
      className="sy-press relative block w-full overflow-hidden rounded-[28px] border border-accent/30 bg-[linear-gradient(150deg,#1b1b20,#141417)] p-6 text-left shadow-[0_24px_60px_-26px_rgba(255,45,109,.6)]"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
        <span className="sy-shimmer-sweep absolute -inset-y-6 -left-1/3 w-1/3 rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent)]" />
      </span>
      <div className="relative flex items-center gap-4">
        <span
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-[20px] text-white ${claimed ? '' : 'sy-glow-breathe'}`}
          style={{ background: 'radial-gradient(circle at 50% 32%, #FF5C8A, #FF2D6D 72%)', boxShadow: '0 12px 30px -8px #FF2D6D' }}
        >
          <Gift size={30} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-extrabold uppercase tracking-[.24em] text-champagne">Today&rsquo;s complete look</p>
          <p className="mt-0.5 font-serif text-[20px] font-semibold italic leading-tight text-ink">
            {claimed ? 'View your look' : 'Reveal today’s edit'}
          </p>
          <p className="mt-1 text-[12px] text-muted">
            {preview.pieces} pieces{preview.pct > 0 ? ` · save up to ${preview.pct}%` : ''} · new each day
          </p>
        </div>
        <ChevronLeft size={18} className="shrink-0 rotate-180 text-muted" />
      </div>
    </button>
  );
}

function ThemedCrate({
  crate,
  preview,
  delay,
  onOpen,
}: {
  crate: Crate;
  preview: { fromCents: number; pct: number; pieces: number; hero: Product | null };
  delay: number;
  onOpen: () => void;
}) {
  return (
    <button
      data-crate-trigger={crate.id}
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${delay}ms` }}
      className="sy-press sy-fade-up relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[22px] border border-hairline-2 bg-[radial-gradient(circle_at_50%_30%,#26262c,#151518)] p-4 text-center"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
        <span className="sy-shimmer-sweep absolute -inset-y-6 -left-1/3 w-1/3 rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent)]" />
      </span>
      <div className="relative flex flex-col items-center gap-2.5">
        {/* Per-crate hero: a representative cutout on a warm mini-plate so each
            crate reads at a glance; falls back to the gift mark if none. */}
        <span
          className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-[18px]"
          style={{ background: 'radial-gradient(circle at 50% 34%,#F4F0E8,#DCD1BF)', boxShadow: '0 10px 24px -10px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)' }}
        >
          {preview.hero ? (
            <ProductImage
              product={preview.hero}
              transparentOnly
              wrapperClassName="h-[80%] w-[80%]"
              className="h-full w-full object-contain drop-shadow-[0_6px_8px_rgba(40,30,20,.32)]"
            />
          ) : (
            <Gift size={24} strokeWidth={1.8} className="text-ink/70" />
          )}
        </span>
        <div>
          <p className="font-serif text-[16px] font-semibold italic leading-tight text-ink">{crate.label}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            from {fmt(preview.fromCents)}
            {preview.pct > 0 ? <span className="text-emerald-300"> · save {preview.pct}%</span> : ''}
          </p>
        </div>
      </div>
    </button>
  );
}

/** Streak status + milestone progress track + freeze. Honest real counts. */
function StreakRail() {
  const streak = currentStreak();
  const best = bestStreak();
  const freezes = streakFreezes();
  const next = nextMilestone(streak);
  const maxDay = MILESTONES[MILESTONES.length - 1].day;
  const fillPct = Math.min(100, (streak / maxDay) * 100);
  return (
    <section aria-labelledby="streak-heading" className="mt-5 rounded-[22px] border border-hairline-2 bg-surface-1/70 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <h3 id="streak-heading" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-ink">
          <Flame size={15} className="text-accent" /> <span className="text-accent">{streak}-day</span> streak
          {best > streak ? <span className="font-semibold text-muted"> · best {best}</span> : null}
        </h3>
        {freezes > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-hairline-2 bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
            <Snowflake size={10} /> {freezes} freeze
          </span>
        ) : null}
      </div>
      <div role="progressbar" aria-label={`Streak progress toward day ${maxDay}`} aria-valuemin={0} aria-valuemax={maxDay} aria-valuenow={Math.min(streak, maxDay)} className="relative mt-4 h-1.5 rounded-full bg-hairline-2">
        <div className="sy-bar-fill absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-500" style={{ width: `${fillPct}%` }} />
        {MILESTONES.map((m) => {
          const reached = streak >= m.day;
          return (
            <span
              key={m.day}
              className={`absolute -top-1 grid h-3.5 w-3.5 -translate-x-1/2 place-items-center rounded-full border text-[7px] font-black ${
                reached ? 'border-accent bg-accent text-bg' : 'border-hairline-2 bg-bg text-muted'
              }`}
              style={{ left: `${(m.day / maxDay) * 100}%` }}
            >
              {reached ? '✓' : ''}
            </span>
          );
        })}
      </div>
      <p className="mt-3.5 text-[11px] text-muted">
        {next ? (
          <>
            Day {next.day}: <span className="font-semibold text-ink">{next.title}</span> — {next.reward}
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5"><Trophy size={12} className="text-champagne" /> All milestones reached — legend.</span>
        )}
      </p>
    </section>
  );
}

/** Stylist rank + XP progress to the next level. XP from real actions only. */
function LevelRail() {
  const lvl = getLevel();
  return (
    <section aria-labelledby="style-level-heading" className="mt-3 rounded-[22px] border border-hairline-2 bg-surface-1/70 p-4 backdrop-blur-md">
      <div className="flex items-baseline justify-between">
        <h3 id="style-level-heading" className="text-[14px] font-bold text-ink">
          <span className="text-champagne">Style level {lvl.level}</span> · {lvl.title}
        </h3>
        <p className="text-[11px] text-muted">
          {lvl.maxed ? `${lvl.xp} points · top level` : `${lvl.intoLevel}/${lvl.span} activity points`}
        </p>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-hairline-2">
        <div
          role="progressbar"
          aria-label="Style level progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(lvl.pct)}
          className="sy-bar-fill absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#FF2D6D,#E7C79B)] transition-all duration-500"
          style={{ width: `${lvl.pct}%` }}
        />
      </div>
      <p className="mt-2.5 text-[11px] text-muted">
        {lvl.maxed ? <span className="inline-flex items-center gap-1.5"><Trophy size={12} className="text-champagne" /> Top style level reached.</span> : <>Next: <span className="font-semibold text-ink">{lvl.nextTitle}</span> — make picks, save looks, and view drops</>}
      </p>
    </section>
  );
}

/** Daily quests — tiny real-count tasks that refresh at midnight. */
function DailyQuests() {
  const quests = questStatus();
  const doneCount = quests.filter((q) => q.done).length;
  return (
    <section aria-labelledby="daily-goals-heading" className="mt-3 rounded-[22px] border border-hairline-2 bg-surface-1/70 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 id="daily-goals-heading" className="text-eyebrow font-extrabold uppercase tracking-[.24em] text-muted">Daily styling goals</h3>
        <p className="text-[11px] text-muted">
          {doneCount}/{quests.length} · resets at midnight
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {quests.map((quest) => (
          <div
            key={quest.id}
            className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${
              quest.done ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-hairline bg-surface-2/60'
            }`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bg/60 text-accent">
              {quest.id === 'open-drop' ? <Gift size={14} /> : quest.id === 'save-fit' ? <Bookmark size={14} /> : <Heart size={14} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-semibold ${quest.done ? 'text-ink line-through opacity-70' : 'text-ink'}`}>
                {quest.label}
              </p>
              {quest.target > 1 && !quest.done ? (
                <div className="mt-1 flex items-center gap-2">
                  <div role="progressbar" aria-label={quest.label} aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={quest.progress} className="h-1 flex-1 overflow-hidden rounded-full bg-hairline-2">
                    <div
                      className="sy-bar-fill h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${Math.min(100, (quest.progress / quest.target) * 100)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted">
                    {quest.progress}/{quest.target}
                  </span>
                </div>
              ) : null}
            </div>
            {quest.done ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-emerald-300"><Check size={12} /> +{quest.xp}</span>
            ) : (
              <span className="shrink-0 rounded-full border border-hairline-2 px-2 py-0.5 text-[11px] font-semibold text-champagne">
                +{quest.xp} pts
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** The golden bonus crate unlocked by a streak milestone. */
function RewardCrateCard({ crate, onOpen }: { crate: Crate; onOpen: () => void }) {
  return (
    <button
      data-crate-trigger={crate.id}
      type="button"
      onClick={onOpen}
      aria-label={`Open your streak reward — ${crate.label}`}
      className="sy-press relative mt-3 block w-full overflow-hidden rounded-[24px] border p-5 text-left"
      style={{ borderColor: '#FFC24B66', background: 'linear-gradient(150deg,#241f14,#15130d)', boxShadow: '0 20px 50px -24px rgba(255,194,75,.6)' }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
        <span className="sy-shimmer-sweep absolute -inset-y-6 -left-1/3 w-1/3 rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,194,75,.2),transparent)]" />
      </span>
      <div className="relative flex items-center gap-3.5">
        <span
          className="sy-glow-breathe grid h-14 w-14 place-items-center rounded-[18px] text-[#15130d]"
          style={{ background: 'radial-gradient(circle at 50% 32%, #FFD98A, #FFC24B 72%)' }}
        >
          <Gift size={26} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow font-extrabold uppercase tracking-[.24em]" style={{ color: '#FFC24B' }}>
            Loyalty edit · unlocked
          </p>
          <p className="mt-0.5 font-serif text-[18px] font-semibold italic leading-tight text-ink">View your reward look</p>
          <p className="mt-0.5 text-[11px] text-muted">A standout edit earned by your return streak</p>
        </div>
        <ChevronLeft size={18} className="shrink-0 rotate-180" style={{ color: '#FFC24B' }} />
      </div>
    </button>
  );
}

/** The collectible Vault — every fit you've pulled, rarity-tagged, re-shoppable. */
function VaultStrip({ onReshop }: { onReshop: (entry: VaultEntry) => void }) {
  const vault = getVault();
  const stats = vaultStats();
  return (
    <section aria-labelledby="saved-drops-heading" className="mt-7">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="saved-drops-heading" className="text-eyebrow font-extrabold uppercase tracking-[.28em] text-muted">Saved drops</h2>
        {stats.total > 0 ? (
          <p className="text-[11px] text-muted">
            {stats.total} look{stats.total === 1 ? '' : 's'}
            {stats.byTier.heat ? ` · ${stats.byTier.heat} signature` : ''}
            {stats.byTier.showpiece ? ` · ${stats.byTier.showpiece} statement` : ''}
          </p>
        ) : null}
      </div>
      {vault.length === 0 ? (
        <div className="grid place-items-center rounded-[20px] border border-dashed border-hairline-2 bg-surface-1/50 px-6 py-8 text-center">
          <Archive size={24} className="text-champagne" />
          <p className="mt-2 text-[13px] font-semibold text-muted-2">Your collection starts here</p>
          <p className="mt-1 text-[12px] text-muted">Reveal a daily edit and the complete look will stay here.</p>
        </div>
      ) : (
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-hide">
          {vault.map((entry) => (
            <VaultTile key={entry.key} entry={entry} onReshop={onReshop} />
          ))}
        </div>
      )}
    </section>
  );
}

function VaultTile({ entry, onReshop }: { entry: VaultEntry; onReshop: (entry: VaultEntry) => void }) {
  const hero = vaultHero(entry);
  const hue = TIER_HUE[entry.tier] || '#b8b1a4';
  return (
    <button
      type="button"
      onClick={() => {
        feedback.tick();
        onReshop(entry);
      }}
      aria-label={`Re-shop ${entry.label}`}
      className="sy-press relative w-[104px] shrink-0 overflow-hidden rounded-[16px]"
      style={{ boxShadow: `inset 0 -3px 0 ${hue}, 0 0 0 1px ${hue}44` }}
    >
      <div className="aspect-[3/4] w-full bg-[radial-gradient(circle_at_50%_34%,#867f78_0%,#56514c_52%,#2c2a28_100%)]">
        {hero ? (
          <ProductImage
            product={hero}
            transparentOnly
            loading="lazy"
            wrapperClassName="h-full w-full"
            className="h-full w-full object-contain p-2.5 sy-piece-shadow"
          />
        ) : null}
      </div>
      <span
        className="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[.08em] text-white"
        style={{ background: `${hue}cc` }}
      >
        {TIER_LABEL[entry.tier] || entry.tier}
      </span>
    </button>
  );
}

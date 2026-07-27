'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Gift, RotateCcw, Sparkles } from 'lucide-react';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { ProductImage } from '@/components/ProductImage';
import { WornFlatlay } from '@/components/WornFlatlay';
import { feedback, haptic } from '@/lib/feedback';
import { HapticTap } from '@/components/HapticTap';
import { computeBundleDeal } from '@/lib/bundle-deals';
import {
  claimStreak,
  currentStreak,
  dropClaimedToday,
  recordPull,
} from '@/lib/drop-vault';
import { lookRarity, type Rarity } from '@/lib/look-rarity';
import { bumpDaily } from '@/lib/stylist-xp';
import { useHeavyVisuals } from '@/lib/visual-capability';
import { Crate3D } from '@/components/three/Crate3D';
import CelebrationBurst from './CelebrationBurst';
import { getTransparentProductImageUrl, isEditorialCutoutProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';

// Re-exported so existing importers (BottomNav, /drop) keep working.
export { dropClaimedToday, currentStreak } from '@/lib/drop-vault';

/**
 * The Daily Drop crate — an HONEST CS:GO-crate-style reveal, living on its own
 * /drop tab. Will loved the knife-crate feel: the reel spins, decelerates with
 * that tick…tick…tick cadence, and LANDS on an item with a rarity flourish. We
 * take ONLY the reveal-delight and leave the gambling behind: it's free, it's
 * once a day, it always lands on a real wearable look (no "losing"), there's no
 * money, no paid crates, no re-roll chasing. The winning look is DETERMINISTIC —
 * the page seeds it by date — so it's stable all day and rotates daily; the reel
 * flying past is just theatre. Pulls double as the daily ritual: a real
 * consecutive-day streak. Revisiting the tab after you've opened shows the look
 * you pulled (no infinite re-spin). See [[sylistly-dopamine-direction]].
 */

export interface DropLook {
  key: string;
  items: Partial<Record<Category, Product>>;
  source?: string;
  label: string;
}

// ── Look helpers ───────────────────────────────────────────────────────────
const HERO_ORDER: Category[] = ['outer', 'top', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

function editorialPieces(items: Partial<Record<Category, Product>>): Product[] {
  return Object.values(items).filter(
    (product): product is Product => Boolean(product) && isEditorialCutoutProduct(product),
  );
}

function heroPiece(items: Partial<Record<Category, Product>>): Product | null {
  for (const category of HERO_ORDER) {
    const product = items[category];
    if (product && isEditorialCutoutProduct(product)) return product;
  }
  return editorialPieces(items)[0] ?? null;
}

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

const STRIDE = 116; // tile width (104) + gap (12)
const TILE_W = 104;
const TARGET_INDEX = 32; // where the winning tile sits in the reel
const REEL_LEN = 40;

interface ReelEntry {
  look: DropLook;
  rarity: Rarity;
  hero: Product | null;
}

export function DailyDrop({
  looks,
  winnerKey,
  onWear,
  daily = true,
}: {
  looks: DropLook[];
  /** The deterministic daily winner's key (the page seeds it by date). */
  winnerKey?: string;
  /** Shop the revealed look (the page opens checkout for it). */
  onWear: (look: DropLook) => void;
  /** Daily crate = streak + once-a-day claim + revisit-shows-claimed. A themed
   *  bundle crate (daily=false) opens fresh every time with no streak. */
  daily?: boolean;
}) {
  const [phase, setPhase] = useState<'intro' | 'spinning' | 'revealed'>('intro');
  const [ready, setReady] = useState(false);
  const [winnerReady, setWinnerReady] = useState(false);
  const [streak, setStreak] = useState(0);
  const [crateOpening, setCrateOpening] = useState(false);
  const heavyVisuals = useHeavyVisuals();
  // One-open guard: the crate-open flourish keeps the "tap to open" button
  // mounted for ~650ms before the reel takes over, so without this a fast
  // double-tap would fire bumpDaily('dropsOpened') twice (double XP). Resets
  // per mount, and the crate is only ever opened once per mount.
  const openedRef = useRef(false);
  // True once today's real claim has happened — further opens are pure THEATRE
  // (the "Replay the reveal" button), so they never re-award XP / re-claim the
  // streak / re-record the pull. Keeps the crate reachable without dishonest XP.
  const replayRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Build the reel + place today's winner under the marker. Winner is the
  // date-seeded key when provided (stable all day); otherwise the standout
  // (highest honest rarity) so it still feels earned.
  const { reel, winnerIndex } = useMemo(() => {
    const renderable = looks.filter((look) => editorialPieces(look.items).length >= 3);
    const pool = (renderable.length ? renderable : looks).filter((look) => heroPiece(look.items));
    if (!pool.length) return { reel: [] as ReelEntry[], winnerIndex: 0 };

    const withRarity = pool.map((look) => ({ look, rarity: lookRarity(look.items, look.source) }));
    let winner = winnerKey ? withRarity.find((entry) => entry.look.key === winnerKey) : undefined;
    if (!winner) {
      winner = withRarity[0];
      for (const entry of withRarity) if (entry.rarity.level > winner.rarity.level) winner = entry;
    }

    const entries: ReelEntry[] = Array.from({ length: REEL_LEN }, (_, i) => {
      const pick = withRarity[i % withRarity.length];
      return { look: pick.look, rarity: pick.rarity, hero: heroPiece(pick.look.items) };
    });
    entries[TARGET_INDEX] = { look: winner.look, rarity: winner.rarity, hero: heroPiece(winner.look.items) };
    return { reel: entries, winnerIndex: TARGET_INDEX };
  }, [looks, winnerKey]);

  const winner = reel[winnerIndex];
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // On mount: the DAILY crate, if already claimed today, shows the pull straight
  // away (revisiting a tab shouldn't re-spin forever). A themed bundle crate
  // always opens fresh at the closed crate.
  useEffect(() => {
    if (daily) {
      setStreak(currentStreak());
      if (dropClaimedToday()) setPhase('revealed');
    }
    setReady(true);
  }, [daily]);

  // Warm EVERY reel tile's hero while the crate sits closed, so the fast-moving
  // reel never flashes empty plates. (Lazy-loading can't keep up with the spin.)
  useEffect(() => {
    if (typeof window === 'undefined' || !reel.length) return;
    const urls = new Set<string>();
    reel.forEach((entry) => {
      const url = entry.hero ? getTransparentProductImageUrl(entry.hero) : null;
      if (url) urls.add(url);
    });
    urls.forEach((url) => {
      const img = new window.Image();
      img.decoding = 'async';
      img.src = url;
    });
  }, [reel]);

  // Fully DECODE the winner's pieces before the collage renders, so the reveal
  // always paints complete — never one-piece-at-a-time or (on a static revisit
  // with no spin to mask it) a half-empty plate. This is the real fix for the
  // "only the jacket showed" glitch.
  useEffect(() => {
    if (typeof window === 'undefined' || !winner) return;
    let cancelled = false;
    const urls = editorialPieces(winner.look.items)
      .map((product) => getTransparentProductImageUrl(product))
      .filter((url): url is string => Boolean(url));
    if (!urls.length) {
      setWinnerReady(true);
      return;
    }
    Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
          }),
      ),
    ).then(() => {
      if (!cancelled) setWinnerReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [winner]);

  const finishReveal = useCallback(() => {
    setPhase('revealed');
    if (winner) {
      feedback.reveal(winner.rarity.level);
      haptic(winner.rarity.level >= 2 ? [0, 32, 44, 30, 60, 46] : [0, 22, 40, 28]);
      // Reward side-effects fire ONLY on the genuine first open — a Replay is
      // theatre, so it never re-records the pull or re-claims the streak.
      if (!replayRef.current) {
        // Every pull (daily or themed) joins the Vault — deduped by key.
        recordPull({
          key: winner.look.key,
          label: winner.look.label,
          tier: winner.rarity.tier,
          level: winner.rarity.level,
          productIds: Object.values(winner.look.items)
            .filter((p): p is Product => Boolean(p))
            .map((p) => p.id),
        });
        if (daily) setStreak(claimStreak()); // streak only on the real open, never on replay/revisit
      }
    }
  }, [winner, daily]);

  const spin = useCallback(() => {
    if (openedRef.current) return; // ignore re-taps during the open→reel handoff
    openedRef.current = true;
    feedback.tick(); // unlock audio inside the gesture + lid-crack tick
    haptic(18);
    if (!replayRef.current) bumpDaily('dropsOpened'); // XP/quest only on the real open, never a replay
    if (reduceMotion || !winner) {
      finishReveal();
      return;
    }
    if (heavyVisuals) {
      // Play the 3D crate-open flourish, then hand off to the reel.
      setCrateOpening(true);
      window.setTimeout(() => setPhase('spinning'), 650);
    } else {
      setPhase('spinning');
    }
  }, [reduceMotion, winner, finishReveal, heavyVisuals]);

  // Replay = re-show the 3D crate + reveal as pure THEATRE (reachable anytime
  // once you've opened today's). replayRef makes spin()/finishReveal() skip all
  // reward side-effects, so no double XP / streak / vault entry.
  const replay = useCallback(() => {
    replayRef.current = true;
    openedRef.current = false;
    setCrateOpening(false);
    setPhase('intro');
  }, []);

  // Drive the reel with the Web Animations API — the transform runs on the
  // COMPOSITOR (GPU), so it's butter-smooth and never reconciles 40 tiles per
  // frame (that per-frame React re-render was the jank). A strong ease-out
  // (easeOutExpo-ish cubic-bezier) gives the long CS:GO decel; `onfinish`
  // reliably ends the spin (no rAF-hang). A tiny SEPARATE rAF only reads the
  // animation clock to fire the tick cadence — it writes nothing, so even if it
  // throttles, the visual + landing are unaffected.
  useEffect(() => {
    if (phase !== 'spinning') return;
    let cancelled = false;
    let done = false;
    let anim: Animation | null = null;
    let landTimer = 0;
    const duration = 4600;

    // Land exactly once, whether via the WAA finish event OR the timer backstop
    // (the finish event isn't reliably dispatched in some headless/backgrounded
    // contexts, so the timer is the source of truth).
    const land = () => {
      if (done || cancelled) return;
      done = true;
      finishReveal();
    };

    const start = () => {
      if (cancelled) return;
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) {
        rafRef.current = requestAnimationFrame(start); // refs not committed yet
        return;
      }
      // Guard width against a 0 during hydration/headless so the reel never
      // lands on a wildly-off transform (or divides by zero in the tick math).
      const width = Math.max(viewport.clientWidth, window.innerWidth, 360);
      const to = width / 2 - (winnerIndex * STRIDE + TILE_W / 2);
      track.style.transform = 'translate3d(0,0,0)';
      anim = track.animate(
        [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${to}px,0,0)` }],
        { duration, easing: 'cubic-bezier(0.13, 0.9, 0.2, 1)', fill: 'forwards' },
      );
      anim.onfinish = land;
      landTimer = window.setTimeout(land, duration + 120); // reliable backstop

      // Tick cadence — read the animation clock, fire on each tile crossing the
      // centre marker (fast blur early → spaced tick…tick…tick as it lands).
      let lastCenter = -1;
      const tickLoop = () => {
        if (cancelled || done || !anim) return;
        const ct = typeof anim.currentTime === 'number' ? anim.currentTime : 0;
        const t = Math.min(1, ct / duration);
        const eased = 1 - Math.pow(2, -10 * t);
        const pos = to * eased;
        const center = Math.round((width / 2 - pos - TILE_W / 2) / STRIDE);
        if (center !== lastCenter && t < 0.985) {
          lastCenter = center;
          feedback.tick();
        }
        if (t < 1) rafRef.current = requestAnimationFrame(tickLoop);
      };
      rafRef.current = requestAnimationFrame(tickLoop);
    };

    start();
    return () => {
      cancelled = true;
      if (landTimer) clearTimeout(landTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      anim?.cancel();
    };
  }, [phase, winnerIndex, finishReveal]);

  if (!winner) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <Gift size={32} className="text-muted" />
        <p className="mt-3 text-[14px] font-semibold text-ink">Your drop is warming up</p>
        <p className="mt-1 text-[12px] text-muted">Come back in a moment for today&rsquo;s fit.</p>
      </div>
    );
  }

  const hue = winner.rarity.hue;
  const winnerPieces = editorialPieces(winner.look.items);
  // The bundle = every shoppable piece in the look (what checkout actually buys).
  const bundleProducts = Object.values(winner.look.items).filter(
    (product): product is Product => Boolean(product) && (product.priceCents || 0) > 0,
  );
  const deal = computeBundleDeal(bundleProducts);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6">
      {/* Ambient rarity glow that intensifies on reveal. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: phase === 'revealed' ? 0.9 : 0.4,
          background: `radial-gradient(120% 70% at 50% ${phase === 'revealed' ? '40%' : '48%'}, ${hue}22 0%, transparent 60%)`,
        }}
      />

      {!ready ? (
        <div className="h-40 w-40 animate-pulse rounded-[34px] bg-surface-2/60" />
      ) : null}

      {/* ── INTRO: the closed crate ─────────────────────────────────────── */}
      {ready && phase === 'intro' ? (
        <div className="flex flex-col items-center text-center sy-fade-up">
          <p className="max-w-[27ch] text-[13px] leading-snug text-muted">
            One curated look, revealed. Free, always wearable — open it to keep your streak alive.
          </p>

          <HapticTap
            onTap={spin}
            ariaLabel="Open today's drop"
            className="sy-press group relative mt-8 grid h-56 w-56 place-items-center rounded-[36px] sy-glow-breathe"
            style={{
              background: 'linear-gradient(150deg,#1b1b20 0%,#141417 100%)',
              boxShadow: `0 0 0 1px ${hue}40, 0 34px 64px -22px ${hue}66, inset 0 1px 0 rgba(255,255,255,.06)`,
            }}
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
              <span className="sy-shimmer-sweep absolute -inset-y-4 -left-1/3 w-1/3 rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent)]" />
            </span>
            {heavyVisuals ? (
              <Crate3D hue={hue} opening={crateOpening} />
            ) : (
              <span
                className="grid h-[88px] w-[88px] place-items-center rounded-[24px]"
                style={{ background: `radial-gradient(circle at 50% 35%, ${hue}, ${hue}99)`, boxShadow: `0 14px 34px -8px ${hue}` }}
              >
                <Gift size={42} className="text-white" strokeWidth={1.7} />
              </span>
            )}
            <span className="absolute bottom-6 z-10 text-[11px] font-black uppercase tracking-[.3em] text-ink/90">
              Tap to open
            </span>
          </HapticTap>

          {daily && streak > 0 ? (
            <p className="mt-8 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted">
              <Flame size={14} className="text-accent" /> <span className="text-ink">{streak}-day</span> streak going
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── SPINNING: the CS:GO reel ────────────────────────────────────── */}
      {ready && phase === 'spinning' ? (
        <div className="w-full">
          <p className="mb-6 text-center text-[11px] font-black uppercase tracking-[.34em] text-muted">
            Revealing…
          </p>
          <div ref={viewportRef} className="relative h-[180px] w-full overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-[linear-gradient(90deg,var(--bg),transparent)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-[linear-gradient(270deg,var(--bg),transparent)]" />
            <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-full w-px -translate-x-1/2 bg-accent shadow-[0_0_14px_#FF2D6D]" />
            <div className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-accent" />
            <div className="pointer-events-none absolute bottom-0 left-1/2 z-30 -translate-x-1/2 border-x-[7px] border-b-[9px] border-x-transparent border-b-accent" />

            <div
              ref={trackRef}
              className="flex h-full items-center gap-3 will-change-transform"
              style={{ transform: 'translate3d(0,0,0)' }}
            >
              {reel.map((entry, index) => (
                <ReelTile key={index} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── REVEALED: the winning look ──────────────────────────────────── */}
      {ready && phase === 'revealed' ? (
        <div className="relative flex w-full flex-col items-center">
          {/* Screen-reader announcement of the otherwise-visual reveal. */}
          <div className="sr-only" role="status" aria-live="polite">
            {`Drop revealed — ${winner.rarity.label} look: ${winner.look.label}`}
          </div>
          {/* Jackpot payoff: a light flash + confetti spray fanning from the look. */}
          <span
            aria-hidden
            className="sy-flash pointer-events-none absolute left-1/2 top-[36%] z-20 h-72 w-72 rounded-full"
            style={{ background: `radial-gradient(circle, ${hue}cc 0%, ${hue}33 36%, transparent 70%)` }}
          />
          <CelebrationBurst level={winner.rarity.level} hue={hue} origin={{ x: 0.5, y: 0.36 }} />
          {winner.rarity.level >= 2 ? (
            <span
              aria-hidden
              className="sy-ring-burst pointer-events-none absolute top-[30%] h-44 w-44 rounded-full"
              style={{ border: `2px solid ${hue}`, boxShadow: `0 0 40px ${hue}` }}
            />
          ) : null}

          <span
            className="sy-pop-in inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[.24em]"
            style={{ borderColor: hue, color: hue, background: 'rgba(13,13,15,.55)', boxShadow: `0 0 18px ${hue}55` }}
          >
            {winner.rarity.level >= 3 ? <Flame size={11} /> : null}
            {winner.rarity.label}
          </span>

          <div
            className="relative mt-4 aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-[26px] bg-[radial-gradient(circle_at_50%_34%,#867f78_0%,#56514c_52%,#2c2a28_100%)] sy-pop-in"
            style={{ boxShadow: `0 24px 60px -20px ${hue}77, 0 0 0 1px ${hue}33` }}
          >
            {winnerReady ? (
              <WornFlatlay items={winner.look.items} active loading="eager" plate="spotlight" className="h-full w-full" />
            ) : (
              <div className="h-full w-full animate-pulse" />
            )}
          </div>

          <h2 className="mt-5 text-center font-display text-[28px] leading-[1.05] text-ink sy-fade-up">
            {winner.look.label}
          </h2>
          {deal.hasDeal ? (
            <div className="mt-2 flex flex-col items-center gap-1 sy-fade-up">
              <div className="flex items-center gap-2 text-[14px]">
                <span className="text-muted line-through">{formatPrice(deal.retailCents)}</span>
                <AnimatedNumber
                  value={deal.dealCents / 100}
                  format={(n) => `$${Math.round(n).toLocaleString()}`}
                  className="font-bold text-emerald-300"
                />
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em] text-white"
                  style={{ background: hue }}
                >
                  Save up to {deal.pct}%
                </span>
              </div>
              <p className="text-[11px] text-muted">
                {winnerPieces.length} pieces · first-order offers, redeem at each brand
              </p>
            </div>
          ) : (
            <p className="mt-1.5 flex items-center gap-2 text-[13px] text-muted sy-fade-up">
              <AnimatedNumber
                value={deal.retailCents / 100}
                format={(n) => `$${Math.round(n).toLocaleString()}`}
                className="rounded-full bg-surface-2 px-2.5 py-0.5 font-semibold text-emerald-300"
              />
              <span>{winnerPieces.length} pieces · shoppable</span>
            </p>
          )}

          {daily ? (
            <p className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink sy-fade-up">
              <Flame size={14} className="text-accent" /> <span className="text-accent">{streak}-day</span> streak
              {streak > 1 ? ' — keep it alive tomorrow' : ' — back tomorrow for day 2'}
            </p>
          ) : (
            <div className="mt-4" />
          )}

          <div className="mt-6 flex w-full max-w-[320px] flex-col gap-2.5">
            <HapticTap
              onTap={() => {
                feedback.save();
                onWear(winner.look);
              }}
              className="sy-press sy-cta relative grid h-12 place-items-center overflow-hidden rounded-full bg-accent text-[14px] font-bold text-white shadow-pink-glow"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles size={15} /> {deal.hasDeal ? `Shop the bundle · save up to ${formatPrice(deal.savingsCents)}` : 'Shop the bundle'}
              </span>
            </HapticTap>
            {deal.hasDeal ? (
              <div className="flex flex-col items-center gap-0.5">
                {deal.offers.map((o) => (
                  <p key={o.retailer} className="text-center text-[11px] text-muted">
                    <span className="font-semibold text-ink">{o.retailer}</span> · {o.label}
                    {o.redeem === 'signup' ? ' — sign up' : o.redeem === 'verify' ? ' — verify' : o.code ? ` — code ${o.code}` : ''}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-center text-[11px] text-muted">A fresh drop unlocks every day.</p>
            )}
            <button
              type="button"
              onClick={replay}
              className="sy-press mx-auto mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-2 hover:text-ink"
            >
              <RotateCcw size={13} /> Replay the reveal
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReelTile({ entry }: { entry: ReelEntry }) {
  const count = editorialPieces(entry.look.items).length;
  return (
    <div
      className="relative h-[150px] shrink-0 overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_50%_34%,#867f78_0%,#56514c_52%,#2c2a28_100%)]"
      style={{ width: TILE_W, boxShadow: `inset 0 -3px 0 ${entry.rarity.hue}, 0 0 0 1px ${entry.rarity.hue}44` }}
    >
      {entry.hero ? (
        <ProductImage
          product={entry.hero}
          transparentOnly
          loading="eager"
          wrapperClassName="h-full w-full"
          className="h-full w-full object-contain p-3 sy-piece-shadow"
        />
      ) : null}
      <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-black/55 px-1 text-[9px] font-black text-white backdrop-blur-sm">
        {count}
      </span>
    </div>
  );
}

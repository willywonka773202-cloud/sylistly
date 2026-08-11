'use client';

import { Bookmark, Compass, Gift, Layers, LayoutGrid, User, WandSparkles } from 'lucide-react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
// Import from the (now catalog-free) lib, NOT the DailyDrop component — pulling
// it through DailyDrop dragged the 898KB catalog into every route's nav bundle.
import { dropClaimedToday } from '@/lib/drop-vault';
import { feedback } from '@/lib/feedback';
import { useSavedFits } from '@/store/saved-fits';

/**
 * Sylistly primary navigation — a floating editorial pill with five surfaces:
 * the Scroll (home), the Remix board, the Daily Drop (the hero, dead centre),
 * Saved looks, and You. A single glow "lamp" springs between tabs (its x is
 * measured from the active tab, so it's exact across widths) and the Drop
 * pulses until you've opened today's.
 */
export function BottomNav() {
  const pathname = usePathname() ?? '';
  const scrollActive =
    pathname === '/' || pathname.startsWith('/browse') || pathname.startsWith('/discover');
  const remixActive = pathname.startsWith('/build') || pathname.startsWith('/checkout');
  const dropActive = pathname.startsWith('/drop');
  const savedActive = pathname.startsWith('/saved');
  const profileActive = pathname.startsWith('/profile');

  // Live count of saved fits — badges the Saved tab so the collection growing is
  // visible from anywhere (mirrors the Drop's unclaimed dot). Keyed by count so
  // it pops on change: the functional "it saved" confirmation. Defaults to 0
  // pre-hydration (matches SSR), so no badge flashes before the store rehydrates.
  const savedCount = useSavedFits((state) => state.fits.length);

  // Pulse the Drop until today's is claimed; re-check whenever the route changes
  // (so it stops pulsing right after you open it and come back).
  const [dropUnclaimed, setDropUnclaimed] = useState(false);
  useEffect(() => {
    setDropUnclaimed(!dropClaimedToday());
  }, [pathname]);

  // Measure the active tab's centre so the single lamp springs to the exact spot
  // (deterministic across viewport widths; framer owns only the x transform).
  const barRef = useRef<HTMLDivElement>(null);
  const [lampX, setLampX] = useState<number | null>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      const active = bar.querySelector<HTMLElement>('[data-nav-active="true"]');
      if (active) setLampX(active.offsetLeft + active.offsetWidth / 2);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pathname]);

  // The lamp springs to the measured x; its travel VELOCITY stretches it toward
  // the direction of motion and brightens it on arrival, so it reads as a liquid
  // pull of light rather than a sliding smudge. Keeps the measured-x + margin
  // architecture (never layoutId — see [[sylistly-framer-layoutid-transform]]).
  const reduce = useReducedMotion();
  const mvX = useMotionValue(0);
  const springX = useSpring(mvX, { stiffness: 380, damping: 30 });
  const lampScaleX = useTransform(() => 1 + Math.min(1, Math.abs(springX.getVelocity()) / 2200) * 1.7);
  const lampOpacity = useTransform(() => 0.22 + Math.min(1, Math.abs(springX.getVelocity()) / 2200) * 0.3);
  useEffect(() => {
    if (lampX != null) mvX.set(lampX);
  }, [lampX, mvX]);

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:hidden"
      >
        <div
          ref={barRef}
          className="pointer-events-auto relative grid h-[68px] w-full max-w-[440px] grid-cols-5 items-center rounded-full border border-hairline-2 bg-[linear-gradient(180deg,rgba(27,26,33,.92),rgba(12,11,14,.94))] px-2 shadow-float backdrop-blur-2xl"
        >
          <span className="pointer-events-none absolute inset-x-7 top-0 h-px rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,110,138,.5),transparent)]" />
          {lampX != null ? (
            reduce ? (
              <span
                aria-hidden
                className="pointer-events-none absolute top-1.5 h-9 w-12 rounded-full bg-accent/20 blur-[10px]"
                style={{ left: lampX, marginLeft: -24 }}
              />
            ) : (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute left-0 top-1.5 h-9 w-12 rounded-full bg-accent blur-[10px]"
                style={{ x: springX, marginLeft: -24, scaleX: lampScaleX, opacity: lampOpacity, transformOrigin: 'center' }}
              />
            )
          ) : null}
          <NavTool href="/" label="For You" icon={Compass} active={scrollActive} />
          <NavTool href="/build" label="Remix" icon={WandSparkles} active={remixActive} />
          <DropTool active={dropActive} unclaimed={dropUnclaimed} />
          <NavTool href="/saved" label="Saved" icon={Bookmark} active={savedActive} badge={savedCount} />
          <NavTool href="/profile" label="You" icon={User} active={profileActive} />
        </div>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[260px] p-5 lg:flex">
        <nav aria-label="Primary navigation" className="flex w-full flex-col rounded-[28px] border border-hairline bg-[rgba(17,16,19,.94)] p-4 shadow-float backdrop-blur-2xl">
          <Link href="/" className="sy-press rounded-2xl px-3 py-4">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-accent/50 bg-accent-soft text-accent">
                <Compass size={20} />
              </span>
              <span>
                <span className="block text-[13px] font-black uppercase tracking-[.2em] text-ink">Sylistly</span>
                <span className="mt-1 block font-serif text-[14px] italic text-champagne">Your complete look</span>
              </span>
            </span>
          </Link>

          <div className="mt-6 flex flex-col gap-1">
            <DesktopNavTool href="/" label="For You" description="Complete looks in budget" icon={Compass} active={pathname === '/'} />
            <DesktopNavTool href="/discover" label="Discover" description="Browse style directions" icon={Layers} active={pathname.startsWith('/discover')} />
            <DesktopNavTool href="/browse" label="Browse pieces" description="Search the live catalog" icon={LayoutGrid} active={pathname.startsWith('/browse')} />
            <DesktopNavTool href="/build" label="Remix" description="Replace a piece or rebuild" icon={WandSparkles} active={remixActive} />
            <DesktopNavTool href="/drop" label="Daily Drop" description="Today's matched arrival" icon={Gift} active={dropActive} dot={dropUnclaimed} />
            <DesktopNavTool href="/saved" label="Saved" description="Looks and individual pieces" icon={Bookmark} active={savedActive} badge={savedCount} />
            <DesktopNavTool href="/profile" label="You" description="Budget, fit, and preferences" icon={User} active={profileActive} />
          </div>

          <div className="mt-auto border-t border-hairline px-3 pt-4">
            <p className="text-[11px] leading-relaxed text-muted-2">
              Complete outfits from exact retailer pages. Replace one piece without losing the look.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-money">
              <span className="h-2 w-2 rounded-full bg-money" /> Buyability checked
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}

function DesktopNavTool({
  href,
  label,
  description,
  icon: Icon,
  active,
  badge,
  dot,
}: {
  href: string;
  label: string;
  description: string;
  icon: typeof User;
  active: boolean;
  badge?: number;
  dot?: boolean;
}) {
  const showBadge = typeof badge === 'number' && badge > 0;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      aria-label={`${label}. ${description}${showBadge ? `. ${badge} saved fit${badge !== 1 ? 's' : ''}` : ''}${dot ? '. New item available' : ''}`}
      className={`sy-press group flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
        active ? 'bg-accent-soft text-ink ring-1 ring-accent/35' : 'text-muted-2 hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? 'bg-accent text-white' : 'bg-surface-2 text-current'}`}>
        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
        {dot ? <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-champagne ring-2 ring-[#17171A]" /> : null}
        {showBadge ? (
          <span aria-hidden className="absolute -right-2 -top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-accent px-1 text-[9px] font-extrabold text-bg ring-2 ring-[#17171A]">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-current">{label}</span>
        <span className="mt-0.5 block truncate text-[10px] text-muted">{description}</span>
      </span>
    </Link>
  );
}

/** The Daily Drop — the centre hero tab: a raised accent puck so it reads as
 *  the app's signature moment, with a pulse dot until today's drop is opened. */
function DropTool({ active, unclaimed }: { active: boolean; unclaimed: boolean }) {
  return (
    <Link
      href="/drop"
      data-nav-active={active}
      aria-current={active ? 'page' : undefined}
      aria-label={unclaimed ? "Daily Drop — today's is ready" : 'Daily Drop'}
      onClick={() => { if (!active) feedback.reveal(1); }}
      className="sy-press relative flex min-w-0 flex-col items-center justify-center gap-1 text-center"
    >
      <span
        className={`relative grid h-11 w-11 -translate-y-1 place-items-center rounded-full text-white shadow-[0_10px_24px_-6px_rgba(255,45,109,.7)] transition-transform duration-200 ease-out ${
          active ? 'scale-105' : ''
        } ${unclaimed ? 'sy-glow-breathe' : ''}`}
        style={{ background: 'radial-gradient(circle at 50% 32%, #FF5C8A 0%, #FF2D6D 70%)' }}
      >
        <Gift size={21} strokeWidth={2} />
        {unclaimed ? (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-champagne shadow-[0_0_8px_#E7C79B] ring-2 ring-[#141417]" />
        ) : null}
      </span>
      <span className={`-mt-0.5 max-w-full truncate text-[11px] font-semibold tracking-wide ${active ? 'text-ink' : 'text-muted'}`}>
        Drop
      </span>
    </Link>
  );
}

function NavTool({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: typeof User;
  active: boolean;
  /** Optional count badge (e.g. saved fits). Hidden when 0/undefined. */
  badge?: number;
}) {
  const reduce = useReducedMotion();
  const showBadge = typeof badge === 'number' && badge > 0;
  return (
    <Link
      href={href}
      data-nav-active={active}
      aria-current={active ? 'page' : undefined}
      aria-label={showBadge ? `${label} — ${badge} saved fit${badge !== 1 ? 's' : ''}` : undefined}
      onClick={() => { if (!active) feedback.save(); }}
      className={`sy-press relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-center transition ${
        active ? 'text-ink' : 'text-muted hover:text-muted-2'
      }`}
    >
      <motion.span
        className={`relative grid h-7 w-7 place-items-center rounded-full ${active ? 'text-accent' : 'text-current'}`}
        animate={active && !reduce ? { scale: 1.12, y: -1 } : { scale: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 16 }}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
        {showBadge ? (
          <span
            key={badge}
            aria-hidden
            className="sy-pop-in absolute -right-2.5 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-accent px-1 text-[9px] font-extrabold leading-none text-bg ring-2 ring-[#141417]"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </motion.span>
      <span className={`max-w-full truncate text-[11px] font-semibold tracking-wide ${active ? 'text-ink' : ''}`}>
        {label}
      </span>
      <span
        aria-hidden
        className={`h-[3px] w-[3px] rounded-full bg-accent transition-all duration-200 ease-out motion-reduce:transition-none ${
          active ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
      />
    </Link>
  );
}

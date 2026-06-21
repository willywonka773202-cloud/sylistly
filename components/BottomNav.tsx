'use client';

import { Bookmark, GalleryVerticalEnd, Gift, User, WandSparkles } from 'lucide-react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { dropClaimedToday } from '@/components/DailyDrop';
import { feedback } from '@/lib/feedback';

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
    <nav
      aria-label="Primary navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+12px)]"
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
        <NavTool href="/" label="Scroll" icon={GalleryVerticalEnd} active={scrollActive} />
        <NavTool href="/build" label="Remix" icon={WandSparkles} active={remixActive} />
        <DropTool active={dropActive} unclaimed={dropUnclaimed} />
        <NavTool href="/saved" label="Saved" icon={Bookmark} active={savedActive} />
        <NavTool href="/profile" label="You" icon={User} active={profileActive} />
      </div>
    </nav>
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
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-champagne shadow-[0_0_8px_#E7C79B] ring-2 ring-[#141417]" />
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
}: {
  href: string;
  label: string;
  icon: typeof User;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <Link
      href={href}
      data-nav-active={active}
      aria-current={active ? 'page' : undefined}
      onClick={() => { if (!active) feedback.save(); }}
      className={`sy-press relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-center transition ${
        active ? 'text-ink' : 'text-muted hover:text-muted-2'
      }`}
    >
      <motion.span
        className={`grid h-7 w-7 place-items-center rounded-full ${active ? 'text-accent' : 'text-current'}`}
        animate={active && !reduce ? { scale: 1.12, y: -1 } : { scale: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 16 }}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      </motion.span>
      <span className={`max-w-full truncate text-[11px] font-semibold tracking-wide ${active ? 'text-ink' : ''}`}>
        {label}
      </span>
      <span
        className={`h-[3px] w-[3px] rounded-full bg-accent transition-all duration-200 ease-out ${
          active ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
      />
    </Link>
  );
}

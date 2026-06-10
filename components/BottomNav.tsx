'use client';

import { Bookmark, GalleryVerticalEnd, User, WandSparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Sylistly primary navigation — a floating editorial pill with the four real
 * surfaces: the Scroll (home), the Remix board, Saved looks, and You.
 */
export function BottomNav() {
  const pathname = usePathname() ?? '';
  const scrollActive = pathname === '/' || pathname.startsWith('/browse');
  const remixActive = pathname.startsWith('/build') || pathname.startsWith('/checkout');
  const savedActive = pathname.startsWith('/saved');
  const profileActive = pathname.startsWith('/profile');

  return (
    <nav
      aria-label="Primary navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+12px)]"
    >
      <div className="pointer-events-auto relative grid h-[68px] w-full max-w-[420px] grid-cols-4 items-center rounded-full border border-hairline-2 bg-[linear-gradient(180deg,rgba(27,26,33,.92),rgba(12,11,14,.94))] px-3 shadow-float backdrop-blur-2xl">
        <span className="pointer-events-none absolute inset-x-7 top-0 h-px rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,110,138,.5),transparent)]" />
        <NavTool href="/" label="Scroll" icon={GalleryVerticalEnd} active={scrollActive} />
        <NavTool href="/build" label="Remix" icon={WandSparkles} active={remixActive} accent />
        <NavTool href="/saved" label="Saved" icon={Bookmark} active={savedActive} />
        <NavTool href="/profile" label="You" icon={User} active={profileActive} />
      </div>
    </nav>
  );
}

function NavTool({
  href,
  label,
  icon: Icon,
  active,
  accent = false,
}: {
  href: string;
  label: string;
  icon: typeof User;
  active: boolean;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`sy-press relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-center transition ${
        active ? 'text-ink' : 'text-muted hover:text-muted-2'
      }`}
    >
      <span
        className={`grid h-7 w-7 place-items-center rounded-full transition-all duration-200 ease-out ${
          active
            ? 'scale-110 bg-accent-soft text-accent shadow-[0_0_16px_rgba(255,45,109,.22)]'
            : accent
              ? 'text-accent/80'
              : 'text-current'
        }`}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      </span>
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

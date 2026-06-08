'use client';

import { House, Images, Plus, Shirt, User, WandSparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Sylistly primary navigation — a floating editorial pill with five
 * destinations and a center Create action. Active state reflects the section
 * the user is actually in (each tab owns its own routes).
 */
export function BottomNav() {
  const pathname = usePathname() ?? '';
  const homeActive = pathname === '/';
  const feedActive = pathname.startsWith('/feed') || pathname.startsWith('/discover');
  const createActive = pathname.startsWith('/build') || pathname.startsWith('/canvas');
  const stylistActive = pathname.startsWith('/stylist');
  const closetActive = pathname.startsWith('/wardrobe') || pathname.startsWith('/saved');
  const profileActive = pathname.startsWith('/profile');

  return (
    <nav
      aria-label="Primary navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+12px)]"
    >
      <div className="pointer-events-auto relative grid h-[72px] w-full max-w-[460px] grid-cols-[1fr_1fr_72px_1fr_1fr_1fr] items-center rounded-full border border-hairline-2 bg-[linear-gradient(180deg,rgba(27,26,33,.92),rgba(12,11,14,.94))] px-2 shadow-[0_18px_56px_rgba(0,0,0,.5)] backdrop-blur-2xl">
        <span className="pointer-events-none absolute inset-x-7 top-0 h-px rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,110,138,.5),transparent)]" />
        <NavTool href="/" label="Home" icon={House} active={homeActive} />
        <NavTool href="/feed" label="Feed" icon={Images} active={feedActive} />
        <Link
          href="/build"
          aria-label="Create an outfit"
          aria-current={createActive ? 'page' : undefined}
          className="sy-press mx-auto -mt-7 flex flex-col items-center"
        >
          <span
            className={`grid h-[58px] w-[58px] place-items-center rounded-full text-white ring-1 ring-white/15 transition ${
              createActive
                ? 'bg-[linear-gradient(135deg,#ff3b63,#ff6e8a)] shadow-[0_16px_38px_rgba(255,59,99,.5)]'
                : 'bg-[radial-gradient(circle_at_34%_22%,#ff7c9b,rgba(255,59,99,.62)_52%,rgba(120,30,52,.78))] shadow-[0_14px_30px_rgba(255,59,99,.34)]'
            }`}
          >
            <Plus size={30} strokeWidth={2.2} />
          </span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-accent">Create</span>
        </Link>
        <NavTool href="/stylist" label="Syli" icon={WandSparkles} active={stylistActive} />
        <NavTool href="/wardrobe" label="Closet" icon={Shirt} active={closetActive} />
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
}: {
  href: string;
  label: string;
  icon: typeof House;
  active: boolean;
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
          active ? 'scale-110 bg-accent-soft text-accent shadow-[0_0_16px_rgba(255,59,99,.22)]' : 'text-current'
        }`}
      >
        <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      </span>
      <span className={`max-w-full truncate text-[10px] font-semibold tracking-wide ${active ? 'text-ink' : ''}`}>
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

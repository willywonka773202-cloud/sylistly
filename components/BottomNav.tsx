'use client';

import { House, Images, Plus, Shirt, User, WandSparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const pathname = usePathname() ?? '';
  const homeActive = pathname === '/';
  const feedActive = pathname.startsWith('/feed') || pathname.startsWith('/discover') || pathname.startsWith('/saved');
  const createActive = pathname.startsWith('/canvas') || pathname.startsWith('/build');
  const stylistActive = pathname.startsWith('/stylist');
  const closetActive = pathname.startsWith('/wardrobe');
  const profileActive = pathname.startsWith('/profile');
  const light = variant === 'light';

  return (
    <nav
      aria-label="Primary navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+10px)]"
    >
      <div className={`pointer-events-auto relative grid h-[76px] w-full max-w-[462px] grid-cols-[1fr_1fr_76px_1fr_1fr_1fr] items-center overflow-visible rounded-full px-2 backdrop-blur-2xl ${
        light
          ? 'border border-[#eee7f3] bg-white shadow-[0_18px_46px_rgba(50,20,72,.16)]'
          : 'border border-[rgba(232,54,93,.32)] bg-[radial-gradient(circle_at_50%_-18%,rgba(246,48,107,.22),transparent_48%),linear-gradient(180deg,rgba(39,24,29,.88),rgba(15,12,12,.9))] shadow-[0_18px_58px_rgba(0,0,0,.46),0_0_36px_rgba(246,48,107,.16)]'
      }`}>
        <div className={`pointer-events-none absolute inset-x-5 top-2 h-px rounded-full ${light ? 'bg-[linear-gradient(90deg,transparent,rgba(248,70,167,.22),transparent)]' : 'bg-[linear-gradient(90deg,transparent,rgba(255,123,159,.55),transparent)]'}`} />
        <div className={`pointer-events-none absolute inset-x-8 bottom-2 h-px rounded-full ${light ? 'bg-[linear-gradient(90deg,transparent,rgba(179,92,255,.18),transparent)]' : 'bg-[linear-gradient(90deg,transparent,rgba(246,48,107,.28),transparent)]'}`} />
        <NavTool href="/" label="Home" icon={House} active={homeActive} variant={variant} />
        <NavTool href="/feed" label="Feed" icon={Images} active={feedActive} variant={variant} />
        <Link
          href="/build"
          aria-label="Create outfit"
          aria-current={createActive ? 'page' : undefined}
          className={`sy-press mx-auto flex -translate-y-2 flex-col items-center justify-center gap-1 transition active:scale-95 ${light ? 'text-[#171118]' : 'text-white'}`}
        >
          <span className={`grid h-[60px] w-[60px] place-items-center rounded-full text-white shadow-[0_18px_38px_rgba(246,48,107,.28)] ${
            light
              ? 'bg-[linear-gradient(135deg,#f846a7_0%,#b35cff_100%)]'
              : createActive
                ? 'bg-[linear-gradient(135deg,#f6306b_0%,#ff7aa2_58%,#f6306b_100%)] shadow-pink-glow ring-1 ring-[rgba(255,255,255,.14)]'
                : 'border border-[rgba(232,54,93,.45)] bg-[radial-gradient(circle_at_34%_20%,rgba(255,124,159,.9),rgba(246,48,107,.52)_50%,rgba(86,25,43,.72)_100%)] ring-1 ring-[rgba(255,255,255,.14)]'
          }`}>
            <Plus size={32} strokeWidth={2.1} />
          </span>
          <span className={`text-[10px] font-black uppercase tracking-[.12em] ${
            light ? (createActive ? 'text-[#f846a7]' : 'text-[#9f91a5]') : createActive ? 'text-white' : 'text-[rgba(232,54,93,.78)]'
          }`}>Create</span>
        </Link>
        <NavTool href="/stylist" label="Syli" icon={WandSparkles} active={stylistActive} variant={variant} />
        <NavTool href="/wardrobe" label="Closet" icon={Shirt} active={closetActive} variant={variant} />
        <NavTool href="/profile" label="Profile" icon={User} active={profileActive} variant={variant} />
      </div>
    </nav>
  );
}

function NavTool({
  href,
  label,
  icon: Icon,
  active,
  variant,
}: {
  href: string;
  label: string;
  icon: typeof House;
  active: boolean;
  variant: 'dark' | 'light';
}) {
  const light = variant === 'light';
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`sy-press relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[22px] py-2 text-center transition active:scale-95 motion-safe:transition-all motion-safe:duration-150 ${
        light
          ? active
            ? 'bg-[#fff0f8] text-[#171118] shadow-[inset_0_0_0_1px_rgba(248,70,167,.18)]'
            : 'text-[#9f91a5] hover:bg-[#faf6fc] hover:text-[#171118]'
          : active
            ? 'bg-[rgba(232,54,93,.12)] text-white shadow-[inset_0_0_0_1px_rgba(246,48,107,.26),0_10px_26px_rgba(246,48,107,.1)]'
            : 'text-[#b9909b] hover:bg-white/[0.045] hover:text-[#ffdbe5]'
      }`}
    >
      <Icon size={21} strokeWidth={active ? 2.6 : 2.05} className={active ? 'text-accent' : ''} />
      <span className={`max-w-full truncate text-[9px] font-semibold tracking-[-.01em] ${active && !light ? 'text-white' : ''}`}>{label}</span>
    </Link>
  );
}

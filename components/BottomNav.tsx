'use client';
import { Flame, Grid, Shirt, Star, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const tabs = [
  { href: '/feed',      label: 'Feed',     icon: Flame },
  { href: '/discover',  label: 'Discover', icon: Star },
  { href: '/build',     label: 'Build',    icon: Grid },
  { href: '/wardrobe',  label: 'Closet',   icon: Shirt },
  { href: '/profile',   label: 'Profile',  icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav className="h-[74px] border-t border-hairline bg-bg/96 pb-3 pt-1.5 shadow-[0_-12px_32px_rgba(0,0,0,.18)] backdrop-blur-md grid grid-cols-5">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/feed' && pathname.startsWith(href));
        const primary = href === '/build';
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${
              active ? 'text-ink opacity-100' : 'text-muted opacity-60 hover:opacity-85'
            }`}
          >
            {active && !primary ? <span className="absolute top-0.5 h-0.5 w-4 rounded bg-accent" /> : null}
            <span
              className={
                primary
                  ? `grid h-12 w-12 place-items-center rounded-full border text-white shadow-[0_16px_32px_rgba(0,0,0,.3)] ${
                      active ? 'border-accent bg-accent shadow-pink-glow' : 'border-white/12 bg-[#11100f]'
                    }`
                  : 'grid h-6 w-6 place-items-center'
              }
            >
              <Icon size={primary ? 22 : 21} strokeWidth={primary ? 1.9 : 1.6} />
            </span>
            <span className={primary ? '-mt-0.5 text-[9px]' : ''}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

'use client';
import { Grid, Star, Bookmark, User, Flame } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const tabs = [
  { href: '/feed',      label: 'Feed',     icon: Flame },
  { href: '/build',     label: 'Build',    icon: Grid },
  { href: '/discover',  label: 'Discover', icon: Star },
  { href: '/saved',     label: 'Saved',    icon: Bookmark },
  { href: '/profile',   label: 'Profile',  icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav className="h-[68px] pt-1.5 pb-3.5 bg-bg border-t border-hairline grid grid-cols-5">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <button
            key={href}
            onClick={() => router.push(href)}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium relative ${
              active ? 'text-ink opacity-100' : 'text-muted opacity-55'
            }`}
          >
            {active && <span className="absolute top-0.5 w-4 h-0.5 rounded bg-accent" />}
            <Icon size={22} strokeWidth={1.6} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

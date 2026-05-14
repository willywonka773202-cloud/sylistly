'use client';
import { Grid, Star, Bookmark, User, Flame } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/feed',      label: 'Feed',     icon: Flame },
  { href: '/build',     label: 'Build',    icon: Grid },
  { href: '/discover',  label: 'Discover', icon: Star },
  { href: '/saved',     label: 'Saved',    icon: Bookmark },
  { href: '/profile',   label: 'Profile',  icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    // Each tab uses next/link <Link>, not a button + router.push.
    // router.push fires an RSC fetch unconditionally — including for the
    // already-active tab — and racing pushes against an in-flight RSC
    // prefetch can surface as `TypeError: Failed to fetch` in the browser
    // console (the abort of the prior fetch). <Link> coordinates with
    // Next.js's prefetch cache + AbortController, no-ops when already on
    // the route, and is the idiomatic App Router navigation primitive.
    <nav className="h-[68px] pt-1.5 pb-3.5 bg-bg border-t border-hairline grid grid-cols-5">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium relative ${
              active ? 'text-ink opacity-100' : 'text-muted opacity-55'
            }`}
          >
            {active && <span className="absolute top-0.5 w-4 h-0.5 rounded bg-accent" />}
            <Icon size={22} strokeWidth={1.6} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

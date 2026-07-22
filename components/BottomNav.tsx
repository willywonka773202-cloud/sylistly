'use client';
import { Grid, Star, Bookmark, User, Flame, Layers, Shirt } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const tabs = [
  { href: '/feed', label: 'Feed', icon: Flame },
  { href: '/swipe', label: 'Swipe', icon: Layers },
  { href: '/build', label: 'Build', icon: Grid },
  { href: '/wardrobe', label: 'Closet', icon: Shirt },
  { href: '/discover', label: 'Discover', icon: Star },
  { href: '/saved', label: 'Saved', icon: Bookmark },
  { href: '/profile', label: 'Profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav className="sticky bottom-0 z-40 grid grid-cols-7 border-t border-hairline bg-bg/85 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          (href === '/wardrobe' && pathname.startsWith('/wardrobe')) ||
          (href === '/saved' && pathname.startsWith('/saved'));
        return (
          <motion.button
            key={href}
            onClick={() => router.push(href)}
            whileTap={{ scale: 0.88 }}
            className={`relative flex flex-col items-center justify-center gap-0.5 pb-1 text-[8.5px] font-semibold transition-colors ${
              active ? 'text-ink' : 'text-muted'
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                transition={{ type: 'spring', bounce: 0.22, duration: 0.5 }}
                className="absolute -top-[8px] h-[3px] w-5 rounded-full bg-accent shadow-pink-glow"
              />
            )}
            <Icon size={19} strokeWidth={active ? 2.2 : 1.6} className={active ? 'text-accent' : ''} />
            {label}
          </motion.button>
        );
      })}
    </nav>
  );
}

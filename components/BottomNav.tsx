'use client';
import { Grid3X3, Compass, Bookmark, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const tabs = [
  { href: '/',         label: 'Builder', icon: Grid3X3 },
  { href: '/discover',  label: 'Discover', icon: Compass },
  { href: '/saved',     label: 'Saved',   icon: Bookmark },
  { href: '/profile',  label: 'Profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  
  return (
    <nav className="h-[68px] bg-bg/95 backdrop-blur-md border-t border-hairline/50 grid grid-cols-4 safe-area-bottom">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <motion.button
            key={href}
            onClick={() => router.push(href)}
            className={`flex flex-col items-center justify-center gap-1.5 text-[10px] font-medium relative ${
              active ? 'text-ink' : 'text-muted'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {active && (
              <motion.div
                layoutId="active-tab"
                className="absolute top-1 w-5 h-0.5 rounded-full bg-accent"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <Icon size={20} strokeWidth={active ? 2 : 1.5} className={active ? 'text-accent' : ''} />
            <span className={active ? 'text-[10px] font-semibold' : 'text-[10px]'}>{label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
'use client';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Flame, Plus, Compass, User, type LucideIcon } from 'lucide-react';

const TABS: Array<{ href: string; label: string; icon: LucideIcon; raised?: boolean }> = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/swipe', label: 'Swipe', icon: Flame },
  { href: '/create', label: 'Create', icon: Plus, raised: true },
  { href: '/community', label: 'Feed', icon: Compass },
  { href: '/profile', label: 'You', icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FloatingTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-[440px] px-5 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto glass rounded-full shadow-nav border border-hairline flex items-center justify-between px-2.5 h-[62px]">
          {TABS.map(({ href, label, icon: Icon, raised }) => {
            const active = isActive(pathname, href);
            if (raised) {
              return (
                <motion.button
                  key={href}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => router.push(href)}
                  aria-label={label}
                  className="grid place-items-center w-[52px] h-[52px] rounded-full brand-gradient text-white glow-pink -mt-1"
                >
                  <Icon size={24} strokeWidth={2.4} />
                </motion.button>
              );
            }
            return (
              <motion.button
                key={href}
                whileTap={{ scale: 0.9 }}
                onClick={() => router.push(href)}
                className="relative flex flex-col items-center justify-center gap-1 w-[56px] h-full"
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} className={active ? 'text-ink' : 'text-muted'} />
                <span className={`text-[10px] font-medium ${active ? 'text-ink' : 'text-muted'}`}>{label}</span>
                {active && (
                  <motion.div
                    layoutId="tab-dot"
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
                    transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

'use client';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

export function AIStylistCard({
  title,
  subtitle,
  icon,
  tone = '#f1ece4',
  onClick,
  size = 'lg',
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone?: string;
  onClick?: () => void;
  size?: 'lg' | 'sm';
}) {
  const big = size === 'lg';
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative shrink-0 text-left overflow-hidden rounded-3xl border border-hairline ${
        big ? 'w-[230px] h-[150px] p-4' : 'w-full h-[112px] p-4'
      }`}
      style={{ background: tone }}
    >
      <div
        className="absolute -right-6 -top-8 w-32 h-32 rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.8), transparent 70%)' }}
      />
      <div className="relative flex flex-col h-full justify-between">
        <div className="grid place-items-center w-10 h-10 rounded-2xl bg-ink text-cream">{icon}</div>
        <div>
          <div className="font-display text-lg text-ink leading-tight">{title}</div>
          <div className="text-[12px] text-ink-soft mt-0.5 line-clamp-2">{subtitle}</div>
        </div>
      </div>
      <ArrowUpRight size={18} className="absolute top-4 right-4 text-ink-soft" />
    </motion.button>
  );
}

'use client';
import { motion } from 'framer-motion';
import { User, Venus, Mars, Gem } from 'lucide-react';
import { useProfile } from '@/store/profile';
import type { Gender } from '@/lib/types';

const GENDER_OPTIONS: { value: Gender; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { value: 'masc', label: 'Men', icon: Mars },
  { value: 'fem', label: 'Women', icon: Venus },
  { value: 'unisex', label: 'Unisex', icon: Gem },
];

export function GenderSelector() {
  const gender = useProfile((state) => state.profile.gender || 'unisex');
  const setGender = useProfile((state) => state.setGender);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 p-1 rounded-xl bg-surface-2 border border-hairline"
    >
      {GENDER_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = gender === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setGender(option.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? 'bg-accent text-white'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Icon size={14} />
            <span>{option.label}</span>
          </button>
        );
      })}
    </motion.div>
  );
}
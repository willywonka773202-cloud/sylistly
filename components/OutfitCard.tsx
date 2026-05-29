'use client';
import { motion } from 'framer-motion';
import { Heart, Lock, Users } from 'lucide-react';
import type { Outfit } from '@/lib/social-types';
import { OutfitCollage } from './OutfitCollage';
import { Avatar } from './Primitives';
import { getCreator } from '@/lib/data/creators';
import { occasionLabel, compactCount } from '@/lib/style';

export function OutfitCard({
  outfit,
  onClick,
  subtitle,
  showCreator,
  showLikes,
  aspect = 'aspect-[3/4]',
  className = '',
}: {
  outfit: Outfit;
  onClick?: () => void;
  subtitle?: string;
  showCreator?: boolean;
  showLikes?: boolean;
  aspect?: string;
  className?: string;
}) {
  const creator = showCreator ? getCreator(outfit.ownerId) : undefined;
  const meta = subtitle ?? (outfit.occasion ? occasionLabel(outfit.occasion) : creator ? `@${creator.handle}` : outfit.title);

  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} className={`block text-left ${className}`}>
      <div className="relative">
        <OutfitCollage outfit={outfit} className={`w-full ${aspect}`} rounded="rounded-2xl" />
        {showLikes && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 h-7 rounded-full glass-card text-[11px] font-semibold text-ink">
            <Heart size={12} className="fill-accent text-accent" />
            {compactCount(outfit.likes)}
          </div>
        )}
        {outfit.visibility === 'private' && (
          <div className="absolute top-2 left-2 grid place-items-center w-7 h-7 rounded-full glass-card text-ink-soft">
            <Lock size={12} />
          </div>
        )}
        {outfit.visibility === 'friends' && (
          <div className="absolute top-2 left-2 grid place-items-center w-7 h-7 rounded-full glass-card text-ink-soft">
            <Users size={12} />
          </div>
        )}
      </div>
      <div className="pt-2 flex items-center gap-2">
        {creator && <Avatar name={creator.name} color={creator.avatarColor} size={20} />}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink line-clamp-1">{outfit.title}</div>
          <div className="text-[11px] text-muted line-clamp-1">{meta}</div>
        </div>
      </div>
    </motion.button>
  );
}

'use client';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { ClosetItem } from '@/lib/social-types';
import { ItemImage } from './ItemImage';
import { centsToUsd } from '@/lib/style';

export function ClothingCard({
  item,
  onClick,
  onToggleFavorite,
  favorite,
  className = '',
  imageClassName = 'aspect-[4/5]',
}: {
  item: ClosetItem;
  onClick?: () => void;
  onToggleFavorite?: () => void;
  favorite?: boolean;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <motion.div whileTap={{ scale: 0.97 }} className={`w-full text-left ${className}`}>
      <button onClick={onClick} className="block w-full text-left">
        <div className={`relative rounded-2xl border border-hairline overflow-hidden ${imageClassName}`}>
          <div className="absolute inset-0 collage-paper" />
          <ItemImage item={item} className="absolute inset-0 w-full h-full object-contain p-4 select-none" />
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-full glass-card"
              aria-label="Favorite"
            >
              <Heart size={15} className={favorite ? 'fill-accent text-accent' : 'text-ink-soft'} />
            </button>
          )}
        </div>
      </button>
      <div className="px-0.5 pt-2">
        <div className="text-[13px] font-semibold text-ink line-clamp-1">{item.name}</div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted line-clamp-1">{item.brand}</span>
          {item.priceCents ? <span className="text-xs text-ink-soft font-medium shrink-0">{centsToUsd(item.priceCents)}</span> : null}
        </div>
      </div>
    </motion.div>
  );
}

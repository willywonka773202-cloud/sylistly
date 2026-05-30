'use client';
import { useState, type CSSProperties } from 'react';
import type { ClosetItem } from '@/lib/social-types';
import { itemArt } from '@/lib/garment-art';

/**
 * Smart clothing image: renders the real product photo when available, and falls
 * back to the procedural garment-art SVG if the photo is missing or fails to load
 * (real catalog URLs are gstatic thumbnails that can expire). This keeps the app
 * showing real clothing while guaranteeing nothing ever renders as a broken image.
 */
export function ItemImage({
  item,
  className = '',
  style,
  draggable = false,
}: {
  item: Pick<ClosetItem, 'imageUrl' | 'shape' | 'color' | 'category' | 'name'>;
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
}) {
  const [src, setSrc] = useState(item.imageUrl || itemArt(item));
  const isPhoto = !!item.imageUrl && src === item.imageUrl;
  return (
    <img
      src={src}
      alt={item.name}
      draggable={draggable}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
      style={{ ...(isPhoto ? { filter: 'drop-shadow(0 10px 16px rgba(22,20,15,.22))' } : null), ...style }}
      onError={() => {
        const art = itemArt(item);
        if (src !== art) setSrc(art);
      }}
    />
  );
}

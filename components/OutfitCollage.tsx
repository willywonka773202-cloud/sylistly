'use client';
import { useMemo } from 'react';
import type { Outfit } from '@/lib/social-types';
import { canvasBackgroundCss, backgroundIsDark } from '@/lib/social-types';
import { BASE_FRACTION } from '@/lib/outfit-layout';
import { resolveItem } from '@/lib/item-registry';
import { itemArt } from '@/lib/garment-art';

type CollageOutfit = Pick<Outfit, 'layout' | 'background' | 'itemIds'>;

/**
 * Renders an outfit's layout as positioned garment art on a paper canvas.
 * Positions are fractions of the container, so it scales to any size and is
 * identical on server and client. Used in cards, swipe, stories, post detail.
 */
export function OutfitCollage({
  outfit,
  className = '',
  rounded = 'rounded-3xl',
  interactive = false,
  onItemClick,
  selectedItemId,
}: {
  outfit: CollageOutfit;
  className?: string;
  rounded?: string;
  interactive?: boolean;
  onItemClick?: (itemId: string) => void;
  selectedItemId?: string | null;
}) {
  const dark = backgroundIsDark(outfit.background);
  const placed = useMemo(() => {
    const layout = outfit.layout?.length
      ? outfit.layout
      : outfit.itemIds.map((id, i) => ({ itemId: id, key: id, x: 0.5, y: 0.18 + i * 0.2, scale: 1, rotation: 0, z: i, flip: false }));
    return [...layout]
      .map((l) => ({ l, item: resolveItem(l.itemId) }))
      .filter((x) => x.item)
      .sort((a, b) => a.l.z - b.l.z);
  }, [outfit.layout, outfit.itemIds]);

  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ background: canvasBackgroundCss(outfit.background) }}
    >
      {/* subtle vignette for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: dark
            ? 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.06), transparent 60%)'
            : 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.5), transparent 55%)',
        }}
      />
      {placed.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-muted text-xs">Empty look</div>
      )}
      {placed.map(({ l, item }) => {
        const widthPct = BASE_FRACTION * l.scale * 100;
        const isSelected = interactive && selectedItemId === l.itemId;
        const Wrapper = interactive ? 'button' : 'div';
        return (
          <Wrapper
            key={l.key ?? l.itemId}
            onClick={interactive ? () => onItemClick?.(l.itemId) : undefined}
            className={`absolute ${interactive ? 'cursor-pointer' : ''}`}
            style={{
              left: `${l.x * 100}%`,
              top: `${l.y * 100}%`,
              width: `${widthPct}%`,
              zIndex: l.z,
              transform: `translate(-50%, -50%) rotate(${l.rotation}deg) scale(${l.flip ? -1 : 1}, 1)`,
            }}
          >
            <img
              src={itemArt(item!)}
              alt={item!.name}
              draggable={false}
              className="w-full h-auto select-none"
              style={{ outline: isSelected ? '2px solid #c2554e' : 'none', borderRadius: 12 }}
            />
          </Wrapper>
        );
      })}
    </div>
  );
}

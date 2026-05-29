'use client';
import { useEffect, useRef } from 'react';
import { RotateCw, Move, X, Copy } from 'lucide-react';
import type { OutfitLayoutItem } from '@/lib/social-types';
import { canvasBackgroundCss, backgroundIsDark } from '@/lib/social-types';
import { BASE_FRACTION } from '@/lib/outfit-layout';
import { resolveItem } from '@/lib/item-registry';
import { itemArt } from '@/lib/garment-art';

type Mode = 'move' | 'resize' | 'rotate';

interface Gesture {
  mode: Mode;
  id: string;
  rect: DOMRect;
  startX: number;
  startY: number;
  startItem: OutfitLayoutItem;
  centerPxX: number;
  centerPxY: number;
  centerAbsX: number;
  centerAbsY: number;
  startDist: number;
  startAngle: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const uid = (l: OutfitLayoutItem) => l.key ?? l.itemId;

export function OutfitCanvas({
  layout,
  background,
  selectedId,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
  className = '',
}: {
  layout: OutfitLayoutItem[];
  background: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (layout: OutfitLayoutItem[]) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dark = backgroundIsDark(background);

  useEffect(() => {
    function patch(id: string, p: Partial<OutfitLayoutItem>) {
      onChange(layoutRef.current.map((l) => (uid(l) === id ? { ...l, ...p } : l)));
    }
    function onMove(e: PointerEvent) {
      const g = gesture.current;
      if (!g) return;
      e.preventDefault();
      if (g.mode === 'move') {
        const nx = (g.centerPxX + (e.clientX - g.startX)) / g.rect.width;
        const ny = (g.centerPxY + (e.clientY - g.startY)) / g.rect.height;
        patch(g.id, { x: clamp(nx, 0.05, 0.95), y: clamp(ny, 0.05, 0.95) });
      } else if (g.mode === 'resize') {
        const dist = Math.hypot(e.clientX - g.centerAbsX, e.clientY - g.centerAbsY);
        patch(g.id, { scale: clamp((g.startItem.scale * dist) / (g.startDist || 1), 0.3, 3) });
      } else if (g.mode === 'rotate') {
        const ang = Math.atan2(e.clientY - g.centerAbsY, e.clientX - g.centerAbsX);
        patch(g.id, { rotation: Math.round(g.startItem.rotation + ((ang - g.startAngle) * 180) / Math.PI) });
      }
    }
    function onUp() {
      gesture.current = null;
    }
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [onChange]);

  function begin(e: React.PointerEvent, id: string, mode: Mode) {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    const item = layoutRef.current.find((l) => uid(l) === id);
    if (!rect || !item) return;
    onSelect(id);
    const centerPxX = item.x * rect.width;
    const centerPxY = item.y * rect.height;
    const centerAbsX = rect.left + centerPxX;
    const centerAbsY = rect.top + centerPxY;
    gesture.current = {
      mode,
      id,
      rect,
      startX: e.clientX,
      startY: e.clientY,
      startItem: item,
      centerPxX,
      centerPxY,
      centerAbsX,
      centerAbsY,
      startDist: Math.hypot(e.clientX - centerAbsX, e.clientY - centerAbsY),
      startAngle: Math.atan2(e.clientY - centerAbsY, e.clientX - centerAbsX),
    };
  }

  const ordered = [...layout].sort((a, b) => a.z - b.z);

  return (
    <div
      ref={canvasRef}
      onPointerDown={(e) => {
        if (e.target === canvasRef.current) onSelect(null);
      }}
      className={`relative overflow-hidden touch-none select-none ${className}`}
      style={{ background: canvasBackgroundCss(background) }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: dark
            ? 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.06), transparent 60%)'
            : 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.5), transparent 55%)',
        }}
      />
      {ordered.map((l) => {
        const item = resolveItem(l.itemId);
        if (!item) return null;
        const id = uid(l);
        const selected = selectedId === id;
        return (
          <div
            key={id}
            onPointerDown={(e) => begin(e, id, 'move')}
            className="absolute touch-none"
            style={{
              left: `${l.x * 100}%`,
              top: `${l.y * 100}%`,
              width: `${BASE_FRACTION * l.scale * 100}%`,
              aspectRatio: '200 / 240',
              transform: `translate(-50%, -50%) rotate(${l.rotation}deg) scaleX(${l.flip ? -1 : 1})`,
              zIndex: selected ? 999 : l.z,
            }}
          >
            <img src={itemArt(item)} alt={item.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />
            {selected && (
              <>
                <div className="absolute inset-0 border-[1.5px] border-accent/70 rounded-lg pointer-events-none" />
                {/* rotate */}
                <button
                  onPointerDown={(e) => begin(e, id, 'rotate')}
                  className="absolute left-1/2 -top-9 -translate-x-1/2 grid place-items-center w-7 h-7 rounded-full bg-ink text-cream shadow-card touch-none"
                  aria-label="Rotate"
                >
                  <RotateCw size={14} />
                </button>
                {/* resize */}
                <button
                  onPointerDown={(e) => begin(e, id, 'resize')}
                  className="absolute -bottom-3 -right-3 grid place-items-center w-7 h-7 rounded-full bg-ink text-cream shadow-card touch-none"
                  aria-label="Resize"
                >
                  <Move size={13} />
                </button>
                {/* delete */}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onDelete(id)}
                  className="absolute -top-3 -left-3 grid place-items-center w-7 h-7 rounded-full bg-accent text-white shadow-card"
                  aria-label="Delete"
                >
                  <X size={14} />
                </button>
                {/* duplicate */}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onDuplicate(id)}
                  className="absolute -top-3 -right-3 grid place-items-center w-7 h-7 rounded-full bg-surface-1 border border-hairline-2 text-ink shadow-card"
                  aria-label="Duplicate"
                >
                  <Copy size={13} />
                </button>
              </>
            )}
          </div>
        );
      })}

      {layout.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-center px-8 pointer-events-none">
          <div>
            <div className="font-display text-xl text-ink-soft">Your canvas is empty</div>
            <div className="text-sm text-muted mt-1">Add pieces from your closet to start building.</div>
          </div>
        </div>
      )}
    </div>
  );
}

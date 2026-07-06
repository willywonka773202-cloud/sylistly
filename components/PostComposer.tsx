'use client';

import { Check, ImageOff, Sparkles, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { ProductImage } from '@/components/ProductImage';
import { track } from '@/lib/analytics';
import { isTransparentRenderableProduct } from '@/lib/product-image-quality';
import type { Category, Product } from '@/lib/types';
import { useDialogBehavior } from '@/lib/use-dialog-behavior';
import { usePosts, type PostPiecePlacement } from '@/store/posts';
import type { SavedFitRecord } from '@/store/saved-fits';

// Default collage placement per slot (centre-anchored %, before the user drags).
// Loose editorial spread — hero pieces centre-column, accessories to the sides.
const DEFAULT_SPOT: Partial<Record<Category, { xPct: number; yPct: number }>> = {
  hat: { xPct: 50, yPct: 13 },
  eyewear: { xPct: 24, yPct: 17 },
  jewelry: { xPct: 78, yPct: 21 },
  outer: { xPct: 27, yPct: 40 },
  top: { xPct: 52, yPct: 34 },
  bottom: { xPct: 50, yPct: 64 },
  bag: { xPct: 78, yPct: 54 },
  shoes: { xPct: 50, yPct: 87 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function renderablePieces(items: Partial<Record<Category, Product>>): Array<{ slot: Category; product: Product }> {
  return (Object.entries(items) as Array<[Category, Product | undefined]>)
    .filter((entry): entry is [Category, Product] => Boolean(entry[1] && isTransparentRenderableProduct(entry[1])))
    .map(([slot, product]) => ({ slot, product }));
}

function defaultLayout(pieces: Array<{ slot: Category; product: Product }>): Record<string, PostPiecePlacement> {
  const layout: Record<string, PostPiecePlacement> = {};
  pieces.forEach(({ slot, product }, i) => {
    const spot = DEFAULT_SPOT[slot] || { xPct: 50, yPct: 18 + i * 12 };
    layout[product.id] = { xPct: spot.xPct, yPct: spot.yPct, scale: 1, z: i + 1 };
  });
  return layout;
}

/**
 * Studio — compose an outfit post: arrange your fit's pieces on a 4:5 canvas by
 * dragging, add a caption, and post it to your profile grid. Local-only (this
 * device) for now; the OutfitPost it writes is backend-ready for a future
 * publish. HONEST: no fake likes/comments — real cross-user social needs accounts.
 */
export function PostComposer({
  open,
  fits,
  initialFit,
  onClose,
  onPosted,
}: {
  open: boolean;
  fits: SavedFitRecord[];
  initialFit?: SavedFitRecord | null;
  onClose: () => void;
  onPosted?: (postId: string) => void;
}) {
  const addPost = usePosts((state) => state.addPost);
  const [fit, setFit] = useState<SavedFitRecord | null>(initialFit ?? null);
  const [layout, setLayout] = useState<Record<string, PostPiecePlacement>>({});
  const [caption, setCaption] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const topZ = useRef(0);
  const dialogRef = useDialogBehavior<HTMLDivElement>(onClose, open);

  const pieces = useMemo(() => (fit ? renderablePieces(fit.items) : []), [fit]);

  // Choose a fit → seed its default collage layout.
  function chooseFit(next: SavedFitRecord) {
    const nextPieces = renderablePieces(next.items);
    setFit(next);
    setLayout(defaultLayout(nextPieces));
    topZ.current = nextPieces.length;
    setCaption('');
  }

  function startDrag(event: React.PointerEvent, productId: string) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDragging(productId);
    // Bring the dragged piece to the front.
    topZ.current += 1;
    const z = topZ.current;
    setLayout((prev) => ({ ...prev, [productId]: { ...prev[productId], z } }));

    const move = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const xPct = clamp(((ev.clientX - rect.left) / rect.width) * 100, 5, 95);
      const yPct = clamp(((ev.clientY - rect.top) / rect.height) * 100, 6, 94);
      setLayout((prev) => ({ ...prev, [productId]: { ...prev[productId], xPct, yPct } }));
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setDragging(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function post() {
    if (!fit || !pieces.length) return;
    const created = addPost({
      caption: caption.trim(),
      sourceFitId: fit.id,
      vibe: fit.vibe,
      items: fit.items,
      layout,
    });
    track('post_created', { pieces: pieces.length, hasCaption: caption.trim().length > 0, vibe: fit.vibe });
    setPosted(true);
    window.setTimeout(() => {
      setPosted(false);
      onPosted?.(created.id);
      onClose();
    }, 720);
  }

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Compose an outfit post"
      className="fixed inset-0 z-[120] flex flex-col bg-[rgba(8,7,9,.86)] backdrop-blur-xl sy-fade-in"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sy-press grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-surface-2 text-muted-2"
        >
          <X size={17} />
        </button>
        <p className="inline-flex items-center gap-1.5 text-eyebrow font-extrabold uppercase text-champagne">
          <Sparkles size={12} /> Studio
        </p>
        <button
          type="button"
          onClick={post}
          disabled={!fit || !pieces.length || posted}
          className="sy-press inline-flex h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-4 text-[12px] font-bold text-white shadow-pink-glow disabled:opacity-40"
        >
          {posted ? <Check size={14} /> : null}
          {posted ? 'Posted' : 'Post'}
        </button>
      </div>

      {!fit ? (
        // ── Fit picker ──────────────────────────────────────────────────────
        <div className="flex-1 overflow-y-auto px-5 pb-10">
          <h2 className="mt-3 font-serif text-[24px] font-semibold italic text-ink">Pick a fit to post</h2>
          <p className="mt-1 text-[13px] text-muted-2">Choose a saved look — you&apos;ll arrange it next.</p>
          {fits.length ? (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {fits.map((saved) => {
                const count = renderablePieces(saved.items).length;
                if (count < 2) return null;
                return (
                  <button
                    key={saved.id}
                    type="button"
                    onClick={() => chooseFit(saved)}
                    className="sy-press overflow-hidden rounded-card border border-hairline bg-surface-1 text-left"
                  >
                    <div className="relative aspect-[4/5] bg-[radial-gradient(120%_90%_at_50%_8%,rgba(231,199,155,.12),transparent_60%)]">
                      {renderablePieces(saved.items).slice(0, 4).map(({ product }, i) => (
                        <div
                          key={product.id}
                          className="absolute h-1/2 w-1/2"
                          style={{ left: `${[6, 48, 12, 44][i] ?? 28}%`, top: `${[8, 14, 50, 52][i] ?? 30}%` }}
                        >
                          <ProductImage product={product} transparentOnly displayMode="cutout" className="h-full w-full object-contain" />
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2">
                      <p className="truncate text-[12px] font-semibold text-ink">{saved.title}</p>
                      <p className="text-[11px] text-muted">{count} pieces</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-8 grid place-items-center rounded-card border border-dashed border-hairline-2 bg-surface-1 px-6 py-12 text-center">
              <ImageOff size={20} className="text-muted" />
              <p className="mt-2 text-[13px] font-semibold text-muted-2">No saved fits yet</p>
              <p className="mt-1 max-w-[26ch] text-[12px] text-muted">
                Save looks from the scroll or build one in Remix, then come back to post it.
              </p>
            </div>
          )}
        </div>
      ) : (
        // ── Canvas + caption ────────────────────────────────────────────────
        <div className="flex flex-1 flex-col overflow-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+14px)]">
          <p className="mb-2 text-center text-[11px] font-semibold text-muted">Drag each piece to arrange your post</p>
          <div
            ref={canvasRef}
            className="relative mx-auto w-full max-w-[360px] flex-1 touch-none select-none overflow-hidden rounded-[24px] border border-hairline bg-[radial-gradient(130%_100%_at_50%_0%,rgba(231,199,155,.10),transparent_55%),linear-gradient(180deg,rgba(20,19,22,.9),rgba(12,11,13,.92))] shadow-[0_30px_70px_-30px_rgba(0,0,0,.7)]"
            style={{ aspectRatio: '4 / 5' }}
          >
            {pieces.map(({ product }) => {
              const place = layout[product.id] || { xPct: 50, yPct: 50, scale: 1, z: 1 };
              const isDragging = dragging === product.id;
              return (
                <div
                  key={product.id}
                  onPointerDown={(event) => startDrag(event, product.id)}
                  className="absolute h-[42%] w-[42%] cursor-grab touch-none active:cursor-grabbing"
                  style={{
                    left: `${place.xPct}%`,
                    top: `${place.yPct}%`,
                    zIndex: place.z,
                    transform: `translate(-50%, -50%) scale(${isDragging ? 1.06 : 1})`,
                    transition: isDragging ? 'none' : 'transform .18s ease',
                    filter: isDragging ? 'drop-shadow(0 18px 26px rgba(0,0,0,.55))' : 'drop-shadow(0 10px 16px rgba(0,0,0,.4))',
                  }}
                >
                  <ProductImage product={product} transparentOnly displayMode="cutout" loading="eager" className="pointer-events-none h-full w-full object-contain" />
                </div>
              );
            })}
          </div>

          <div className="mx-auto mt-3 w-full max-w-[360px]">
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value.slice(0, 180))}
              placeholder="Write a caption…"
              rows={2}
              className="w-full resize-none rounded-card border border-hairline bg-surface-1 px-3.5 py-2.5 text-[15px] leading-snug text-ink outline-none placeholder:text-muted/60 focus:border-accent/50"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
              <button type="button" onClick={() => setFit(null)} className="sy-press font-semibold text-accent">
                ← Change fit
              </button>
              <span>{caption.length}/180</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

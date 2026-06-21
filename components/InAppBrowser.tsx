'use client';

import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { ArrowUpRight, Globe, Lock, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProductImage } from '@/components/ProductImage';
import { wrapAffiliate } from '@/lib/affiliate';
import { track } from '@/lib/analytics';
import { hasExactProductLink } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import { hasDirectRetailerUrl } from '@/lib/retailer-url';
import type { Product } from '@/lib/types';
import { useDialogBehavior } from '@/lib/use-dialog-behavior';

/**
 * In-app browser sheet — tap a piece's Shop action and the retailer page slides
 * up in a partial (≈90vh), drag-to-dismiss sheet INSTEAD of taking over the
 * whole screen / a new tab.
 *
 * Honest about the web's limits: many retailers block being embedded
 * (X-Frame-Options / CSP frame-ancestors), which we can't detect cross-origin.
 * So we (a) load the RAW retailer URL in the iframe (best framing odds, no
 * affiliate redirect chain to break), (b) keep a persistent "Open full page"
 * that uses the AFFILIATE-WRAPPED url so the real purchase click still credits
 * commission, and (c) after a timeout with no load, fall back to a rich product
 * preview + Open button so the user is never stuck on a blank "refused" frame.
 *
 * Drag-to-dismiss works from the chrome only: the cross-origin iframe swallows
 * pointer events over its own area (so scrolling the store never dismisses), and
 * framer's drag only fires for gestures on the header.
 */

const LOAD_TIMEOUT_MS = 6000;

function merchantName(product: Product): string {
  if (product.retailer) return product.retailer;
  try {
    return new URL(getProductOutboundUrl(product)).hostname.replace(/^www\./, '');
  } catch {
    return 'the retailer';
  }
}

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function InAppBrowser({ product, onClose }: { product: Product; onClose: () => void }) {
  const reduce = useReducedMotion();
  const rawUrl = getProductOutboundUrl(product);
  const shopUrl = wrapAffiliate(rawUrl); // commission-safe outbound for "Open full page"
  const retailer = merchantName(product);
  const exact = hasExactProductLink(product);
  // Only attempt to embed a REAL retailer page. A Google-Shopping fallback (no
  // direct link) always refuses framing, so skip straight to the preview.
  const direct = !!rawUrl && hasDirectRetailerUrl(rawUrl);

  const [phase, setPhase] = useState<'loading' | 'loaded' | 'blocked'>(direct ? 'loading' : 'blocked');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    track('shop_preview_opened', { brand: product.brand, retailer: product.retailer, direct, surface: 'in-app-browser' });
    if (!direct) return;
    // No load event within the window → assume the retailer refuses framing.
    timer.current = window.setTimeout(() => {
      setPhase((p) => (p === 'loading' ? 'blocked' : p));
    }, LOAD_TIMEOUT_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [product, direct]);

  const onFrameLoad = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setPhase((p) => (p === 'blocked' ? p : 'loaded'));
  }, []);

  const onOutbound = useCallback(() => {
    track('shop_link_clicked', {
      brand: product.brand,
      retailer: product.retailer,
      priceCents: product.priceCents,
      exact,
      wrapped: shopUrl !== rawUrl,
      surface: 'in-app-browser',
    });
  }, [product, exact, shopUrl, rawUrl]);

  const onDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      if (info.offset.y > 130 || info.velocity.y > 600) onClose();
    },
    [onClose],
  );

  const noLink = !rawUrl;
  const dialogRef = useDialogBehavior<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-[90] mx-auto flex max-w-[480px] flex-col justify-end">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${retailer} — ${product.name}`}
        tabIndex={-1}
        className="sy-sheet-enter relative z-10 flex h-[90%] w-full flex-col overflow-hidden rounded-t-sheet border border-hairline-2 bg-surface-1 shadow-float outline-none"
        drag={reduce ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        {/* Chrome — the only draggable region (the iframe eats its own pointers) */}
        <div className="shrink-0 cursor-grab active:cursor-grabbing">
          <div className="mx-auto mt-2 mb-1.5 h-1 w-11 rounded-full bg-hairline-2" />
          <div className="flex items-center gap-2 px-3 pb-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline-2 bg-surface-2 text-champagne">
              <Lock size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink">{product.brand}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-muted">
                <Globe size={10} />
                {retailer}
              </p>
            </div>
            <a
              href={shopUrl}
              target="_blank"
              rel="noreferrer sponsored"
              onClick={onOutbound}
              className="sy-press inline-flex shrink-0 items-center gap-1 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-3 py-2 text-[12px] font-bold text-white shadow-pink-glow"
            >
              Open
              <ArrowUpRight size={14} />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="sy-press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline-2 bg-surface-2 text-muted"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* The page (or the fallback) */}
        <div className="relative flex-1 bg-white">
          {!noLink && phase !== 'blocked' ? (
            <iframe
              src={rawUrl}
              title={`${product.brand} at ${retailer}`}
              onLoad={onFrameLoad}
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              className="h-full w-full border-0"
            />
          ) : null}

          {/* Loading veil */}
          {!noLink && phase === 'loading' ? (
            <div className="absolute inset-0 grid place-items-center bg-surface-1">
              <div className="flex flex-col items-center gap-3">
                <span className="h-9 w-9 animate-spin rounded-full border-2 border-hairline-2 border-t-accent" />
                <p className="text-[12px] font-semibold text-muted">Loading {retailer}…</p>
              </div>
            </div>
          ) : null}

          {/* Fallback — retailer refuses to embed (or no link). Never a blank frame. */}
          {noLink || phase === 'blocked' ? (
            <div className="absolute inset-0 grid place-items-center bg-surface-1 px-8 text-center">
              <div className="flex flex-col items-center">
                <span className="grid h-28 w-28 place-items-center overflow-hidden rounded-card bg-[linear-gradient(180deg,#FFFFFF,#FAF5EF)]">
                  <ProductImage
                    product={product}
                    transparentOnly
                    wrapperClassName="h-[92px] w-[92px]"
                    className="h-[92px] w-[92px] object-contain"
                  />
                </span>
                <p className="mt-4 text-eyebrow font-extrabold uppercase text-champagne">{product.brand}</p>
                <p className="mt-1 line-clamp-2 max-w-[28ch] text-[14px] font-semibold leading-tight text-ink">
                  {product.name}
                </p>
                <p className="mt-1.5 text-[15px] font-bold text-accent">{formatPrice(product.priceCents || 0)}</p>
                <p className="mt-3 max-w-[30ch] text-[12px] leading-relaxed text-muted">
                  {noLink
                    ? `No direct link yet — try searching ${retailer} for this piece.`
                    : direct
                      ? `${retailer} doesn’t allow previewing inside apps. Open the full page to shop it.`
                      : 'No direct store link for this piece yet — open a search to find it.'}
                </p>
                {!noLink ? (
                  <a
                    href={shopUrl}
                    target="_blank"
                    rel="noreferrer sponsored"
                    onClick={onOutbound}
                    className="sy-press mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF2D6D,#FF5C8A)] px-5 py-3.5 text-[14px] font-bold text-white shadow-pink-glow"
                  >
                    {direct ? `Open full page at ${retailer}` : 'Open search'}
                    <ArrowUpRight size={15} />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

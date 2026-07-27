'use client';

import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { ProductImage } from '@/components/ProductImage';
import type { Product } from '@/lib/types';

interface TasteMapAxisProps {
  position: number;
  leftProduct?: Product | null;
  rightProduct?: Product | null;
  label: string;
  compact?: boolean;
}

/**
 * A real, product-backed taste axis. The two edge previews are garments from
 * neighbouring looks in the live deck, so the "minimal / daring" branches are
 * honest navigation cues rather than decorative concept art.
 */
export function TasteMapAxis({
  position,
  leftProduct,
  rightProduct,
  label,
  compact = false,
}: TasteMapAxisProps) {
  const reduce = useReducedMotion();
  const clamped = Math.max(8, Math.min(92, position));

  if (compact) {
    return (
      <div className="sy-taste-axis sy-taste-axis-compact">
        <div className="flex items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-[.12em] text-muted-2">
          <span className="inline-flex items-center gap-1"><ArrowLeft size={9} /> Minimal</span>
          <span className="inline-flex items-center gap-1 text-accent"><Sparkles size={10} /> {label}</span>
          <span className="inline-flex items-center gap-1">Daring <ArrowRight size={9} /></span>
        </div>
        <div className="relative mt-1.5 h-7">
          <div className="absolute inset-x-5 top-3 h-px bg-[linear-gradient(90deg,rgba(231,199,155,.2),rgba(255,45,109,.7),rgba(231,199,155,.2))]" />
          {leftProduct ? (
            <motion.span aria-hidden className="absolute left-0 top-0 grid h-6 w-6 place-items-center rounded-full border border-hairline-2 bg-surface-2 p-0.5" animate={reduce ? undefined : { y: [0, -1.5, 0] }} transition={{ duration: 3.8, repeat: Infinity }}>
              <ProductImage product={leftProduct} transparentOnly wrapperClassName="h-full w-full" className="h-full w-full object-contain" />
            </motion.span>
          ) : null}
          {rightProduct ? (
            <motion.span aria-hidden className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-full border border-hairline-2 bg-surface-2 p-0.5" animate={reduce ? undefined : { y: [0, 1.5, 0] }} transition={{ duration: 4.2, repeat: Infinity }}>
              <ProductImage product={rightProduct} transparentOnly wrapperClassName="h-full w-full" className="h-full w-full object-contain" />
            </motion.span>
          ) : null}
          <motion.span
            aria-hidden
            className="absolute top-[7px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-accent bg-accent shadow-[0_0_0_4px_rgba(255,45,109,.13),0_0_16px_rgba(255,45,109,.72)]"
            style={{ left: `${clamped}%` }}
            animate={reduce ? undefined : { scale: [1, 1.16, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`sy-taste-axis ${compact ? 'sy-taste-axis-compact' : ''}`}>
      <div className="flex items-center justify-center gap-2 text-[9px] font-extrabold uppercase tracking-[.24em] text-accent">
        <Sparkles size={11} />
        Taste map
      </div>

      <div className="mt-2 flex items-end justify-between text-[10px] font-semibold text-muted-2">
        <span className="inline-flex items-center gap-1"><ArrowLeft size={10} /> More minimal</span>
        <span className="text-champagne">{label}</span>
        <span className="inline-flex items-center gap-1">More daring <ArrowRight size={10} /></span>
      </div>

      <div className="relative mt-2 h-10">
        <div className="absolute inset-x-7 top-4 h-px bg-[linear-gradient(90deg,rgba(231,199,155,.18),rgba(255,45,109,.65),rgba(231,199,155,.18))]" />
        <span className="absolute left-7 top-[13px] h-2 w-2 rounded-full border border-champagne/70 bg-bg shadow-[0_0_12px_rgba(231,199,155,.35)]" />
        <span className="absolute right-7 top-[13px] h-2 w-2 rounded-full border border-champagne/70 bg-bg shadow-[0_0_12px_rgba(231,199,155,.35)]" />

        {leftProduct ? (
          <motion.span
            aria-hidden
            className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-surface-2/85 p-1 backdrop-blur-md"
            animate={reduce ? undefined : { y: [0, -2, 0], rotate: [0, -2, 0] }}
            transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ProductImage product={leftProduct} transparentOnly wrapperClassName="h-full w-full" className="h-full w-full object-contain" />
          </motion.span>
        ) : null}

        {rightProduct ? (
          <motion.span
            aria-hidden
            className="absolute right-0 top-0 grid h-9 w-9 place-items-center rounded-full border border-hairline-2 bg-surface-2/85 p-1 backdrop-blur-md"
            animate={reduce ? undefined : { y: [0, 2, 0], rotate: [0, 2, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ProductImage product={rightProduct} transparentOnly wrapperClassName="h-full w-full" className="h-full w-full object-contain" />
          </motion.span>
        ) : null}

        <motion.span
          aria-hidden
          className="absolute top-[9px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-accent bg-accent shadow-[0_0_0_5px_rgba(255,45,109,.13),0_0_20px_rgba(255,45,109,.72)]"
          style={{ left: `${clamped}%` }}
          animate={reduce ? undefined : { scale: [1, 1.16, 1], boxShadow: ['0 0 0 4px rgba(255,45,109,.1)', '0 0 0 9px rgba(255,45,109,0)', '0 0 0 4px rgba(255,45,109,.1)'] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

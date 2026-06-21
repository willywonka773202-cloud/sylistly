'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Lock, Sparkles, X } from 'lucide-react';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category, type Product } from '@/lib/types';

/**
 * Inline budget tracker for the Remix board.
 *
 * Shows: outfit total, budget input, over/under progress, per-slot price
 * chips that jump straight to that slot's swap sheet, and an "Only show
 * picks within budget" toggle that re-wires the price gate for the next
 * generate. All state is local + persisted via `lib/remix-budget-storage`.
 *
 * This is the real-repo port of the prototype's BudgetPanel (per the
 * 2026-06-08 prototype HANDOFF and the "extract then archive" plan in
 * 2026-06-10's Rebuild Strategy). Styled with the Editorial Noir tokens
 * (`bg-bg`, `border-hairline`, `text-accent`, `shadow-pink-glow`) to
 * match the current Remix surface, not the prototype's cream/black
 * demo styling.
 */
export function BudgetPanel({
  totalCents,
  budget,
  onBudgetChange,
  filterOn,
  onToggleFilter,
  items,
  onJumpSlot,
  itemCount,
  loading,
}: {
  totalCents: number;
  budget: number;
  onBudgetChange: (value: number) => void;
  filterOn: boolean;
  onToggleFilter: (value: boolean) => void;
  items: Partial<Record<Category, Product>>;
  onJumpSlot: (slot: Category) => void;
  itemCount: number;
  loading?: boolean;
}) {
  // Local input string so users can clear the field without immediately
  // persisting `0`. The parent is the source of truth for the parsed value.
  const [budgetInput, setBudgetInput] = useState(budget > 0 ? String(budget) : '');

  useEffect(() => {
    setBudgetInput(budget > 0 ? String(budget) : '');
  }, [budget]);

  const commitBudget = useCallback(
    (raw: string) => {
      const digits = raw.replace(/[^\d]/g, '').slice(0, 5);
      const parsed = Number(digits);
      onBudgetChange(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    },
    [onBudgetChange],
  );

  const totalDollars = totalCents / 100;
  const budgetCents = budget * 100;
  const hasBudget = budget > 0;
  const over = hasBudget && totalCents > budgetCents;
  const pct = hasBudget && budgetCents > 0 ? Math.min(100, Math.round((totalCents / budgetCents) * 100)) : 0;
  const diffDollars = hasBudget ? Math.abs(totalCents - budgetCents) / 100 : 0;
  const statusLabel = !hasBudget
    ? 'No budget set'
    : over
      ? `$${diffDollars.toFixed(0)} over`
      : `$${diffDollars.toFixed(0)} left`;

  return (
    <section
      aria-label="Budget tracker"
      className="rounded-card border border-hairline bg-[linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.025))] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[.22em] text-accent">Budget</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              data-state={over ? 'over' : 'ok'}
              className="font-serif text-[20px] font-semibold leading-none text-ink data-[state=over]:text-accent"
            >
              <AnimatedNumber value={totalDollars} format={(n) => `$${n.toLocaleString('en-US')}`} durationMs={420} />
            </span>
            {hasBudget ? (
              <span className="text-[11px] text-muted-2">of ${budget}</span>
            ) : null}
          </div>
        </div>
        <label className="flex flex-none items-center gap-1.5 rounded-full border border-hairline-2 bg-surface-2 px-3 py-1.5 text-[11px] text-ink">
          <span aria-hidden className="text-muted">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={budgetInput}
            placeholder="Set"
            aria-label="Outfit budget in dollars"
            onChange={(event) => {
              const next = event.target.value.replace(/[^\d]/g, '').slice(0, 5);
              setBudgetInput(next);
              commitBudget(next);
            }}
            className="w-14 bg-transparent text-right text-[12px] font-semibold text-ink outline-none placeholder:text-muted"
          />
          {budgetInput ? (
            <button
              type="button"
              aria-label="Clear budget"
              onClick={() => {
                setBudgetInput('');
                onBudgetChange(0);
              }}
              className="grid h-5 w-5 place-items-center rounded-full text-muted transition hover:bg-white/[0.08] hover:text-ink"
            >
              <X size={11} />
            </button>
          ) : null}
        </label>
      </div>

      {hasBudget ? (
        <div className="mt-3" aria-live="polite">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              data-state={over ? 'over' : 'ok'}
              className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-300 data-[state=over]:bg-accent data-[state=over]:shadow-[0_0_18px_rgba(255,45,109,.6)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[.12em]">
            <span
              data-state={over ? 'over' : 'ok'}
              className="text-accent data-[state=over]:text-accent"
            >
              {statusLabel}
            </span>
            <span className="text-muted">
              {itemCount} {itemCount === 1 ? 'piece' : 'pieces'}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-2">
          Set a dollar cap to track your spend and filter swaps to what fits.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORY_ORDER.map((slot) => {
          const piece = items[slot];
          const slotDollars = (piece?.priceCents ?? 0) / 100;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onJumpSlot(slot)}
              disabled={loading}
              data-filled={piece ? 'yes' : 'no'}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline-2 bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] transition hover:border-accent/55 hover:text-ink disabled:opacity-50 data-[filled=yes]:text-ink data-[filled=no]:text-muted"
            >
              <span className="text-muted-2">{CATEGORY_LABELS[slot]}</span>
              <span aria-hidden className="h-1 w-1 rounded-full bg-hairline-2" />
              <span className="font-semibold">{piece ? `$${slotDollars.toFixed(0)}` : '—'}</span>
            </button>
          );
        })}
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[10.5px] font-semibold leading-none text-muted-2">
        <span
          data-on={filterOn ? 'yes' : 'no'}
          className="relative inline-flex h-4 w-7 flex-none items-center rounded-full bg-white/[0.08] transition data-[on=yes]:bg-accent data-[on=yes]:shadow-pink-glow"
        >
          <span
            data-on={filterOn ? 'yes' : 'no'}
            className="absolute left-0.5 grid h-3 w-3 place-items-center rounded-full bg-white text-transparent transition data-[on=yes]:translate-x-3 data-[on=yes]:bg-white data-[on=yes]:text-accent"
          >
            {filterOn ? <Check size={8} strokeWidth={3} /> : <X size={8} strokeWidth={3} className="text-muted" />}
          </span>
        </span>
        <input
          type="checkbox"
          className="sr-only"
          checked={filterOn}
          disabled={!hasBudget || loading}
          onChange={(event) => onToggleFilter(event.target.checked)}
        />
        <span className="inline-flex items-center gap-1.5">
          <Sparkles size={11} className="text-accent" />
          Only show picks within budget
        </span>
      </label>

      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
        <Lock size={10} className="text-muted-2" />
        Stored on this device · no account required
      </div>
    </section>
  );
}

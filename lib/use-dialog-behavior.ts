'use client';

import { useEffect, useRef } from 'react';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/**
 * Modal-dialog behavior for the slide-up sheets (PiecePeek, CheckoutSheet,
 * InAppBrowser, SearchSheet): Escape closes, focus moves into the sheet on open,
 * Tab is trapped inside it, and focus is restored to the trigger on close. Pair
 * the returned ref with `role="dialog" aria-modal="true" tabIndex={-1}` on the
 * sheet panel so keyboard and screen-reader users stay oriented. Mount/unmount
 * only — `onClose` is read through a ref so a changing identity never re-fires
 * the focus move.
 */
export function useDialogBehavior<T extends HTMLElement>(onClose: () => void, open = true) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // A modal freezes the page behind it — part of being a dialog, not extra.
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    if (panel) {
      const preferredFocus = panel.querySelector<HTMLElement>('[data-dialog-initial-focus]');
      const firstFocusable = panel.querySelector<HTMLElement>(FOCUSABLE);
      (preferredFocus ?? firstFocusable ?? panel).focus({ preventScroll: true });
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      // Contain Tab inside the sheet so focus never lands on the inert page
      // behind the backdrop (the honest meaning of aria-modal="true").
      if (event.key !== 'Tab' || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (active && !panel.contains(active)) {
        // Focus somehow escaped (e.g. opened mid-tab) — pull it back in.
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return ref;
}

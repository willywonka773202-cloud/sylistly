'use client';

import { Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { safeStorageGet, safeStorageSet } from '@/lib/safe-storage';

const DISMISS_KEY = 'sylistly.install-hint.dismissed.v1';

/**
 * Only show on REAL iOS Safari where "Add to Home Screen" actually exists:
 * - iOS device (iPhone/iPad, incl. iPadOS-as-desktop),
 * - not already installed/standalone,
 * - not an in-app webview or a non-Safari iOS browser (Instagram/TikTok/Chrome-
 *   iOS etc. can't add to the home screen — showing them the hint is a dead end).
 * This is the prerequisite for iOS web-push too: push only works once installed.
 */
function canInstallOnIOS(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;

  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (standalone) return false;

  // In-app webviews + non-Safari iOS browsers have no Add-to-Home-Screen path.
  if (/(FBAN|FBAV|Instagram|Line|Twitter|Snapchat|Pinterest|musical_ly|Bytedance|TikTok|CriOS|FxiOS|EdgiOS|GSA)/i.test(ua)) {
    return false;
  }
  return /Safari/i.test(ua) && !/(Chrome|Chromium|Android)/i.test(ua);
}

export function InstallHint() {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // ?installhint=1 force-shows it on any device (QA / device preview).
    const force = new URLSearchParams(window.location.search).has('installhint');
    if (safeStorageGet(DISMISS_KEY) && !force) return;
    if (!force && !canInstallOnIOS()) return;
    // Let the user experience the app first; a cold prompt reads as spam.
    const timer = window.setTimeout(() => {
      setMounted(true);
      requestAnimationFrame(() => setShown(true));
    }, force ? 400 : 8000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  function dismiss() {
    safeStorageSet(DISMISS_KEY, '1');
    setShown(false);
    window.setTimeout(() => setMounted(false), 280);
  }

  return (
    <div
      role="dialog"
      aria-label="Add Sylistly to your Home Screen"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[130] px-3 pb-[calc(env(safe-area-inset-bottom)+96px)]"
    >
      <div
        className={`pointer-events-auto mx-auto flex max-w-[440px] items-start gap-3 rounded-[22px] border border-[rgba(231,199,155,.22)] bg-[rgba(18,17,20,.975)] p-3.5 shadow-[0_26px_64px_-18px_rgba(0,0,0,.78)] backdrop-blur-2xl transition-all duration-300 ease-out ${
          shown ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={44} height={44} className="mt-0.5 h-11 w-11 shrink-0 rounded-[12px] ring-1 ring-[rgba(231,199,155,.25)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold leading-tight text-ink">Add Sylistly to your Home Screen</p>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">
            Launches full-screen — one tap to today&apos;s drop and your saved fits, like a real app.
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-semibold text-champagne">
            <span className="inline-flex items-center gap-1">Tap<Share size={13} className="text-champagne" aria-label="the Share button" /></span>
            <span className="text-muted">then</span>
            <span className="text-ink">Add to Home Screen</span>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="sy-press -mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-2 transition hover:text-ink"
        >
          <X size={17} />
        </button>
      </div>
    </div>
  );
}

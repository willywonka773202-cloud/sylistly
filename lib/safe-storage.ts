/**
 * localStorage that never throws. In Safari Private Mode and some strict in-app
 * webviews (Instagram / TikTok — exactly where shared links open), ANY
 * localStorage access can throw (QuotaExceededError on write, SecurityError on
 * blocked storage). Unguarded, that crashes the screen on Sylistly's main
 * viral-visitor path. These wrappers fail silently: a write that can't persist
 * still lets the session continue. The try/catch also covers SSR (`window`
 * undefined throws a ReferenceError, caught here → safe no-op / null).
 */
export function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked / quota — skip persistence, keep the session alive */
  }
}

export function safeStorageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* private mode / blocked — nothing to clean up */
  }
}

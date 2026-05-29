'use client';
import { useEffect, useState } from 'react';

/** True only after the component has mounted on the client. Use to gate UI that
 *  depends on persisted (localStorage) store state and would otherwise flash or
 *  cause a hydration mismatch. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

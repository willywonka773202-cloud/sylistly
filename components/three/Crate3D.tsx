'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only 3D crate visual. Loaded via next/dynamic (ssr:false) so three.js
 * never touches the server bundle / hydration. Rendered as a pointer-events-none
 * layer that fills its parent — the parent button keeps the tap handler, so the
 * crate plinth, label, and onOpen all keep working. Only mount this when
 * useHeavyVisuals() is true; otherwise render the CSS crate fallback.
 */
const CrateScene = dynamic(() => import('./CrateScene'), {
  ssr: false,
  loading: () => null,
});

export function Crate3D({ hue = '#FF2D6D', opening = false }: { hue?: string; opening?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[34px]">
      <CrateScene hue={hue} opening={opening} />
    </div>
  );
}

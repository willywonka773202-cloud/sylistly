'use client';

/**
 * Living ambient backdrop — slow-drifting, heavily-blurred brand-tinted blobs on
 * the dark base, so dark surfaces (the Drop shop, behind the feed) feel ALIVE
 * instead of flat #0D0D0F. Pure CSS (no WebGL), GPU-composited transforms,
 * pointer-events-none. Mount as an absolute layer BEHIND z-10 content. Drift
 * freezes under prefers-reduced-motion (handled in globals.css).
 */
export function AmbientField({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <span className="sy-drift-a absolute left-[8%] top-[4%] h-[52vh] w-[52vh] rounded-full blur-[80px] will-change-transform" />
      <span className="sy-drift-b absolute right-[2%] top-[26%] h-[46vh] w-[46vh] rounded-full blur-[90px] will-change-transform" />
      <span className="sy-drift-c absolute bottom-[2%] left-[22%] h-[48vh] w-[48vh] rounded-full blur-[96px] will-change-transform" />
    </div>
  );
}

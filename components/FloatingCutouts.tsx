'use client';

/**
 * Cinematic intro backdrop — the premium garment cutouts (made by the Higgsfield
 * studio pipeline) drift in a slow, depth-blurred parallax cloud behind the hero.
 * Pure CSS motion, composed from the existing vocabulary (sy-fade-up entrance,
 * sy-fit-float drift); all of it is neutralised under prefers-reduced-motion.
 */

const DIR = '/assets/cutouts/thumb/';

// depth-sorted: earlier = farther (smaller, fainter, blurrier, slower)
type Piece = { f: string; top: string; left: string; w: number; rot: number; op: number; blur: number; dur: number; delay: number };
const PIECES: Piece[] = [
  { f: 'hf-generated-78e12d07e48356f4.webp', top: '14%', left: '30%', w: 24, rot: -8, op: 0.18, blur: 2.6, dur: 11.0, delay: 0.45 },
  { f: 'hf-generated-a617e2dc43e758c4.webp', top: '52%', left: '62%', w: 30, rot: 9, op: 0.22, blur: 2.2, dur: 10.4, delay: 0.30 },
  { f: 'hf-generated-6870da67944a3f04.webp', top: '64%', left: '2%', w: 30, rot: 6, op: 0.24, blur: 2.0, dur: 10.8, delay: 0.36 },
  { f: 'hf-generated-56a7248a4611411a.webp', top: '4%', left: '8%', w: 34, rot: -11, op: 0.34, blur: 1.4, dur: 9.4, delay: 0.16 },
  { f: 'hf-generated-cd907fc7ffacdf99.webp', top: '36%', left: '-8%', w: 40, rot: -6, op: 0.42, blur: 1.2, dur: 8.8, delay: 0.10 },
  { f: 'hf-generated-767c47cf9c0a1ec4.webp', top: '30%', left: '70%', w: 38, rot: 13, op: 0.5, blur: 0.9, dur: 9.0, delay: 0.24 },
  { f: 'hf-generated-8629179dcfa98578.webp', top: '1%', left: '52%', w: 42, rot: -9, op: 0.78, blur: 0.4, dur: 8.2, delay: 0.14 },
  { f: 'hf-generated-592c963435bd79d5.webp', top: '8%', left: '60%', w: 44, rot: 8, op: 0.9, blur: 0, dur: 7.6, delay: 0.06 },
];

export function FloatingCutouts() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* drifting aurora — accent + champagne, slow breathing depth */}
      <div
        className="sy-drift-a absolute -left-1/4 -top-1/4 h-[62%] w-[85%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(255,45,109,.24), transparent)', filter: 'blur(44px)' }}
      />
      <div
        className="sy-drift-b absolute right-[-22%] top-[6%] h-[58%] w-[72%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(231,199,155,.16), transparent)', filter: 'blur(52px)' }}
      />

      {/* floating garment cloud */}
      {PIECES.map((p) => (
        <div
          key={p.f}
          className="absolute"
          style={{ top: p.top, left: p.left, width: `${p.w}%`, transform: `rotate(${p.rot}deg)`, filter: `blur(${p.blur}px)` }}
        >
          <div className="sy-collage-in" style={{ animationDelay: `${p.delay}s` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${DIR}${p.f}`}
              alt=""
              loading="eager"
              decoding="async"
              className="sy-fit-float block w-full select-none drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]"
              style={{ opacity: p.op, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
            />
          </div>
        </div>
      ))}

      {/* legibility scrim — keeps the lower-third hero + CTA crisp over the cloud */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, #0a0708 16%, rgba(10,7,8,0.35) 52%, rgba(10,7,8,0) 78%)' }}
      />
    </div>
  );
}

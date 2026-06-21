'use client';

import { useEffect, useState } from 'react';

/**
 * Cinematic launch build. Rendered as a direct child of <body> in the root
 * layout, so it ships in the *server* HTML and paints instantly — covering the
 * blank gap before React hydrates and the feed mounts. The sequence: the brand
 * mark FORMS (spins in from blur with an overshoot), then a first outfit SNAPS
 * together piece-by-piece in a little collage plate — real premium garment
 * cutouts flying in — the wordmark sheens, a hairline fills, and the whole
 * overlay dissolves into the live feed behind it.
 *
 * The garment thumbs are tiny static webps in /public (available pre-hydration,
 * unlike the dynamic catalog), so it stays instant. Root layout persists across
 * client navigations, so this mounts once per full load — never re-splashes on
 * in-app tab changes.
 */
const MIN_VISIBLE_MS = 1560; // long enough to play the outfit assembling
const FADE_MS = 460; // keep in sync with the duration class below

/** Real garment cutouts that snap into the outfit collage, with the direction +
 *  tilt each one flies in from (so it reads as an outfit being hand-assembled). */
const PIECES = [
  { img: 'hf-generated-78e12d07e48356f4.webp', dx: '-26px', dy: '-22px', rot: '-14deg', delay: 460 },
  { img: 'hf-generated-592c963435bd79d5.webp', dx: '26px', dy: '-20px', rot: '12deg', delay: 560 },
  { img: 'hf-generated-8629179dcfa98578.webp', dx: '-24px', dy: '24px', rot: '10deg', delay: 660 },
  { img: 'hf-generated-767c47cf9c0a1ec4.webp', dx: '26px', dy: '22px', rot: '-12deg', delay: 760 },
] as const;

export function SplashScreen() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), MIN_VISIBLE_MS);
    const remove = window.setTimeout(() => setGone(true), MIN_VISIBLE_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-bg transition-opacity duration-[460ms] ease-out ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* Atmosphere — same accent spotlight + grain as the feed, so the splash
          dissolves seamlessly into the app behind it. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_28%,rgba(255,45,109,.16),transparent_60%)]"
      />
      <div aria-hidden className="sy-grain absolute inset-0 opacity-[.06] mix-blend-overlay" />

      <div className="relative flex flex-col items-center px-8">
        {/* App-icon mark — FORMS in from blur with a spring overshoot. */}
        <span className="sy-splash-form grid h-[64px] w-[64px] place-items-center rounded-[20px] bg-accent shadow-[0_18px_50px_-12px_rgba(255,45,109,.6)]">
          <svg viewBox="0 0 512 512" className="h-[64px] w-[64px]" aria-hidden>
            <path
              d="M314.52 164.08C295.427 148.8 270.72 141.16 240.4 141.16C214.64 141.16 192.6 146.52 174.28 157.24C155.96 167.96 146.8 183.76 146.8 204.64C146.8 218.453 150.733 229.867 158.6 238.88C166.467 247.747 176.16 255.093 187.68 260.92C199.2 266.6 212.347 271.813 227.12 276.56C241.893 281.16 254.08 285.253 263.68 288.84C273.427 292.427 281.547 296.987 288.04 302.52C294.68 307.907 298 314.84 298 323.32C298 334.253 293.4 342.627 284.2 348.44C275.147 354.107 263.72 356.94 249.92 356.94C234.56 356.94 220.067 352.86 206.44 344.7C192.96 336.393 182.6 325.44 175.36 311.84L136 333.08C145.6 351.253 159.813 365.507 178.64 375.84C197.467 386.173 221.333 391.34 250.24 391.34C279.733 391.34 304.08 384.22 323.28 369.98C342.627 355.74 352.3 336.34 352.3 311.78C352.3 296.86 348.22 284.54 340.06 274.82C331.9 264.953 321.86 257.04 309.94 251.08C298.02 245.12 284.54 239.84 269.5 235.24C254.607 230.493 242.313 226.4 232.62 222.96C223.073 219.373 215.06 214.96 208.58 209.72C202.247 204.333 199.08 197.693 199.08 189.8C199.08 180.453 203.08 173.16 211.08 167.92C219.227 162.533 229.58 159.84 242.14 159.84C255.18 159.84 267.127 163.053 277.98 169.48C288.98 175.907 297.047 184.387 302.18 194.92L339.06 173.36C333.633 160.467 325.453 150.707 314.52 144.08V164.08Z"
              fill="#FFFEFB"
            />
          </svg>
        </span>

        {/* Wordmark — mirrors the feed header. Champagne sheen sweeps across it. */}
        <div className="mt-4 font-serif text-[28px] font-semibold italic leading-none sy-splash-sheen">
          Fit scroll
        </div>

        {/* The first outfit SNAPS together — real garment cutouts fly into a collage. */}
        <div
          className="sy-splash-plate relative mt-7 grid grid-cols-2 gap-2 rounded-[22px] border border-black/5 bg-[radial-gradient(135%_115%_at_50%_18%,#F4F0E8_0%,#ECE6DB_56%,#DED4C3_100%)] p-2.5 shadow-[0_22px_50px_-22px_rgba(0,0,0,.6)]"
          style={{ animationDelay: '360ms' }}
        >
          {PIECES.map(({ img, dx, dy, rot, delay }, i) => (
            <span
              key={i}
              className="sy-splash-tile grid h-12 w-12 place-items-center overflow-hidden rounded-[14px] bg-white/55 shadow-[0_4px_10px_-4px_rgba(0,0,0,.3)]"
              style={
                {
                  '--dx': dx,
                  '--dy': dy,
                  '--rot': rot,
                  animationDelay: `${delay}ms`,
                } as React.CSSProperties
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/assets/cutouts/thumb/${img}`}
                alt=""
                className="h-full w-full object-contain p-0.5 drop-shadow-[0_2px_4px_rgba(40,26,14,.4)]"
              />
            </span>
          ))}
        </div>

        {/* Filling hairline — a quiet, honest progress cue. */}
        <span className="mt-6 h-[2px] w-16 origin-left overflow-hidden rounded-full bg-hairline">
          <span className="sy-splash-bar block h-full w-full rounded-full bg-accent" />
        </span>
      </div>
    </div>
  );
}

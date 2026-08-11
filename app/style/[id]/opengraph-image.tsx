import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getLibraryLook } from '@/lib/outfit-library';
import { getStyleIdentityById } from '@/lib/style-identity';
import type { Category } from '@/lib/types';
import { VIBES } from '@/lib/vibes';

// Node runtime (not edge): both the catalog behind getLibraryLook (~1MB) and
// reading cutout PNGs off disk need Node. Mirrors app/look/[id]/opengraph-image.
export const runtime = 'nodejs';
export const alt = 'A style identity on Sylistly';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const VIBE_LABEL = new Map(VIBES.map((vibe) => [vibe.id, vibe.label]));

// Worn-silhouette placement — mirrors components/WornFlatlay + the look OG so the
// share card looks like the in-app plate (a designed "set", not a scatter grid).
const ZONES: Record<Category, { left: number; top: number; w: number; h: number; z: number; rot: number }> = {
  hat:     { left: 37, top: 1,  w: 26, h: 11, z: 30, rot: 0 },
  eyewear: { left: 41, top: 12, w: 18, h: 6.5, z: 31, rot: 1.5 },
  outer:   { left: 21, top: 17, w: 58, h: 33, z: 18, rot: -1 },
  top:     { left: 32, top: 20, w: 36, h: 28, z: 24, rot: 1 },
  jewelry: { left: 2,  top: 40, w: 14, h: 11, z: 33, rot: -5 },
  bag:     { left: 76, top: 43, w: 22, h: 18, z: 26, rot: 4 },
  bottom:  { left: 31, top: 47, w: 38, h: 31, z: 12, rot: 0 },
  shoes:   { left: 27, top: 79, w: 46, h: 18, z: 20, rot: -1 },
};
const PLATE_W = 452;
const PLATE_H = 556;

// Always the canonical domain for the HTTP fallback — NEXT_PUBLIC_APP_URL can be
// localhost in dev, which serves nothing in a deployed lambda.
const CANONICAL_BASE = 'https://www.sylistly.com';

/** Satori needs inline data URIs. Disk first (dev), canonical HTTP second (prod). */
async function toDataUri(relativeUrl: string): Promise<string | null> {
  try {
    const buffer = await readFile(path.join(process.cwd(), 'public', relativeUrl));
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    /* not on disk (prod lambda) — fall through to HTTP */
  }
  try {
    const res = await fetch(`${CANONICAL_BASE}${relativeUrl}`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function StyleOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = getStyleIdentityById(id);

  const name = identity?.name || 'Sylistly';
  const tagline = identity?.tagline || 'Endless outfits from real products.';
  const vibes = identity?.vibes.map((vibe) => VIBE_LABEL.get(vibe) || vibe) || [];

  // A representative outfit for this identity — same generator + deterministic
  // seed as the /style/[id] page, so the share card matches what they'll see.
  let pieces: Array<{ zone: (typeof ZONES)[Category]; uri: string }> = [];
  if (identity) {
    const seed = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const look = getLibraryLook(identity.vibes[0], 'androgynous', { seed });
    if (look) {
      const placeable = Object.values(look.products)
        .map((product) => {
          if (!product) return null;
          const zone = ZONES[product.category];
          const rel = product.imageTransparentUrl;
          return zone && rel && !rel.startsWith('http') ? { zone, rel } : null;
        })
        .filter((entry): entry is { zone: (typeof ZONES)[Category]; rel: string } => Boolean(entry))
        .sort((a, b) => a.zone.z - b.zone.z);
      pieces = (
        await Promise.all(placeable.map(async (entry) => ({ zone: entry.zone, uri: await toDataUri(entry.rel) })))
      ).filter((entry): entry is { zone: (typeof ZONES)[Category]; uri: string } => Boolean(entry.uri));
    }
  }

  const hasPlate = pieces.length >= 3;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#0D0D0F',
          backgroundImage:
            'radial-gradient(820px 520px at 12% 8%, rgba(255,45,109,.20), transparent 58%), radial-gradient(620px 420px at 96% 96%, rgba(231,199,155,.10), transparent 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Left: the pitch */}
        <div
          style={{
            width: hasPlate ? 470 : '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: hasPlate ? '0 20px 0 64px' : '0 96px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              color: '#E7C79B',
              fontSize: 21,
              letterSpacing: '0.4em',
              fontWeight: 700,
            }}
          >
            <div style={{ width: 46, height: 3, backgroundColor: '#FF2D6D', display: 'flex' }} />
            A STYLE ON SYLISTLY
          </div>
          <div
            style={{
              marginTop: 24,
              color: '#FBF7F2',
              fontSize: hasPlate ? 76 : 112,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: '-0.03em',
              display: 'flex',
            }}
          >
            {name}
          </div>
          <div
            style={{
              marginTop: 24,
              color: 'rgba(251,247,242,.62)',
              fontSize: hasPlate ? 27 : 30,
              fontWeight: 500,
              lineHeight: 1.35,
              maxWidth: hasPlate ? 420 : 880,
              display: 'flex',
            }}
          >
            {tagline}
          </div>
          <div style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {vibes.map((label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  border: '2px solid rgba(251,247,242,.18)',
                  borderRadius: 999,
                  padding: '9px 22px',
                  color: 'rgba(251,247,242,.8)',
                  fontSize: 22,
                  fontWeight: 600,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Right: the worn-silhouette plate (matches the in-app look) */}
        {hasPlate ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '37px 60px 37px 8px',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: PLATE_W,
                height: PLATE_H,
                display: 'flex',
                backgroundImage: 'radial-gradient(125% 92% at 50% 36%, #FFFDF9 0%, #F5F0E7 74%, #ECE5D8 100%)',
                borderRadius: 36,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: 22,
                  left: PLATE_W / 2 - 100,
                  width: 200,
                  height: 22,
                  backgroundColor: 'rgba(58,36,24,0.16)',
                  borderRadius: 999,
                  display: 'flex',
                }}
              />
              {pieces.map((piece, index) => (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    left: Math.round((piece.zone.left / 100) * PLATE_W),
                    top: Math.round((piece.zone.top / 100) * PLATE_H),
                    width: Math.round((piece.zone.w / 100) * PLATE_W),
                    height: Math.round((piece.zone.h / 100) * PLATE_H),
                    transform: `rotate(${piece.zone.rot}deg)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <img src={piece.uri} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    ),
    { ...size },
  );
}

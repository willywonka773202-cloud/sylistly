import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { hasExactProductLink } from '@/lib/product-image-quality';
import { resolveSharedLook, sharedLookProducts, sharedLookTotalCents } from '@/lib/share-look';
import type { Category } from '@/lib/types';

// Node runtime (not edge): the catalog JSON behind the resolver is ~1MB.
export const runtime = 'nodejs';
export const alt = 'A complete outfit on Sylistly';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Worn-silhouette placement — mirrors components/WornFlatlay so the share card
// looks exactly like the in-app plate (a designed "set", not a scatter grid).
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

// Always the canonical domain for the HTTP fallback — NEXT_PUBLIC_APP_URL
// can be localhost in dev, which serves nothing.
const CANONICAL_BASE = 'https://www.sylistly.com';

/**
 * Satori needs inline data URIs to be reliable. Local filesystem first
 * (dev; cutouts are excluded from prod lambdas), canonical-domain HTTP
 * second (prod).
 */
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

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const look = resolveSharedLook(id);

  if (!look) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0D0D0F',
            color: '#FBF7F2',
            fontSize: 64,
            fontWeight: 800,
          }}
        >
          Sylistly
        </div>
      ),
      { ...size },
    );
  }

  const products = sharedLookProducts(look);
  const total = `$${Math.round(sharedLookTotalCents(look) / 100).toLocaleString()}`;
  const shoppable = products.filter((product) => hasExactProductLink(product)).length;

  // Build the worn silhouette: each piece at its fixed zone, back-to-front.
  const placeable = products
    .map((product) => {
      const zone = ZONES[product.category];
      const rel = product.imageTransparentUrl;
      return zone && rel && !rel.startsWith('http') ? { zone, rel } : null;
    })
    .filter((entry): entry is { zone: (typeof ZONES)[Category]; rel: string } => Boolean(entry))
    .sort((a, b) => a.zone.z - b.zone.z);
  const pieces = (
    await Promise.all(placeable.map(async (entry) => ({ zone: entry.zone, uri: await toDataUri(entry.rel) })))
  ).filter((entry): entry is { zone: (typeof ZONES)[Category]; uri: string } => Boolean(entry.uri));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#0D0D0F',
          backgroundImage:
            'radial-gradient(700px 420px at 16% 12%, rgba(255,45,109,.16), transparent 60%), radial-gradient(560px 380px at 96% 92%, rgba(231,199,155,.08), transparent 60%)',
        }}
      >
        {/* Left: the pitch */}
        <div
          style={{
            width: 470,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 20px 0 64px',
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
            <div style={{ width: 44, height: 3, backgroundColor: '#FF2D6D', display: 'flex' }} />
            SYLISTLY
          </div>
          <div
            style={{
              marginTop: 24,
              color: '#FBF7F2',
              fontSize: 66,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              display: 'flex',
            }}
          >
            {look.title}
          </div>
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(130,224,166,.12)',
                border: '2px solid rgba(130,224,166,.4)',
                color: '#82E0A6',
                borderRadius: 999,
                padding: '8px 20px',
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {total}
            </div>
            <div style={{ display: 'flex', color: 'rgba(251,247,242,.6)', fontSize: 23, fontWeight: 500 }}>
              {shoppable}/{products.length} shoppable
            </div>
          </div>
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              color: 'rgba(251,247,242,.55)',
              fontSize: 21,
              lineHeight: 1.4,
            }}
          >
            {look.note ? look.note : 'Every piece a real product. Lock what you love, restyle the rest.'}
          </div>
        </div>

        {/* Right: the worn-silhouette plate (matches the in-app look) */}
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
            {/* contact shadow under the silhouette */}
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
      </div>
    ),
    { ...size },
  );
}

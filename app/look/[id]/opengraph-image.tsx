import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { resolveSharedLook, sharedLookProducts, sharedLookTotalCents } from '@/lib/share-look';

// Node runtime (not edge): the catalog JSON behind the resolver is ~1MB.
export const runtime = 'nodejs';
export const alt = 'A complete outfit on Sylistly';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
  const cutoutUrls = products
    .map((product) => product.imageTransparentUrl)
    .filter((url): url is string => typeof url === 'string' && !url.startsWith('http'))
    .slice(0, 6);
  const cutouts = (await Promise.all(cutoutUrls.map(toDataUri))).filter(
    (uri): uri is string => Boolean(uri),
  );
  const total = `$${Math.round(sharedLookTotalCents(look) / 100).toLocaleString()}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#0D0D0F',
          backgroundImage:
            'radial-gradient(700px 420px at 16% 10%, rgba(255,45,109,.14), transparent 60%)',
        }}
      >
        {/* Left: the pitch */}
        <div
          style={{
            width: 470,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 24px 0 64px',
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
              marginTop: 26,
              color: '#FBF7F2',
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            {look.title}
          </div>
          <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 14 }}>
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
            <div style={{ display: 'flex', color: 'rgba(251,247,242,.6)', fontSize: 24, fontWeight: 500 }}>
              {products.length} real pieces
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
            Every piece shoppable. Lock what you love, restyle the rest.
          </div>
        </div>

        {/* Right: the fit on a gallery plate */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '44px 56px 44px 12px',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              alignContent: 'center',
              gap: 18,
              backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #FAF5EF 100%)',
              borderRadius: 40,
              padding: 30,
            }}
          >
            {cutouts.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img
                key={url}
                src={url}
                width={170}
                height={170}
                style={{ objectFit: 'contain', width: 170, height: 170 }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

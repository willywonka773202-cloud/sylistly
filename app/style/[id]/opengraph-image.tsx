import { ImageResponse } from 'next/og';
import { IDENTITIES } from '@/lib/style-identity';
import { VIBES } from '@/lib/vibes';

export const runtime = 'edge';
export const alt = 'A style identity on Sylistly';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const VIBE_LABEL = new Map(VIBES.map((vibe) => [vibe.id, vibe.label]));

export default async function StyleOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = IDENTITIES[id];

  const name = identity?.name || 'Sylistly';
  const tagline = identity?.tagline || 'Endless outfits from real products.';
  const vibes = identity?.vibes.map((vibe) => VIBE_LABEL.get(vibe) || vibe) || [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          backgroundColor: '#0D0D0F',
          backgroundImage:
            'radial-gradient(820px 520px at 12% 8%, rgba(255,45,109,.20), transparent 58%), radial-gradient(620px 420px at 96% 96%, rgba(231,199,155,.10), transparent 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: '#E7C79B',
            fontSize: 22,
            letterSpacing: '0.4em',
            fontWeight: 700,
          }}
        >
          <div style={{ width: 46, height: 3, backgroundColor: '#FF2D6D', display: 'flex' }} />
          A STYLE ON SYLISTLY
        </div>
        <div
          style={{
            marginTop: 26,
            color: '#FBF7F2',
            fontSize: 112,
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
            marginTop: 26,
            color: 'rgba(251,247,242,.62)',
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.35,
            maxWidth: 880,
            display: 'flex',
          }}
        >
          {tagline}
        </div>
        <div style={{ marginTop: 32, display: 'flex', gap: 14 }}>
          {vibes.map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                border: '2px solid rgba(251,247,242,.18)',
                borderRadius: 999,
                padding: '10px 24px',
                color: 'rgba(251,247,242,.8)',
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}

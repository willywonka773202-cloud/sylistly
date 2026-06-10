import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sylistly — endless outfits from real products';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Editorial Noir share card: noir field, champagne eyebrow, pink signature rule.
// PNG via next/og because SVG og-images are rejected by FB/X/iMessage scrapers.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 96px',
          backgroundColor: '#0D0D0F',
          backgroundImage:
            'radial-gradient(900px 500px at 85% 10%, rgba(255,45,109,.16), transparent 60%), radial-gradient(700px 420px at 8% 95%, rgba(231,199,155,.10), transparent 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            color: '#E7C79B',
            fontSize: 26,
            letterSpacing: '0.42em',
            fontWeight: 700,
          }}
        >
          <div style={{ width: 54, height: 3, backgroundColor: '#FF2D6D', display: 'flex' }} />
          SYLISTLY
        </div>
        <div
          style={{
            marginTop: 34,
            color: '#FBF7F2',
            fontSize: 104,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>Endless outfits</span>
          <span style={{ display: 'flex' }}>
            from&nbsp;<span style={{ color: '#FF2D6D' }}>real products.</span>
          </span>
        </div>
        <div
          style={{
            marginTop: 36,
            color: 'rgba(251,247,242,.62)',
            fontSize: 32,
            fontWeight: 500,
            display: 'flex',
          }}
        >
          Lock the piece you love. Restyle the rest. Shop the whole fit.
        </div>
      </div>
    ),
    { ...size },
  );
}

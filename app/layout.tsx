import type { Metadata, Viewport } from 'next';
import { Playfair_Display } from 'next/font/google';
import localFont from 'next/font/local';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import { InstallHint } from '@/components/InstallHint';
import { SplashScreen } from '@/components/SplashScreen';
import './globals.css';

// Satoshi (variable 300-900) for all UI text — per the Fit Scroll design
// system. Playfair Display stays the editorial headline serif.
const satoshi = localFont({
  src: [
    { path: './fonts/Satoshi-Variable.woff2', weight: '300 900', style: 'normal' },
    { path: './fonts/Satoshi-VariableItalic.woff2', weight: '300 900', style: 'italic' },
  ],
  variable: '--font-satoshi',
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  style: ['normal', 'italic'],
  weight: ['500', '600', '700'],
});

export const viewport: Viewport = {
  themeColor: '#0D0D0F',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: 'Sylistly',
    template: '%s | Sylistly',
  },
  description: 'An endless scroll of complete outfits from real products. Lock the piece you love, restyle the rest, shop the whole fit.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.sylistly.com'),
  applicationName: 'Sylistly',
  // Native feel when installed to the iOS home screen — full-screen standalone
  // shell, translucent status bar over the dark UI, no phone-number autolinking.
  appleWebApp: {
    capable: true,
    title: 'Sylistly',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  keywords: [
    'fashion app',
    'outfit ideas',
    'AI stylist',
    'outfit builder',
    'shop outfits',
    'streetwear fits',
    'lookbook',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Sylistly',
    description: 'Endless outfits from real products. Lock what you love, restyle the rest.',
    url: '/',
    siteName: 'Sylistly',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sylistly',
    description: 'Endless outfits from real products. Lock what you love, restyle the rest.',
  },
  icons: {
    // SVG for modern browser tabs (crisp at any size); PNG fallback for engines
    // that don't take SVG favicons.
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    // iOS Safari "Add to Home Screen" does NOT render SVG apple-touch-icons — it
    // needs a real PNG, or the home-screen icon falls back to a page screenshot.
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.webmanifest',
};

// Site-level structured data (factual brand identity only — no Product/offer
// claims, since Sylistly is an affiliate aggregator, not the merchant). Helps
// search engines resolve the brand for sitelinks / knowledge panel.
const SITE_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.sylistly.com/#org',
      name: 'Sylistly',
      url: 'https://www.sylistly.com',
      logo: 'https://www.sylistly.com/apple-touch-icon.png',
      description:
        'An endless scroll of complete outfits from real products. Lock the piece you love, restyle the rest, shop the whole fit.',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.sylistly.com/#website',
      name: 'Sylistly',
      url: 'https://www.sylistly.com',
      publisher: { '@id': 'https://www.sylistly.com/#org' },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${satoshi.variable} ${playfair.variable}`}>
      <body className="bg-bg text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD) }}
        />
        <SplashScreen />
        <AnalyticsProvider />
        <InstallHint />
        {/* Desktop vitrine — frames the 480px app column as an intentional
            object on wide screens (every page centers at the same width).
            Pure chrome: aria-hidden, no pointer events, invisible below lg. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] hidden lg:block">
          {/* hairline edges + ambient wall glow around the column */}
          <div className="absolute inset-y-0 left-1/2 w-[480px] -translate-x-1/2 shadow-[0_0_120px_rgba(255,45,109,.07)] ring-1 ring-white/[.07]" />
          {/* left gallery rail — xl only: below that the gutter is too narrow */}
          <div className="absolute left-[max(2.5rem,calc(50%-240px-21rem))] top-1/2 hidden w-64 -translate-y-1/2 xl:block">
            <span className="block h-[2px] w-8 bg-accent" />
            <p className="mt-5 font-serif text-[30px] italic leading-none text-ink">Sylistly</p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-2">
              An endless scroll of complete outfits, built from real pieces you can buy right now.
            </p>
            <div className="mt-8 text-[11px] uppercase tracking-[0.22em] text-muted-2">
              <p className="border-t border-hairline-2 py-3">Scroll complete fits</p>
              <p className="border-t border-hairline-2 py-3">Lock a piece · remix the rest</p>
              <p className="border-y border-hairline-2 py-3">Shop every look</p>
            </div>
            <p className="mt-8 text-[11px] uppercase tracking-[0.22em] text-muted">
              Best on your phone — <span className="text-ink">sylistly.com</span>
            </p>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}

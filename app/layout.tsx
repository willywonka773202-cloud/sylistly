import type { Metadata, Viewport } from 'next';
import { Playfair_Display } from 'next/font/google';
import localFont from 'next/font/local';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${satoshi.variable} ${playfair.variable}`}>
      <body className="bg-bg text-ink">
        <SplashScreen />
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}

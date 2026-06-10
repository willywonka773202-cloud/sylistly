import type { Metadata, Viewport } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700', '800', '900'],
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  style: ['normal', 'italic'],
  weight: ['500', '600', '700'],
});

export const viewport: Viewport = {
  themeColor: '#0A0A0C',
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sylistly.com'),
  applicationName: 'Sylistly',
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
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.svg', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="bg-bg text-ink">
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { ToastContainer } from '@/components/Toast';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  style: ['normal', 'italic'],
  weight: ['500', '600', '700'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f6f3ee',
};

export const metadata: Metadata = {
  title: 'Sylistly — Your AI Fashion Studio',
  description:
    'Build outfit collages, swipe your Style DNA, chat with an AI stylist, and share your looks. The social AI fashion app.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Sylistly — Your AI Fashion Studio',
    description: 'Build, swipe, and share outfits. Discover your Style DNA.',
    images: ['/og.png'],
    siteName: 'Sylistly',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="bg-bg text-ink antialiased">
        {/* Desktop frame backdrop — keeps the mobile-first column centered & premium */}
        <div className="min-h-[100dvh] bg-bg md:bg-[#ece5d9]">{children}</div>
        <ToastContainer />
      </body>
    </html>
  );
}

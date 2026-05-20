import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A0B',
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  title: {
    default: 'BertOS — AI Operating System',
    template: '%s | BertOS',
  },
  description: 'A premium local AI command center. Control Claude, Codex, and Gemini from one unified workspace.',
  applicationName: 'BertOS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0A0A0B] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  )
}

import './globals.css';
import { Schibsted_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { SITE_URL } from '../lib/site.js';
import CursorFx from '../components/CursorFx.jsx';
import Spotlight from '../components/Spotlight.jsx';

// Display: Schibsted Grotesk 800 (700 for secondary heads). Body: Inter.
// Mono: JetBrains Mono. Exposed as CSS variables; globals.css builds the
// --font-* stacks from them.
const display = Schibsted_Grotesk({ subsets: ['latin'], weight: ['700', '800'], variable: '--ff-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--ff-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--ff-mono', display: 'swap' });

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'unsnooze — auto-resume Claude Code & Codex when the usage limit resets',
    template: '%s · unsnooze',
  },
  description:
    'unsnooze wakes every limit-stopped AI coding session the moment the usage limit resets — Claude Code, Codex CLI, Grok, Qwen, Kimi, OpenCode, Antigravity, Cursor — with tmux, Zellij, herdr, cmux or headless watching, across all your projects.',
  applicationName: 'unsnooze',
  keywords: [
    'claude code usage limit', 'auto resume claude code', 'codex rate limit',
    'claude code 5 hour limit', 'ai coding agent auto resume', 'tmux', 'zellij',
  ],
  // Served from public/ rather than the app/icon.* convention: those emit a
  // hashed route-handler URL with a hardcoded no-cache header, and Google reads
  // the icon set off the home page markup. /favicon.ico goes first — it is the
  // path every crawler, browser and feed reader requests blind.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    siteName: 'unsnooze',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export const viewport = {
  themeColor: '#050713',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    // `js` gates the scroll reveals: set before first paint so revealed content
    // never flashes, and absent without JS so nothing stays hidden.
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {children}
        <CursorFx />
        <Spotlight />
      </body>
    </html>
  );
}

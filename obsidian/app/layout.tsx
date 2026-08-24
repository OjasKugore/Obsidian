/**
 * app/layout.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Root Application Layout Wrapper.
 *
 * Configures global typography fonts (Geist Sans, Geist Mono, Montserrat),
 * SEO metadata, CSP nonce security header injection, dark mode ThemeProvider,
 * and base HTML document structure for all Next.js pages.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Metadata } from 'next';
import { Geist, Geist_Mono, Montserrat } from 'next/font/google';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

// ── FONT CONFIGURATION & METADATA ─────────────────────────────────────

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['700', '800', '900'],
});

export const metadata: Metadata = {
  title: {
    default: 'Obsidian — End-to-End Encrypted Pastebin',
    template: '%s | Obsidian',
  },
  description:
    'Share secrets securely. AES-256-GCM encryption in your browser — the server never sees your plaintext.',
  robots: { index: false, follow: false }, // Pastes are private by design
};

// ── ROOT LAYOUT COMPONENT ─────────────────────────────────────────────

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── SETUP ──────────────────────────────────────────────────────────────
  // Nonce injected by middleware (lib/security-headers.ts) for CSP compliance
  const nonce = (await headers()).get('x-nonce') ?? '';

  // {/* ── UI ───────────────────────────────────────────────────────────────── */}
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground"
        data-nonce={nonce}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

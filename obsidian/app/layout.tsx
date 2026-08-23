import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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

import { ThemeProvider } from '@/components/theme-provider';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nonce injected by middleware (lib/security-headers.ts) for CSP compliance
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground" data-nonce={nonce}>
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

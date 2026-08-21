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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" data-nonce={nonce}>
        {children}
      </body>
    </html>
  );
}

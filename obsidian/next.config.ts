import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ── Security headers (CSP + hardening) ──────────────────────────────────────
  // Full CSP is assembled by lib/security-headers.ts and applied per-request.
  // The static headers below are a baseline for non-API routes.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent embedding in iframes (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Block MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Only send origin as referrer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions policy — disable sensitive APIs
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Cross-Origin Embedder / Opener policies (required for SharedArrayBuffer)
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },

  // Allow 127.0.0.1 and localhost dev origins
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // Neon serverless driver + Prisma must run in Node.js runtime, not the Edge
  // bundler. This was `experimental.serverComponentsExternalPackages` in Next.js 14;
  // it moved to a top-level key in Next.js 15+.
  serverExternalPackages: ['@prisma/client', '@neondatabase/serverless'],
};

export default nextConfig;

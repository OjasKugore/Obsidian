/**
 * middleware.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Next.js Edge Middleware Security Handler.
 *
 * Runs before every incoming request to:
 *   1. Generate a per-request cryptographically random CSP nonce
 *   2. Inject strict Content-Security-Policy (CSP) headers into HTTP response
 *   3. Forward nonce in x-nonce header for RootLayout RSC script embedding
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateNonce, getSecurityHeaders } from '@/lib/security-headers';

// ── EDGE MIDDLEWARE HANDLER ───────────────────────────────────────────

export function middleware(request: NextRequest): NextResponse {
  // Step 1: Generate per-request 128-bit cryptographic nonce
  const nonce = generateNonce();
  const securityHeaders = getSecurityHeaders(nonce);

  // Step 2: Inject x-nonce request header for root layout.tsx
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Step 3: Apply hardened security response headers
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

// ── MIDDLEWARE ROUTE MATCHER CONFIG ───────────────────────────────────

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

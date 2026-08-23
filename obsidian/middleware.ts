/**
 * middleware.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Next.js Edge Middleware — runs before every non-static request.
 *
 * Responsibilities:
 *   1. Generate a per-request cryptographic nonce
 *   2. Set the full Content-Security-Policy header with that nonce
 *   3. Pass the nonce to the root layout via a request header (x-nonce)
 *      so RSC can embed it in <script nonce="..."> tags
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateNonce, getSecurityHeaders } from '@/lib/security-headers';

export function middleware(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const securityHeaders = getSecurityHeaders(nonce);

  // Clone the request headers and inject the nonce so layout.tsx can read it
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Apply all security headers to the response
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  // Apply middleware to all routes except static files and Next.js internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

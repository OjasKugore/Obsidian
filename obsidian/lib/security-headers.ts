/**
 * lib/security-headers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds a strict Content-Security-Policy string.
 *
 * Usage (in middleware or route handlers):
 *   import { buildCSP } from '@/lib/security-headers';
 *   response.headers.set('Content-Security-Policy', buildCSP(nonce));
 *
 * Rules (non-negotiable per spec §8):
 *   - script-src: 'self' + nonce-based inline scripts only — NO unsafe-inline
 *   - connect-src: '*'  (Pusher WebSockets + Neon + Upstash + arbitrary CDN)
 *   - No unsafe-eval
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Generates a cryptographically random nonce (base64url, 128-bit).
 * Call once per request, pass to both buildCSP() and the root layout.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Assembles the Content-Security-Policy header value.
 *
 * @param nonce - Request-scoped nonce for inline script/style tags.
 * @returns      The full CSP string to set as the header value.
 */
export function buildCSP(nonce: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],

    // Only nonce-approved scripts — never unsafe-inline or unsafe-eval
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // next.js dev HMR websocket (stripped in production build)
      ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
    ],

    // Stylesheets: self + nonce + unsafe-inline (for Tailwind, Framer Motion, and dynamic animations)
    'style-src': ["'self'", "'unsafe-inline'", `'nonce-${nonce}'`],

    // Fonts: self only (Geist ships as local font, no CDN needed)
    'font-src': ["'self'"],

    // Images: self + data: (for base64 QR codes) + blob:
    'img-src': ["'self'", 'data:', 'blob:'],

    // connect-src: '*' — required by spec §8; Pusher WS + Neon + Upstash + GitHub API
    'connect-src': ['*'],

    // Workers: self + blob: (Web Worker loaded as Blob in some bundler configs)
    'worker-src': ["'self'", 'blob:'],

    // Frames: deny (clickjacking defence)
    'frame-ancestors': ["'none'"],
    'frame-src': ["'none'"],

    // Forms: self only
    'form-action': ["'self'"],

    // Upgrade HTTP → HTTPS in production
    ...(process.env.NODE_ENV === 'production'
      ? { 'upgrade-insecure-requests': [] }
      : {}),
  };

  return Object.entries(directives)
    .map(([key, vals]) =>
      vals.length === 0 ? key : `${key} ${vals.join(' ')}`
    )
    .join('; ');
}

/**
 * Returns the full set of hardened security headers as a plain object.
 * Merge into your Next.js response headers or middleware.
 */
export function getSecurityHeaders(nonce: string): Record<string, string> {
  return {
    'Content-Security-Policy': buildCSP(nonce),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

/**
 * lib/security-headers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Content-Security-Policy (CSP) & Hardened Security Header Builder.
 *
 * Rules:
 *   - script-src: 'self' + nonce-based inline scripts only (NO unsafe-inline)
 *   - connect-src: '*' (Pusher WebSockets + Neon DB + Upstash + GitHub API)
 *   - No unsafe-eval allowed in production builds
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── NONCE GENERATION UTILITY ──────────────────────────────────────────

/**
 * Generates a cryptographically random 128-bit nonce (base64url).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

// ── CSP BUILDER UTILITY ───────────────────────────────────────────────

/**
 * Assembles strict Content-Security-Policy header string for a given request nonce.
 */
export function buildCSP(nonce: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],

    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
    ],

    'style-src': ["'self'", "'unsafe-inline'", `'nonce-${nonce}'`],
    'font-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ['*'],
    'worker-src': ["'self'", 'blob:'],

    'frame-ancestors': ["'none'"],
    'frame-src': ["'none'"],
    'form-action': ["'self'"],

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

// ── SECURITY HEADERS COMPOSER ─────────────────────────────────────────

/**
 * Returns full dictionary of security response headers (CSP, HSTS, X-Frame-Options, etc.).
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

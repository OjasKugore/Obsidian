/**
 * lib/rate-limit.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Upstash Redis sliding-window rate limiter.
 *
 * Policy: 10 requests per 10 seconds per HMAC'd IP address.
 * The IP is never stored raw — it is HMAC-SHA256'd with IP_HMAC_SECRET
 * before being used as the rate-limit key.
 *
 * Usage in an API route:
 *   import { checkRateLimit } from '@/lib/rate-limit';
 *
 *   const result = await checkRateLimit(request);
 *   if (!result.success) {
 *     return Response.json({ error: 'Too many requests' }, { status: 429 });
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ── Redis client singleton ────────────────────────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Rate limiter: 10 requests / 10 seconds sliding window ────────────────────

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: 'obsidian:rl',
});

// ── IP HMAC helper ────────────────────────────────────────────────────────────

/**
 * Returns an HMAC-SHA256 of the raw IP address using IP_HMAC_SECRET.
 * This means we never store or log the raw IP — only a one-way hash.
 */
async function hmacIP(rawIP: string): Promise<string> {
  const secret = process.env.IP_HMAC_SECRET;
  if (!secret) {
    // In dev without env vars, fall back to a hash of the IP directly
    const encoder = new TextEncoder();
    const data = encoder.encode(rawIP);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Buffer.from(hashBuffer).toString('hex').slice(0, 32);
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    encoder.encode(rawIP)
  );
  return Buffer.from(signature).toString('hex').slice(0, 32);
}

// ── Extracts the real client IP from a Next.js request ───────────────────────

function getClientIP(request: Request): string {
  // Vercel injects X-Forwarded-For; fall back to a placeholder in local dev
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? '127.0.0.1';
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  reset: number;
  /** HTTP headers to include in the response */
  headers: Record<string, string>;
}

/**
 * Checks the rate limit for the given request.
 * Returns a result object; callers decide whether to return 429.
 */
export async function checkRateLimit(
  request: Request
): Promise<RateLimitResult> {
  const ip = getClientIP(request);
  const key = await hmacIP(ip);
  const { success, remaining, reset } = await ratelimit.limit(key);

  return {
    success,
    remaining,
    reset,
    headers: {
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(reset),
    },
  };
}

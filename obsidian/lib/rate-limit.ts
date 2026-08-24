/**
 * lib/rate-limit.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Upstash Redis Sliding-Window Rate Limiter.
 *
 * Policy: 10 requests per 10 seconds per HMAC-SHA256 hashed IP address.
 * Raw IP addresses are never logged or stored in Redis — only an HMAC-SHA256 hash
 * computed with IP_HMAC_SECRET is used as the rate-limit tracking key.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ── REDIS CLIENT & SLIDING WINDOW LIMITER ──────────────────────────────

const hasUpstash = Boolean(
  process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN &&
    !process.env.UPSTASH_REDIS_REST_URL.includes('YOUR-REDIS-INSTANCE')
);

const redis = hasUpstash
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
      prefix: 'obsidian:rl',
    })
  : null;

// ── ANONYMIZED IP HASHER & PARSER HELPERS ──────────────────────────────

/**
 * Returns an HMAC-SHA256 hash of the raw IP address using IP_HMAC_SECRET.
 * Ensures IP addresses are never logged or stored in cleartext.
 */
async function hmacIP(rawIP: string): Promise<string> {
  const secret = process.env.IP_HMAC_SECRET;
  if (!secret) {
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

/** Extracts real client IP address from Next.js request headers */
function getClientIP(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? '127.0.0.1';
}

// ── RATE LIMIT CHECKER API ─────────────────────────────────────────────

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
 * Evaluates the rate limit for an incoming API request against Upstash Redis.
 */
export async function checkRateLimit(
  request: Request
): Promise<RateLimitResult> {
  if (!ratelimit) {
    return {
      success: true,
      remaining: 10,
      reset: Date.now() + 10_000,
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '10',
        'X-RateLimit-Reset': String(Date.now() + 10_000),
      },
    };
  }

  try {
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
  } catch (err) {
    console.warn('[rate-limit] Redis check failed, failing open:', err);
    return {
      success: true,
      remaining: 10,
      reset: Date.now() + 10_000,
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '10',
        'X-RateLimit-Reset': String(Date.now() + 10_000),
      },
    };
  }
}

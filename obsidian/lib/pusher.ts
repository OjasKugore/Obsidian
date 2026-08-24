/**
 * lib/pusher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pusher Server-Side Client Singleton & Blind Relay.
 *
 * Provides WebSockets connection management for real-time collaboration.
 * Pusher functions purely as a blind relay — all payload data is encrypted
 * with AES-256-GCM client-side before broadcast and decrypted client-side.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Pusher from 'pusher';

// ── PUSHER CLIENT FACTORY ──────────────────────────────────────────────

const globalForPusher = globalThis as unknown as {
  pusher: Pusher | undefined;
};

function createPusherClient(): Pusher {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    console.warn(
      '[pusher] Missing PUSHER_* env vars — Pusher is disabled. ' +
        'Real-time collab will not work until you add credentials to .env.local.'
    );
    // Return a minimal stub that satisfies the Pusher type signature
    return {
      trigger: async () => ({ status: 200 }),
      authorizeChannel: () => ({ auth: 'stub' }),
    } as unknown as Pusher;
  }

  return new Pusher({ appId, key, secret, cluster, useTLS: true });
}

// ── GLOBALTHIS SINGLETON INSTANTIATION ────────────────────────────────

export const pusher: Pusher =
  globalForPusher.pusher ?? createPusherClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPusher.pusher = pusher;
}

export default pusher;

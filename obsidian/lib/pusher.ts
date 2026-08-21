/**
 * lib/pusher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pusher server-side client singleton.
 *
 * Used only in API Route handlers (Node.js runtime) — never import this from
 * client components. For client-side Pusher, use pusher-js directly in the
 * useCollab hook (Phase 3).
 *
 * Pusher is used as a blind relay — it never sees plaintext. All deltas
 * transmitted over Pusher channels are AES-256-GCM encrypted client-side
 * before being sent, and decrypted client-side on receipt.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Pusher from 'pusher';

const globalForPusher = globalThis as unknown as {
  pusher: Pusher | undefined;
};

function createPusherClient(): Pusher {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    // In development without credentials, return a stub that no-ops
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[pusher] Missing PUSHER_* env vars — Pusher is disabled in dev. ' +
          'Real-time collab (Phase 3) will not work until you add credentials.'
      );
      // Return a minimal stub that satisfies the Pusher type
      return {
        trigger: async () => ({ status: 200 }),
        authorizeChannel: () => ({ auth: 'stub' }),
      } as unknown as Pusher;
    }
    throw new Error(
      'Missing required Pusher environment variables: ' +
        'PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER'
    );
  }

  return new Pusher({ appId, key, secret, cluster, useTLS: true });
}

export const pusher: Pusher =
  globalForPusher.pusher ?? createPusherClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPusher.pusher = pusher;
}

export default pusher;

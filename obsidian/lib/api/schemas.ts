/**
 * lib/api/schemas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all API request/response shapes.
 * Member A owns this file. B and C import TYPES ONLY — never modify this file.
 *
 * Wire-format spec (v2):
 *   adata[0] = [iv, salt, iter, keySize, tagSize, algo, mode, compression]
 *   adata[1] = formatter  ("plaintext" | "markdown" | "syntaxhighlighting")
 *   adata[2] = open_discussion  (0 | 1)
 *   adata[3] = burn_after_reading  (0 | 1)
 *   adata[4] = base64 RSA-OAEP wrapped AES key  (asymmetric mode only)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from 'zod';

// ── Adata spec ────────────────────────────────────────────────────────────────

export const AdataSpecSchema = z.tuple([
  z.string(),            // iv        — base64 16-byte IV
  z.string(),            // salt      — base64 8-byte salt
  z.number().int().min(100_000), // iter — PBKDF2 iterations (≥ 100 000)
  z.literal(256),        // keySize   — AES-256
  z.literal(128),        // tagSize   — GCM auth tag bits
  z.literal('aes'),      // algo
  z.literal('gcm'),      // mode
  z.union([z.literal('zlib'), z.literal('none')]), // compression
]);

export type AdataSpec = z.infer<typeof AdataSpecSchema>;

// ── Full adata array ──────────────────────────────────────────────────────────

export const AdataSchema = z.tuple([
  AdataSpecSchema,                          // adata[0] — spec
  z.enum(['plaintext', 'markdown', 'syntaxhighlighting']), // adata[1] — formatter
  z.union([z.literal(0), z.literal(1)]),    // adata[2] — open_discussion
  z.union([z.literal(0), z.literal(1)]),    // adata[3] — burn_after_reading
]).rest(z.string());                         // adata[4] — optional RSA-OAEP wrapped key (asym mode)

export type AdataSchema = z.infer<typeof AdataSchema>;

// ── Expiry options ────────────────────────────────────────────────────────────

export const ExpirySchema = z.enum([
  '5min',
  '10min',
  '1hour',
  '1day',
  '1week',
  '1month',
  'never',
]);

export type Expiry = z.infer<typeof ExpirySchema>;

/** Maps expiry string → duration in seconds (null = never expires) */
export const EXPIRY_SECONDS: Record<Expiry, number | null> = {
  '5min':   5 * 60,
  '10min':  10 * 60,
  '1hour':  60 * 60,
  '1day':   24 * 60 * 60,
  '1week':  7 * 24 * 60 * 60,
  '1month': 30 * 24 * 60 * 60,
  'never':  null,
};

// ── POST /api/v1/paste — request body ─────────────────────────────────────────

export const CreatePasteBodySchema = z.object({
  /** Wire-format version — always 2 */
  v: z.literal(2),

  /** AES-256-GCM ciphertext, base64-encoded */
  ct: z.string().min(1),

  /** Full adata array */
  adata: AdataSchema,

  /** Paste metadata */
  meta: z.object({
    /** Paste expiry */
    expire: ExpirySchema,

    /** Open discussion (comment thread) enabled */
    openDiscussion: z.boolean().optional().default(false),

    /** Burn after reading — server deletes on first GET */
    burnAfterReading: z.boolean().optional().default(true),

    /** Max views before auto-delete (N-view self-destruct, Phase 4) */
    maxViews: z.number().int().positive().optional(),

    /** ISO-8601 datetime before which the paste cannot be read (time-lock, Phase 4) */
    timelockedUntil: z.string().datetime().optional(),

    // ── Shamir shard fields (only when shard: true) ───────────────────────

    /** True when this row represents a Shamir SSS shard */
    shard: z.boolean().optional().default(false),

    /** 1-based index of this shard */
    shardIndex: z.number().int().min(1).optional(),

    /** Total number of shards in the scheme */
    shardTotal: z.number().int().min(2).optional(),

    // ── Asymmetric mode ───────────────────────────────────────────────────

    /** True when adata[4] carries an RSA-OAEP wrapped AES key */
    recipientMode: z.boolean().optional().default(false),
  }),
}).superRefine((data, ctx) => {
  if (data.meta.shard) {
    if (data.meta.shardIndex === undefined) {
      ctx.addIssue({ code: 'custom', path: ['meta', 'shardIndex'], message: 'shardIndex required when shard=true' });
    }
    if (data.meta.shardTotal === undefined) {
      ctx.addIssue({ code: 'custom', path: ['meta', 'shardTotal'], message: 'shardTotal required when shard=true' });
    }
  }
  if (data.meta.recipientMode && data.adata[4] === undefined) {
    ctx.addIssue({ code: 'custom', path: ['adata'], message: 'adata[4] (RSA-OAEP wrapped key) required when recipientMode=true' });
  }
});

export type CreatePasteBody = z.infer<typeof CreatePasteBodySchema>;

// ── POST /api/v1/paste — response ─────────────────────────────────────────────

export const CreatePasteResponseSchema = z.object({
  /** fnv1a64(ciphertext) — 16 lowercase hex chars */
  pasteId: z.string().length(16),

  /** HMAC-SHA256(pasteId, per-paste-salt) — required to DELETE */
  deleteToken: z.string(),
});

export type CreatePasteResponse = z.infer<typeof CreatePasteResponseSchema>;

// ── GET /api/v1/paste/[id] — response ─────────────────────────────────────────

export const GetPasteResponseSchema = z.object({
  v: z.literal(2),
  ct: z.string(),
  adata: AdataSchema,
  meta: z.object({
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    burnAfterReading: z.boolean(),
    openDiscussion: z.boolean(),
    maxViews: z.number().int().positive().nullable(),
    timelockedUntil: z.string().datetime().nullable(),
    shard: z.boolean(),
    shardIndex: z.number().int().nullable(),
    shardTotal: z.number().int().nullable(),
    recipientMode: z.boolean(),
    views: z.number().int(),
  }),
});

export type GetPasteResponse = z.infer<typeof GetPasteResponseSchema>;

// ── DELETE /api/v1/paste/[id] — request ───────────────────────────────────────

export const DeletePasteQuerySchema = z.object({
  /** The delete token returned on creation */
  deleteToken: z.string().min(1),
});

export type DeletePasteQuery = z.infer<typeof DeletePasteQuerySchema>;

// ── PUT /api/v1/paste/[id] — request (Finalize collaborative edit) ─────────────

export const UpdatePasteBodySchema = z.object({
  v: z.literal(2),
  ct: z.string().min(1),
  adata: AdataSchema,
});

export type UpdatePasteBody = z.infer<typeof UpdatePasteBodySchema>;

// ── POST /api/v1/paste/[id]/comment — request ────────────────────────────────

export const CreateCommentBodySchema = z.object({
  v: z.literal(2),
  /** AES-GCM ciphertext (comment body, encrypted client-side) */
  ct: z.string().min(1),
  adata: AdataSchema,
  /** Parent comment id (empty string = top-level) */
  parentId: z.string().optional().default(''),
  /** Optional emoji icon */
  icon: z.string().max(8).optional(),
});

export type CreateCommentBody = z.infer<typeof CreateCommentBodySchema>;

// ── GET /api/v1/paste/[id]/comment — response ────────────────────────────────

export const CommentSchema = z.object({
  id: z.string(),
  pasteId: z.string(),
  parentId: z.string(),
  ct: z.string(),
  adata: AdataSchema,
  icon: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type Comment = z.infer<typeof CommentSchema>;

// ── POST /api/v1/collab/auth — Pusher channel auth ───────────────────────────

export const CollabAuthBodySchema = z.object({
  /** Pusher socket id */
  socket_id: z.string(),
  /** Pusher channel name — must be `presence-collab-{pasteId}` */
  channel_name: z.string().regex(/^presence-collab-[0-9a-f]{16}$/),
});

export type CollabAuthBody = z.infer<typeof CollabAuthBodySchema>;

// ── Error envelope ────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

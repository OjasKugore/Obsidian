/**
 * lib/api/schemas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single Source of Truth for API Schemas & Request/Response Types.
 *
 * Wire-format specification (v2):
 *   adata[0] = [iv, salt, iter, keySize, tagSize, algo, mode, compression]
 *   adata[1] = formatter  ("plaintext" | "markdown" | "syntaxhighlighting")
 *   adata[2] = open_discussion  (0 | 1)
 *   adata[3] = burn_after_reading  (0 | 1)
 *   adata[4] = base64 RSA-OAEP wrapped AES key (asymmetric mode only)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from 'zod';

// ── WIRE FORMAT (V2 ADATA TUPLE SCHEMA) ──────────────────────────────

export const AdataSpecSchema = z.tuple([
  z.string(),                            // iv        — base64 16-byte IV
  z.string(),                            // salt      — base64 8-byte salt
  z.number().int().min(100_000),         // iter      — PBKDF2 iterations (≥ 100 000)
  z.literal(256),                        // keySize   — AES-256
  z.literal(128),                        // tagSize   — GCM auth tag bits
  z.literal('aes'),                      // algo
  z.literal('gcm'),                      // mode
  z.union([z.literal('zlib'), z.literal('none')]), // compression
]);

export type AdataSpec = z.infer<typeof AdataSpecSchema>;

export const AdataSchema = z.tuple([
  AdataSpecSchema,                                         // adata[0] — spec
  z.enum(['plaintext', 'markdown', 'syntaxhighlighting']), // adata[1] — formatter
  z.union([z.literal(0), z.literal(1)]),                   // adata[2] — open_discussion
  z.union([z.literal(0), z.literal(1)]),                   // adata[3] — burn_after_reading
]).rest(z.string());                                        // adata[4] — optional RSA-OAEP key

export type AdataSchema = z.infer<typeof AdataSchema>;

// ── EXPIRY SCHEMAS & TIMERS ───────────────────────────────────────────

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

/** Maps expiry duration string to total seconds (null = never expires) */
export const EXPIRY_SECONDS: Record<Expiry, number | null> = {
  '5min':   5 * 60,
  '10min':  10 * 60,
  '1hour':  60 * 60,
  '1day':   24 * 60 * 60,
  '1week':  7 * 24 * 60 * 60,
  '1month': 30 * 24 * 60 * 60,
  'never':  null,
};

// ── PASTE API ENDPOINT SCHEMAS (POST, GET, PUT, DELETE) ────────────────

export const CreatePasteBodySchema = z.object({
  v: z.literal(2),
  ct: z.string().min(1),
  adata: AdataSchema,
  meta: z.object({
    expire: ExpirySchema,
    openDiscussion: z.boolean().optional().default(false),
    burnAfterReading: z.boolean().optional().default(true),
    maxViews: z.number().int().positive().optional(),
    timelockedUntil: z.string().datetime().optional(),
    shard: z.boolean().optional().default(false),
    shardIndex: z.number().int().min(1).optional(),
    shardTotal: z.number().int().min(2).optional(),
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

export const CreatePasteResponseSchema = z.object({
  pasteId: z.string().length(16),
  deleteToken: z.string(),
});

export type CreatePasteResponse = z.infer<typeof CreatePasteResponseSchema>;

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

export const DeletePasteQuerySchema = z.object({
  deleteToken: z.string().min(1),
});

export type DeletePasteQuery = z.infer<typeof DeletePasteQuerySchema>;

export const UpdatePasteBodySchema = z.object({
  v: z.literal(2),
  ct: z.string().min(1),
  adata: AdataSchema,
});

export type UpdatePasteBody = z.infer<typeof UpdatePasteBodySchema>;

// ── COMMENT API ENDPOINT SCHEMAS (POST, GET) ──────────────────────────

export const CreateCommentBodySchema = z.object({
  v: z.literal(2),
  ct: z.string().min(1),
  adata: AdataSchema,
  parentId: z.string().optional().default(''),
  icon: z.string().max(8).optional(),
});

export type CreateCommentBody = z.infer<typeof CreateCommentBodySchema>;

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

// ── COLLABORATION & AUTH SCHEMAS ─────────────────────────────────────

export const CollabAuthBodySchema = z.object({
  socket_id: z.string(),
  channel_name: z.string().regex(/^presence-collab-[0-9a-f]{16}$/),
});

export type CollabAuthBody = z.infer<typeof CollabAuthBodySchema>;

// ── API ERROR ENVELOPE SCHEMA ─────────────────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

# Module 09 — Technical Debt & Modernisation Guide

> Read when planning the modernisation. Lists every weakness and the recommended modern replacement.

---

## Known Weaknesses in PrivateBin v2.0.5

| Issue | Details |
|-------|---------|
| **Monolithic JS (6163 lines)** | Single IIFE file, no ES modules, no bundler, no tree-shaking |
| **Global namespace pollution** | `window.PrivateBin` global; internal classes only accessible via revealing module |
| **jQuery patterns remain** | Bootstrap 5.x is jQuery-free but some DOM manipulation mimics jQuery-era patterns |
| **PHP template engine** | `View.php` uses `extract()` + `include` — no autoescaping, no components, XSS risk if misused |
| **No PHP type safety** | Arrays-of-arrays everywhere; no DTOs, no typed models, no readonly properties |
| **Filesystem KV is fragile** | Traffic limiter / purge limiter use `require`/`include` of PHP files — OPcache interference in production |
| **Filesystem not atomic** | No atomic paste creation; race conditions possible under high load |
| **Multi-server session issues** | Traffic limiter is per-server — sticky sessions required in load-balanced setups |
| **No streaming** | File attachments base64-encoded inline in paste JSON — 10MB limit feels small |
| **Synchronous PHP** | No async handling; each request is blocking; no worker pools |
| **INI config has no schema** | No type validation on config values; wrong types silently ignored |
| **No CDN/asset pipeline** | JS/CSS served directly; cache busting via query string version only |
| **No API versioning** | API identified only by `v:2` in paste body — no route-based versioning |
| **Purge is synchronous** | Expired paste cleanup runs inline on create requests — adds latency |
| **Template switching via cookie** | `SameSite=Lax`; resets on browser restart if no persistent cookie storage |
| **No audit logging** | No server-side log of paste creation/deletion events (intentional for privacy, but limits ops) |
| **PHP WASM for compression** | Ships a WebAssembly binary for zlib — large JS payload; native `CompressionStream` API now available |

---

## Non-Negotiable Constraints for Any Modernisation

These must be preserved exactly — they define the security model:

1. **Client-side AES-256-GCM** via `window.crypto.subtle` — must not move to server
2. **PBKDF2-SHA256, >=100,000 iterations** — configurable but never below NIST minimum
3. **Key in URL fragment** — never sent to server, never logged anywhere
4. **v2 wire format compatibility** — `adata[0]` = `[iv, salt, iter, keySize, tagSize, 'aes', mode, compression]` — must remain parseable so existing PrivateBin URLs work in the new app
5. **Paste ID** = `fnv1a64(ciphertext)` as 16 lowercase hex chars
6. **Burn-after-reading atomicity** — delete paste in same DB transaction that returns ciphertext; cannot be two separate operations
7. **Delete token** = `HMAC-SHA256(pasteId, per-paste-salt)` — or stronger replacement
8. **Strict CSP** — `script-src 'self'`, no `'unsafe-inline'`; `connect-src *` for CDN-free operation

---

## Recommended Modern Stack

| Current (PrivateBin) | Modern Replacement |
|----------------------|--------------------|
| PHP 8.x + Composer | **Next.js 15** (API Routes, App Router) |
| Vanilla IIFE JS (6163 lines) | **TypeScript** with ES modules, Vite bundler |
| Bootstrap 5 | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives) |
| Google Prettify | **Shiki** (200+ languages, VS Code themes, WASM-based) |
| Showdown | **react-markdown** + **rehype-sanitize** |
| DOMPurify | **rehype-sanitize** (server-side safe) + DOMPurify for client runtime |
| PHP WASM zlib | **Native `CompressionStream` API** (no WASM payload) |
| Mocha + jsdom | **Vitest** (Vite-native, same Mocha-like API) |
| PHPUnit | **Vitest** (JS) + **Playwright** (E2E) |
| PHP file-based KV | **Upstash Redis** (rate limiting, ephemeral state) |
| Filesystem backend | **PostgreSQL** via Prisma (Neon serverless) |
| Manual SRI | **Vite** build-time asset fingerprinting + `integrity` attribute |
| INI config | **Zod-validated env vars** (`process.env` with schema) |
| PHP templates | **React Server Components** (RSC) for the shell; client components for crypto |

---

## Migration Task List

1. **Extract `CryptTool` as a pure TypeScript module** (`lib/crypto/cipher.ts`) with zero DOM/browser dependencies — testable in Node.js with `@peculiar/webcrypto`

2. **Run PBKDF2 in a Web Worker** — 100,000 iterations blocks the main thread for ~500ms; use `Comlink` for typed worker interface

3. **Replace PHP INI config** with Zod-parsed environment variables — single source of truth for TypeScript types

4. **Replace filesystem KV** (traffic_limiter, purge_limiter) with Upstash Redis sliding window rate limiter

5. **Add proper API versioning** — `/api/v1/paste`, `/api/v1/comment` (URL-based versioning)

6. **Add OpenAPI spec** — define all endpoints with Zod schemas; serve Swagger UI at `/api/docs`

7. **Replace synchronous purge** with a background job (Vercel Cron or BullMQ queue)

8. **Implement typed Prisma schema** — replace array-of-arrays with proper typed DB rows

9. **Replace Showdown** with `react-markdown` + `rehype-sanitize` — avoids client-side HTML parsing XSS surface

10. **Replace zlib WASM** with native `CompressionStream` API + fallback to `'none'` for old browsers

11. **Add E2E tests** — Playwright covering: create paste, burn-after-reading, password protection, delete

12. **Add OpenGraph / social preview** — server-rendered meta tags (title shows "Encrypted note", no content leak)

13. **Add Asymmetric Public-Key Mode** (`lib/crypto/asymmetric.ts`) — RSA-OAEP key wrapping via `SubtleCrypto.wrapKey/unwrapKey`; identity keypair stored in IndexedDB; GitHub username public key lookup; `lib/crypto/keystore.ts` for key persistence

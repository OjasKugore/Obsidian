# Obsidian — Implementation Plan (Revised)
**App Name:** `[PLACEHOLDER]` — to be decided (avoid "Obsidian" due to conflict with Obsidian.md)
**Deadline:** 25 August 2026 (4 days)
**Deploy:** Vercel + Neon (Vercel Postgres) + Upstash Redis + Pusher

---

## 📝 Decisions Log (from /grill-me)

| # | Decision | Answer |
|---|----------|--------|
| 1 | Infrastructure setup | All 4 services provisioned in Phase 1 (none set up yet) |
| 2 | Project location | `obsidian/` subfolder inside `PrivateBinRevamp/` |
| 3 | Default color mode | Dark mode default, light mode toggle available |
| 4 | Home page UX | Landing page IS the editor (PrivateBin-style, open and start typing) |
| 5 | Default paste behavior | Burn after reading (1 view, then deleted forever) |
| 6 | RSA keypair generation | Explicit opt-in: user clicks "Generate My Identity Key" |
| 7 | Identity key UI location | Header identity panel (key icon/avatar — opens settings modal) |
| 8 | RSA key size | RSA-2048 (faster, good enough for hackathon + short-lived pastes) |
| 9 | Private key exportability | Never downloadable — IndexedDB only, no export |
| 10 | Shamir ciphertext storage | Each shard row stores full ciphertext — any shard holder can be the collector |
| 11 | Editor | CodeMirror 6 + Shiki syntax highlighting + Markdown preview toggle |
| 12 | Pusher plan | Free tier (100 concurrent, 200k messages/day) |
| 13 | CRDT strategy | Yjs — Pusher is blind relay only |
| 14 | Abuse prevention | IP hash rate limiting via Upstash Redis (HMAC'd IPs, sliding window) |
| 15 | Password-protected mode | **Skipped** — Shamir + Asymmetric are better alternatives |
| 16 | Testing stack | Vitest (unit) + Playwright (E2E) |
| 17 | DB provisioning | Vercel Postgres (Neon under the hood, auto env vars) |
| 18 | Trust Visualizer timing | Phase 4 — built after core innovations are solid |
| 19 | App name | Placeholder — to be decided |

---

## Scope Decisions

### Priority Order
```
 HIGHEST  ███ Phase 1: Modernization + Infrastructure Setup (ALL 4 services)
          ███ Phase 2: Shamir SSS + Asymmetric RSA-OAEP  ← HIGHEST innovation priority
          ███ Phase 3: Real-Time E2EE Collaboration (Pusher + Yjs)
          ███ Phase 4: N-View, Time-Lock, UI Polish, Trust Visualizer, Extras
 LOWEST   ███ Phase 5: QA, Deploy, Demo Prep
```

### Must-Have Innovations (non-negotiable by priority)
1. 🔑 **Shamir's Secret Sharing** (k-of-n key splitting) — Phase 2
2. 🔐 **Asymmetric Public-Key Mode** (RSA-OAEP Key Wrapping) — Phase 2
3. 🔴 **Real-Time E2EE Collaboration** (Pusher + Yjs) — Phase 3
4. 💥 **N-View Self-Destruct** — Phase 4
5. ⏳ **Time-Locked Notes** — Phase 4

### Deferred / Nice-to-Have (Phase 4 if time allows)
- Paste Vault (encrypted collection)
- Cryptographic Receipt System (JWT)
- Trust Visualizer animation (with Symmetric + Recipient tabs)
- Paste Templates
- Command Palette
- Full OpenAPI / Swagger UI

> [!IMPORTANT]
> The security model is non-negotiable. All 8 constraints below must be satisfied in every phase — no shortcuts allowed.

---

## Two-Tier Encryption Architecture

> This is the canonical architecture for Obsidian's entire crypto system. All three key modes share the same AES-256-GCM encryption engine at Tier 1. Only the **key delivery mechanism** differs at Tier 2.

```
┌──────────────────────────────────────────────────┐
│             TIER 1 — ENCRYPTION ENGINE           │
│              Always AES-256-GCM                  │
│         (Encrypts the actual text/payload)       │
│                                                  │
│          Produces 32-byte AES Key (K)            │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│            TIER 2 — KEY MANAGEMENT TIER          │
└───────────────┬──────────────────────────────────┘
                │
       ┌────────┴──────────┐
       ▼                   ▼
┌─────────────────┐  ┌─────────────────────────────┐
│ SYMMETRIC MODES │  │      ASYMMETRIC MODE         │
│                 │  │                             │
│ 1. Direct Hash  │  │  RSA-OAEP Key Wrapping      │
│    Key in #hash │  │  • AES Key K wrapped with   │
│    1-click open │  │    recipient's RSA Public Key│
│                 │  │  • Only recipient's          │
│ 2. Shamir SSS   │  │    Private Key can unwrap K  │
│    K → k-of-n  │  │  • URL carries #asym         │
│    shards       │  │    (no key in fragment)      │
│    Quorum reqd  │  └─────────────────────────────┘
└─────────────────┘
```

---

## Innovation 5 — Asymmetric Public-Key Mode: RSA-OAEP Key Wrapping

### What it is
Instead of deriving a shared secret via key exchange (ECDH), Obsidian uses **RSA-OAEP Key Wrapping**:

1. **Sender inputs the recipient's RSA Public Key** (pasted as base64, loaded from GitHub username, or selected from contacts).
2. The **AES-256-GCM cipher runs normally** — the 32-byte AES Key $K$ is generated and used to encrypt the plaintext.
3. The AES Key $K$ is then **wrapped (encrypted) using RSA-OAEP** with the recipient's RSA Public Key:
   ```typescript
   const wrappedKey = await crypto.subtle.wrapKey(
     'raw',
     aesKey,                    // The 32-byte AES-256 Key K
     recipientRSAPublicKey,     // Recipient's RSA-2048 or RSA-4096 Public Key
     { name: 'RSA-OAEP' }
   );
   ```
4. The **RSA-OAEP wrapped key** (~256 bytes) is stored in `adata[4]`.
5. The URL fragment is simply `#asym` — **no decryption key in the URL at all**.
6. The **recipient opens the link**, the browser prompts for their RSA Private Key, unwraps $K$, and decrypts the ciphertext.

The server sees: ciphertext + RSA-wrapped AES key in `adata`. It cannot decrypt. Anyone intercepting the Slack link cannot read it without the recipient's RSA Private Key.

### Conflict Analysis

| Existing Innovation | Conflict? | Resolution |
|---|---|---|
| **N-View Self-Destruct** | ✅ None | Server-side counter is key-mode agnostic |
| **Time-Locked Notes** | ✅ None | `timelockedUntil` is server-enforced, orthogonal to key mode |
| **Shamir's Secret Sharing** | ⚠️ Mutually exclusive per paste | Shamir splits the AES key into shares; RSA mode wraps the AES key for one recipient. Cannot combine. **UI enforces**: selecting "Recipient Key" disables "Split Key" toggle |
| **Real-Time Collaboration** | ⚠️ Mutually exclusive per paste | Collab needs all participants to derive the same AES key from `#fragment`. RSA mode has no shared fragment key. **UI enforces**: asym pastes are read-only; "Collaborate" button hidden |
| **Cryptographic Receipt** | ✅ None | Server-side JWT, independent of key mode |
| **Trust Visualizer** | ✅ Enhancement | Two tabs: "Symmetric Mode" and "Recipient Mode" — stronger judge story |

### Wire Format Addition
`adata[4]` (new top-level field) carries the RSA-OAEP wrapped AES key:
```json
adata = [
  [iv, salt, iter, keySize, tagSize, 'aes', 'gcm', compression],  // adata[0] — spec (unchanged)
  "plaintext",                                                      // adata[1] — formatter
  0,                                                                // adata[2] — open_discussion
  0,                                                                // adata[3] — burn_after_reading
  "<base64 RSA-OAEP wrapped AES key>"                               // adata[4] — asym mode only
]
```
Backward-compatible: `adata[4]` is absent in standard symmetric pastes. Old parsers ignore unknown fields.

### New Files Required
- `lib/crypto/asymmetric.ts` — `generateRSAKeyPair()`, `wrapAESKey()`, `unwrapAESKey()`, `importRSAPublicKey()`, `importRSAPrivateKey()`
- `lib/crypto/keystore.ts` — `saveIdentityKey()`, `loadIdentityKey()`, `purgeKeys()` (IndexedDB-backed, **private key never exported**)
- `components/editor/RecipientKeyInput.tsx` — Public key input: paste raw base64, GitHub username lookup, or contacts dropdown
- `components/viewer/PrivateKeyUnlock.tsx` — Recipient's private key prompt with "Remember in session" toggle
- `components/header/IdentityPanel.tsx` — Header key icon → modal: "Generate My Identity Key" opt-in + "Copy My Public Key"
- `hooks/useAsymmetricEncryption.ts`

### Schema Addition
```prisma
recipientMode    Boolean @default(false)  // RSA-OAEP mode flag
```
(The RSA-wrapped AES key is stored inside `adata` JSON, so no extra DB column needed for the key itself.)

---

## Non-Negotiable Security Constraints

| # | Rule |
|---|------|
| 1 | **AES-256-GCM** — encryption runs in browser only via `SubtleCrypto` |
| 2 | **PBKDF2-SHA256 ≥ 100 k iterations** — runs in a Web Worker via Comlink |
| 3 | **Key stays in URL fragment (Symmetric modes)** — never sent to server, never logged; in RSA mode fragment is `#asym` only |
| 4 | **v2 wire format** — `adata[0]` = `[iv, salt, iter, keySize, tagSize, 'aes', 'gcm', compression]`; RSA-wrapped key in `adata[4]` |
| 5 | **Paste ID** = `fnv1a64(ciphertext)` as 16 lowercase hex chars |
| 6 | **Burn-after-reading is atomic** — `SELECT FOR UPDATE → DELETE → RETURN` in one DB transaction |
| 7 | **Delete token** = `HMAC-SHA256(pasteId, per-paste-salt)` |
| 8 | **Strict CSP** — `script-src 'self'`, no `unsafe-inline`, `connect-src *` |
| 9 | **RSA-OAEP key wrapping** — AES Key K wrapped client-side with SubtleCrypto; RSA private key never leaves the browser |

---

## Tech Stack

### Frontend
| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 15 (App Router, RSC) | Framework |
| TypeScript | 5.6 | Type safety |
| Tailwind CSS | v4 | Styling |
| shadcn/ui | latest | Component library (Radix primitives) |
| Framer Motion | 11 | Animations |
| CodeMirror | 6 | Editor with vim mode |
| Shiki | latest | Syntax highlighting (200+ langs) |
| react-markdown + rehype-sanitize | latest | Markdown rendering |
| qrcode.react | latest | QR code sharing |
| Comlink | latest | Typed Web Worker interface |
| base-x | latest | Base58 URL key encoding |
| secrets.js-grempe | latest | Shamir's Secret Sharing |
| Pusher JS | latest | Real-time collab (client) |

### Backend
| Library | Purpose |
|---------|---------|
| Next.js 15 API Routes (Edge Runtime) | REST endpoints |
| Prisma ORM | DB access |
| Neon (serverless PostgreSQL) | Primary data store |
| Upstash Redis + @upstash/ratelimit | Rate limiting |
| Pusher (server SDK) | Real-time relay |
| jose | JWT (receipt system) |
| Zod | API input validation |

---

## Project File Structure

```
obsidian/
├── app/
│   ├── layout.tsx                   # Root layout, CSP headers, dark-mode provider
│   ├── page.tsx                     # Landing + create paste
│   ├── [id]/page.tsx                # View / decrypt paste
│   ├── vault/
│   │   ├── page.tsx                 # Create vault (Phase 4)
│   │   └── [id]/page.tsx            # View vault (Phase 4)
│   └── api/v1/
│       ├── paste/route.ts           # POST create
│       ├── paste/[id]/route.ts      # GET read, DELETE
│       ├── paste/[id]/comment/route.ts
│       ├── vault/route.ts           # Phase 4
│       ├── vault/[id]/route.ts      # Phase 4
│       ├── collab/auth/route.ts     # Pusher channel auth
│       └── receipt/[id]/route.ts    # Phase 4
├── components/
│   ├── ui/                          # shadcn/ui base components
│   ├── editor/
│   │   └── PasteEditor.tsx          # CodeMirror 6, vim mode, templates
│   ├── viewer/
│   │   └── PasteViewer.tsx          # Decrypt + display, blur→clear animation
│   ├── crypto/
│   │   └── TrustVisualizer.tsx      # Animated encryption explainer (Phase 4)
│   ├── sharing/
│   │   └── SharePanel.tsx           # Copy URL, QR code, Shamir shard URLs
│   ├── collab/
│   │   └── CollabIndicator.tsx      # Live cursors, typing indicator (Phase 3)
│   └── layout/
│       └── CommandPalette.tsx       # Cmd+K palette (Phase 4)
├── lib/
│   ├── crypto/
│   │   ├── cipher.ts                # AES-256-GCM encrypt / decrypt — Tier 1 (zero DOM deps)
│   │   ├── kdf.ts                   # PBKDF2-SHA256 (called from Web Worker)
│   │   ├── compress.ts              # CompressionStream + 'none' fallback
│   │   ├── shamir.ts                # Shamir SSS key splitting — Tier 2 symmetric mode 2
│   │   ├── asymmetric.ts            # RSA-OAEP key wrap/unwrap — Tier 2 asymmetric mode
│   │   ├── keystore.ts              # IndexedDB-backed identity key persistence
│   │   └── encoding.ts             # base58, base64, fnv1a64
│   ├── api/
│   │   └── schemas.ts               # Zod schemas — single source of truth
│   ├── db/
│   │   └── prisma.ts                # Prisma client singleton
│   ├── rate-limit.ts                # Upstash Redis sliding window
│   ├── pusher.ts                    # Pusher server client singleton
│   └── security-headers.ts          # CSP builder
├── workers/
│   └── crypto.worker.ts             # Web Worker — PBKDF2 runs here
├── hooks/
│   ├── usePasteEncryption.ts
│   ├── usePasteDecryption.ts
│   ├── useAsymmetricEncryption.ts   # RSA-OAEP wrap/unwrap + key management
│   ├── useKeyboard.ts
│   └── useCollab.ts                 # Pusher presence + encrypted updates
├── prisma/
│   └── schema.prisma
├── tests/
│   ├── unit/
│   │   ├── cipher.test.ts
│   │   ├── kdf.test.ts
│   │   └── shamir.test.ts
│   └── e2e/
│       ├── create-paste.spec.ts
│       ├── burn-after-reading.spec.ts
│       └── shamir.spec.ts
├── docs/
│   └── adr/
│       ├── ADR-001-webcrypto.md
│       ├── ADR-002-neon-prisma.md
│       ├── ADR-003-shamir.md
│       ├── ADR-004-compressionstream.md
│       └── ADR-005-edge-runtime.md
├── next.config.ts                    # CSP headers
├── prisma/schema.prisma
└── playwright.config.ts
```

---

## Database Schema (Prisma)

```prisma
model Paste {
  id               String    @id              // fnv1a64(ciphertext), 16 hex chars
  ciphertext       String    @db.Text
  adata            Json
  createdAt        DateTime  @default(now())
  expiresAt        DateTime?
  burnAfterReading Boolean   @default(false)
  openDiscussion   Boolean   @default(false)
  salt             String                     // per-paste 512-hex salt (delete token)
  views            Int       @default(0)
  maxViews         Int?                       // N-view self-destruct
  timelockedUntil  DateTime?                  // Time capsule
  shard            Boolean   @default(false)  // Shamir shard flag
  shardIndex       Int?
  shardTotal       Int?
  recipientMode    Boolean   @default(false)  // Asymmetric mode flag ← NEW
  ephemeralPubKey  String?   @db.Text          // Ephemeral X25519 pub key ← NEW
  comments         Comment[]
  accessLog        AccessLog[]
}

model Comment {
  id         String   @id
  pasteId    String
  parentId   String
  ciphertext String   @db.Text
  adata      Json
  icon       String?
  createdAt  DateTime @default(now())
  paste      Paste    @relation(fields:[pasteId], references:[id], onDelete: Cascade)
}

model AccessLog {
  id         String   @id @default(cuid())
  pasteId    String
  ipHash     String                           // HMAC(ip, serverSalt)
  accessedAt DateTime @default(now())
  paste      Paste    @relation(fields:[pasteId], references:[id], onDelete: Cascade)
}

model ServerConfig {
  key   String @id
  value String
}
```

---

## Phase Breakdown

---

### Phase 1 — Modernization (Foundation)
**Day 1 (21 Aug) — 3 workstreams run in parallel, merge at end of day**

> [!IMPORTANT]
> Nothing builds on unstable foundations. This phase replaces every PrivateBin weakness (PHP, IIFE JS, filesystem KV, INI config) with the modern equivalents. No innovation features start until this is solid.

> [!NOTE]
> **Before anyone starts:** Member A must publish `lib/api/schemas.ts` (Zod types) and `prisma/schema.prisma` first (~30 min). These are the shared contracts C and B import. Everything else is fully parallel.

---

#### 🕒 Pre-Work (Member A — 30 min, blocks everyone else)
Before splitting:
1. `npx create-next-app@latest obsidian --typescript --app --tailwind --eslint --src-dir=false --import-alias='@/*'` — scaffold in `obsidian/`
2. Write `lib/api/schemas.ts` — Zod schemas (the API contract C calls and A implements)
3. Write `prisma/schema.prisma` — full schema with all fields (Shamir + RSA included)
4. Run `npx prisma generate` — generates the TypeScript client
5. Commit and push — B and C pull and start their workstreams

---

#### 👤 Member A — Infrastructure + Backend API
**Files owned: `prisma/`, `lib/db/`, `lib/rate-limit.ts`, `lib/security-headers.ts`, `lib/pusher.ts`, `app/api/`, `next.config.ts`**

Nobody else touches these files. Zero merge conflicts guaranteed.

##### Tasks
- [ ] Create Vercel project (link to `PrivateBinRevamp` repo, set root to `obsidian/`)
- [ ] Add **Vercel Postgres** via Vercel marketplace (auto-injects `DATABASE_URL`)
- [ ] Add **Upstash Redis** via Vercel marketplace (auto-injects `UPSTASH_REDIS_REST_URL/TOKEN`)
- [ ] Create free **Pusher** app at pusher.com (add `PUSHER_APP_ID/KEY/SECRET/CLUSTER` to Vercel env)
- [ ] Add `.env.local` template: `.env.example` committed with all required var names
- [ ] `lib/db/prisma.ts` — Prisma singleton (handles edge vs node runtime)
- [ ] Run `npx prisma migrate dev --name init` against Neon
- [ ] `lib/rate-limit.ts` — Upstash sliding window: 10 req/10s per HMAC'd IP
- [ ] `lib/security-headers.ts` — CSP builder (`script-src 'self'`, no `unsafe-inline`)
- [ ] `lib/pusher.ts` — Pusher server client singleton
- [ ] `next.config.ts` — apply CSP headers + Edge Runtime config
- [ ] `app/api/v1/paste/route.ts` — `POST /api/v1/paste` (create, rate-limited)
- [ ] `app/api/v1/paste/[id]/route.ts` — `GET` (read + time-lock check) + `DELETE` (token-validated, atomic burn)
- [ ] `app/api/v1/paste/[id]/comment/route.ts` — `POST` + `GET`
- [ ] `app/api/v1/collab/auth/route.ts` — Pusher channel auth stub (Phase 3 uses this; stub it now)

##### Files Created
```
obsidian/
├── prisma/schema.prisma                  [SHARED — do in pre-work]
├── lib/api/schemas.ts                    [SHARED — do in pre-work]
├── lib/db/prisma.ts
├── lib/rate-limit.ts
├── lib/security-headers.ts
├── lib/pusher.ts
├── next.config.ts
├── .env.example
└── app/api/v1/
    ├── paste/route.ts
    ├── paste/[id]/route.ts
    ├── paste/[id]/comment/route.ts
    └── collab/auth/route.ts
```

##### Verification (A-only)
```bash
curl -X POST http://localhost:3000/api/v1/paste \
  -H 'Content-Type: application/json' \
  -d '{"v":2,"ct":"abc","adata":[["iv","salt",100000,256,128,"aes","gcm","none"],"plaintext",0,0],"meta":{"expire":"never"}}'
# Expect: { pasteId: "...", deleteToken: "..." }
```

---

#### 👤 Member B — Crypto Engine (Pure TypeScript)
**Files owned: `lib/crypto/`, `workers/`, `tests/unit/`**

This is **zero browser/DOM deps** — pure TypeScript, testable in Node.js. No overlap with A or C.

##### Tasks
- [ ] `lib/crypto/encoding.ts`:
  - `fnv1a64(data: Uint8Array): string` — 16 hex chars for paste ID
  - `toBase58(bytes: Uint8Array): string` / `fromBase58(s: string): Uint8Array` — URL key encoding
  - `toBase64(bytes: Uint8Array): string` / `fromBase64(s: string): Uint8Array`
- [ ] `lib/crypto/compress.ts`:
  - `compress(data: Uint8Array): Promise<Uint8Array>` — CompressionStream ('deflate-raw')
  - `decompress(data: Uint8Array): Promise<Uint8Array>`
  - `tryCompress(data: Uint8Array): Promise<{ data: Uint8Array; method: 'zlib' | 'none' }>` — use 'none' if output is larger
- [ ] `lib/crypto/kdf.ts`:
  - `deriveKey(password: Uint8Array, salt: Uint8Array, iterations: number): Promise<CryptoKey>` — PBKDF2-SHA256 → AES-256-GCM key
  - **NOTE:** this will be called from the Web Worker, not directly from UI code
- [ ] `lib/crypto/cipher.ts` (the Tier 1 engine):
  - `encrypt(plaintext: string, password?: string): Promise<EncryptResult>`
    - Generates 16-byte random IV, 8-byte random salt
    - Compresses plaintext
    - Derives 32-byte AES key via PBKDF2 (100k iterations)
    - AES-256-GCM encrypts with `additionalData = JSON.stringify(adata)`
    - Returns `{ ciphertext: string, adata: AdataSchema, key: CryptoKey, rawKey: Uint8Array }`
  - `decrypt(ciphertext: string, adata: AdataSchema, key: CryptoKey): Promise<string>`
- [ ] `workers/crypto.worker.ts`:
  - Wraps `kdf.ts` via Comlink
  - Exposes: `{ deriveKey(password, salt, iterations): Promise<CryptoKey> }`
  - PBKDF2 must run here (blocks main thread ~500ms at 100k iterations)
- [ ] `tests/unit/cipher.test.ts` — encrypt → decrypt round-trip; wrong key fails; tampered `adata` fails
- [ ] `tests/unit/kdf.test.ts` — same password + salt = same key; different salt = different key
- [ ] `tests/unit/encoding.test.ts` — fnv1a64 known vectors; base58 round-trip

##### Interface Contract (what C imports from B)
```typescript
// lib/crypto/cipher.ts exports:
export async function encrypt(plaintext: string): Promise<EncryptResult>
export async function decrypt(ciphertext: string, adata: AdataSchema, key: CryptoKey): Promise<string>

export type EncryptResult = {
  ciphertext: string       // base64 AES-GCM ciphertext
  adata: AdataSchema       // the full adata array to POST to server
  rawKey: Uint8Array       // 32 bytes — goes in URL #fragment as base58
}
```
C imports only these — never touches internal `kdf.ts`, `compress.ts`, etc.

##### Files Created
```
obsidian/
├── lib/crypto/
│   ├── cipher.ts         ← PRIMARY export for C
│   ├── kdf.ts
│   ├── compress.ts
│   └── encoding.ts
├── workers/
│   └── crypto.worker.ts
└── tests/unit/
    ├── cipher.test.ts
    ├── kdf.test.ts
    └── encoding.test.ts
```

##### Verification (B-only)
```bash
cd obsidian && npx vitest run tests/unit/
# All 3 test files must pass
```

---

#### 👤 Member C — Next.js Scaffold + UI Shell
**Files owned: `app/layout.tsx`, `app/page.tsx`, `app/[id]/page.tsx`, `components/`, `hooks/`**

C sets up the entire Next.js shell and wires B's crypto to A's API. **C must not modify `lib/crypto/` or `app/api/`.**

##### Tasks
- [ ] Configure Tailwind v4 (`tailwind.config.ts`, `app/globals.css` with design tokens — dark navy, glassmorphism variables)
- [ ] Install and init shadcn/ui: `npx shadcn@latest init`
- [ ] Install Framer Motion, next-themes, Comlink, base-x, Geist fonts
- [ ] `app/layout.tsx` — root layout: dark/light theme provider (next-themes), Geist font, CSP nonce passthrough
- [ ] `app/page.tsx` — create paste page (landing = editor):
  - Textarea for paste content
  - Expiry dropdown (5min → never)
  - Default: burn after reading checkbox (checked by default)
  - Encrypt & Share button
  - **On submit**: calls `encrypt()` from `lib/crypto/cipher.ts`, then `POST /api/v1/paste`, then shows share URL with `#${base58(rawKey)}` appended
- [ ] `app/[id]/page.tsx` — view paste page:
  - Reads `pasteId` from `[id]` segment, reads `#fragment` key from URL
  - Calls `GET /api/v1/paste/[id]`, then calls `decrypt()` from `lib/crypto/cipher.ts`
  - Shows plaintext (basic `<pre>` for now)
- [ ] `hooks/usePasteEncryption.ts` — encapsulates: `encrypt()` + `POST /api/v1/paste` + share URL construction
- [ ] `hooks/usePasteDecryption.ts` — encapsulates: `GET /api/v1/paste/[id]` + `decrypt()` + error handling
- [ ] `components/editor/PasteEditor.tsx` — basic textarea, expiry select, submit button (no CodeMirror yet — that's Phase 4)
- [ ] `components/viewer/PasteViewer.tsx` — basic `<pre>` content display with copy button
- [ ] `components/sharing/SharePanel.tsx` — basic: copy URL to clipboard, show QR placeholder
- [ ] `components/ui/` — install necessary shadcn components: `button`, `input`, `select`, `dialog`, `tooltip`

> [!NOTE]
> While waiting for B to finish, C can stub crypto calls:
> ```typescript
> // stub in hooks — replace with real import once B pushes
> const encrypt = async (text: string) => ({ ciphertext: 'STUB', adata: [], rawKey: new Uint8Array(32) })
> ```

##### Files Created
```
obsidian/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              ← Landing = Editor
│   ├── globals.css           ← design tokens
│   └── [id]/page.tsx
├── components/
│   ├── ui/                   ← shadcn/ui base
│   ├── editor/PasteEditor.tsx
│   ├── viewer/PasteViewer.tsx
│   └── sharing/SharePanel.tsx
└── hooks/
    ├── usePasteEncryption.ts
    └── usePasteDecryption.ts
```

##### Verification (C-only)
```bash
cd obsidian && npm run dev
# Open localhost:3000 — editor renders, no console errors
# With A's server + B's crypto merged: full encrypt → POST → GET → decrypt works
```

---

#### 🔄 Merge Checklist (end of Day 1)

Run in order after all three push their branches:

```bash
# 1. Merge A first (API + DB is the foundation)
git merge feature/phase1-infra
npx prisma generate   # regenerate client if schema changed

# 2. Merge B (pure TS, no conflicts with A)
git merge feature/phase1-crypto
npx vitest run tests/unit/   # all unit tests must pass

# 3. Merge C (UI wires into both A and B)
git merge feature/phase1-ui

# 4. Integration smoke test
npm run dev
# Create paste → URL shows → decrypt works → burn-after-reading returns 404 on second view

# 5. Rate limit test
for i in {1..12}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/paste -H 'Content-Type: application/json' -d '{...}'; done
# Expect: first 10 return 200, 11th+ return 429
```

#### ⚠️ Shared Files (only A touches these — B and C import only)
| File | Owner | B imports | C imports |
|------|-------|-----------|----------|
| `lib/api/schemas.ts` | A (pre-work) | Types only | Types only |
| `prisma/schema.prisma` | A (pre-work) | — | — |
| `lib/crypto/cipher.ts` | B | — | `encrypt`, `decrypt`, `EncryptResult` |
| `lib/crypto/encoding.ts` | B | — | `toBase58`, `fromBase58` |

---

#### Phase 1 Completion Criteria
- [ ] `vitest run tests/unit/` — all pass (B)
- [ ] `curl POST /api/v1/paste` → `{ pasteId, deleteToken }` (A)
- [ ] Create paste in browser, URL has `#key`, navigating to it decrypts correctly (A+B+C)
- [ ] Third open of a burn-after-reading paste returns 404 (A)
- [ ] Rate limiter blocks 11th request in 10s window (A)
- [ ] `npm run build` — no TypeScript errors (C)

---

### Phase 2 — Shamir's Secret Sharing + Asymmetric RSA-OAEP 🔑
**Day 2 (22 Aug) — Target: Both highest-priority innovations fully working end-to-end**

> [!IMPORTANT]
> These are the two crown jewels of Obsidian's security model. Both ship in this phase before any UI polish.

#### Goals — Part A: Shamir's Secret Sharing
- `lib/crypto/shamir.ts` wrapper around `secrets.js-grempe`
- **Split Key UI** in `PasteEditor.tsx`: threshold $K$ slider, total shards $N$ slider
- On submit: AES Key $K$ split into $N$ shards via `secrets.share()`; each shard creates **one paste row** (`shard: true`, `shardIndex`, `shardTotal`)
- **Share Panel** displays $N$ separate shard URLs
- **Reconstruction UI**: on viewing a shard URL, show "🔒 Shard X of N loaded, need Y more"; input box to paste additional shard strings; `secrets.combine()` runs in browser; decrypt ciphertext
- Unit tests for `shamir.ts`: split → reconstruct round-trip
- E2E test: (k=2, n=3) — shard 1 alone fails; shards 1+2 succeed

#### Goals — Part B: Asymmetric RSA-OAEP Key Wrapping
- `lib/crypto/asymmetric.ts`: `generateRSAKeyPair()`, `wrapAESKey()`, `unwrapAESKey()`, `importRSAPublicKey()`, `importRSAPrivateKey()`
- `lib/crypto/keystore.ts`: `saveIdentityKey()`, `loadIdentityKey()`, `purgeKeys()` backed by IndexedDB
- **Identity Key Bootstrap**: on first Obsidian visit, generate RSA-2048 OAEP keypair; save to IndexedDB; show "📋 Copy My Public Key" button
- **Recipient Key Input** in `PasteEditor.tsx`: 
  - Paste raw base64 public key
  - Type `github:<username>` → fetch from `https://github.com/<username>.keys`
  - Select from saved contacts (browser localStorage)
- **Create flow**: AES-256-GCM runs normally (Tier 1 unchanged); `SubtleCrypto.wrapKey('raw', aesKey, recipientRSAPub, {name:'RSA-OAEP'})` → wrapped key stored in `adata[4]`; URL = `...#asym`
- **View flow**: browser detects `#asym` sentinel; shows `PrivateKeyUnlock.tsx` prompt; `SubtleCrypto.unwrapKey()` → non-exportable AES key → decrypt
- **"Remember in session" toggle**: private key stored in `sessionStorage` only (wiped on tab close)
- **Mutual exclusion** enforced in UI: selecting "Recipient Key" disables "Split Key", and vice versa
- Unit tests for `asymmetric.ts`: wrap → unwrap round-trip

#### Files Created / Modified
- `[NEW] lib/crypto/shamir.ts`
- `[NEW] lib/crypto/asymmetric.ts`
- `[NEW] lib/crypto/keystore.ts`
- `[MODIFY] lib/api/schemas.ts` — add `shardIndex`, `shardTotal`, `recipientMode` to Zod schema
- `[MODIFY] app/api/v1/paste/route.ts` — handle shard creation + RSA mode flag
- `[MODIFY] components/editor/PasteEditor.tsx` — Split Key panel + Recipient Key panel
- `[NEW] components/editor/RecipientKeyInput.tsx` — public key input + GitHub lookup
- `[MODIFY] components/sharing/SharePanel.tsx` — Shamir shard URL list
- `[MODIFY] components/viewer/PasteViewer.tsx` — shard quorum UI + RSA unlock prompt
- `[NEW] components/viewer/ShardQuorumPanel.tsx` — shard collection + combine UI
- `[NEW] components/viewer/PrivateKeyUnlock.tsx` — RSA private key prompt
- `[NEW] hooks/useAsymmetricEncryption.ts`
- `[NEW] tests/unit/shamir.test.ts`
- `[NEW] tests/unit/asymmetric.test.ts`
- `[NEW] tests/e2e/shamir.spec.ts`

#### Verification
```bash
vitest run tests/unit/shamir.test.ts
vitest run tests/unit/asymmetric.test.ts
npx playwright test tests/e2e/shamir.spec.ts
```
- Shamir (k=2, n=3): shard 1 alone → quorum panel; shards 1+2 → full decrypt ✔️
- RSA: wrap AES key with pub key → store in `adata[4]` → unwrap with private key → same plaintext ✔️
- Posting asymmetric link in Slack (no `#key`): opening without private key shows lock screen ✔️

---

### Phase 3 — Real-Time E2EE Collaboration
**Day 3 (23 Aug) — Target: Live collaborative editing over encrypted WebSocket**

#### Goals
- **Pusher presence channel** per paste (`presence-collab-{pasteId}`)
- Server-side auth endpoint `POST /api/v1/collab/auth` (rate-checked, paste-existence verified, zero-knowledge)
- `lib/pusher.ts` singleton
- **Yjs CRDT integration** for conflict-free real-time merging:
  - CodeMirror 6 bound to a `Y.Doc`
  - `Y.encodeStateAsUpdate()` → `Uint8Array` delta
  - Delta **AES-256-GCM encrypted** in browser before Pusher send
  - Delta decrypted on receive → `Y.applyUpdate()` → editor updates
- **Encrypted awareness** (cursor positions) — also AES-encrypted before Pusher send
- `CollabIndicator.tsx`: live avatar badges, typing indicator, collaborator count
- `useCollab.ts` hook: Pusher subscription lifecycle, encrypted send/receive
- **Debounced auto-save**: every 5s of inactivity, full doc re-encrypted and PUT to DB
- **"Lock & Finalize" button**: disconnects WebSocket, seals paste
- **Mutual exclusion**: Collaborate button hidden on asymmetric pastes
- Storybook stories for `PasteEditor`, `PasteViewer`, `SharePanel`, `CollabIndicator`

#### Files Created / Modified
- `[NEW] app/api/v1/collab/auth/route.ts`
- `[NEW] lib/pusher.ts`
- `[NEW] components/collab/CollabIndicator.tsx`
- `[NEW] hooks/useCollab.ts`
- `[MODIFY] components/editor/PasteEditor.tsx` — Yjs + CodeMirror binding
- `[NEW] .storybook/` + stories
- `[NEW] tests/e2e/collab.spec.ts`

#### Verification
- Open same URL in two browser tabs → type in one → text appears in other within <50ms ✔️
- Open Pusher debug console → confirm only encrypted blobs visible (no plaintext) ✔️
- Asymmetric paste → Collaborate button is hidden ✔️

---

### Phase 4 — Premium UI + Remaining Innovations
**Day 3–4 (23–24 Aug) — Target: polished, judge-ready product**

> [!NOTE]
> This phase is time-boxed. Do highest judge-impact items first.

**Priority order within this phase:**
1. **Premium design system** — deep navy palette, glassmorphism, glow effects, Geist fonts, Framer Motion animations throughout
2. **N-View Self-Destruct** — `maxViews` param; atomic `views >= maxViews` delete in DB transaction; "views remaining" counter in UI
3. **Time-Locked Notes** — `timelockedUntil` field; server enforces in GET; pulsing padlock + countdown timer in UI
4. **Trust Visualizer** — `TrustVisualizer.tsx`; Framer Motion step-by-step diagram; two tabs: Symmetric vs Recipient Mode
5. **Keyboard / Command Palette** — `Cmd+K`; `Ctrl+Enter` = submit; `Ctrl+C` = copy URL; `Esc` = reset
6. **Paste Templates** — API Key, SSH Key, Medical Info, Emergency Contact, Interview Feedback
7. **Paste Vault** — encrypted collection of paste IDs; `app/vault/`, `/api/v1/vault/`
8. **Cryptographic Receipt** — ES256 JWT on burn-after-reading; `/.well-known/receipt-key.json`
9. **OpenAPI / Swagger UI** — `zod-to-openapi`, Swagger UI at `/api/docs`
10. **ADR documentation** — 5 Architecture Decision Records

#### Files Created / Modified
- `[MODIFY] app/page.tsx` — full premium landing + editor
- `[MODIFY] app/[id]/page.tsx` — full viewer with animations
- `[NEW] app/layout.tsx` — Framer Motion, next-themes, CSP
- `[MODIFY] app/api/v1/paste/[id]/route.ts` — N-view atomicity, time-lock check
- `[NEW] components/crypto/TrustVisualizer.tsx`
- `[NEW] components/layout/CommandPalette.tsx`
- `[NEW] hooks/useKeyboard.ts`
- `[NEW] app/vault/`, `[NEW] app/vault/[id]/`
- `[NEW] app/api/v1/vault/route.ts`, `[NEW] app/api/v1/vault/[id]/route.ts`
- `[NEW] app/api/v1/receipt/[id]/route.ts`
- `[NEW] app/api/docs/` — Swagger UI page
- `[NEW] docs/adr/*.md` — ADR-001 through ADR-006
- `[MODIFY] README.md` — full writeup per documentation rubric
- `[NEW] docs/SECURITY.md`

#### Verification
- Create paste with `maxViews: 2`; open 3 times; third → 404 ✔️
- Time-lock: open before `T` → pulsing padlock; open after `T` → decrypts ✔️
- Burn-after-reading: open → deleted; reload → 404 ✔️

---

### Phase 5 — Final QA, Performance & Demo Prep
**Day 4 afternoon → 25 Aug — Target: live Vercel deploy, demo rehearsed**

#### Goals
- **Deploy to Vercel** with env vars: `DATABASE_URL` (Neon), `UPSTASH_REDIS_REST_URL/TOKEN`, `PUSHER_*`
- **Lighthouse CI** — target LCP < 1.2s, CLS < 0.1, INP < 100ms; JS bundle < 150 KB gzip
- **OpenGraph meta tags** on all pages — `<title>Obsidian — Encrypted Note</title>`, no content leak
- **Security headers audit** — CSP, X-Frame-Options, COEP, CORP, Referrer-Policy all correct in production
- **Vercel Cron Job** for expired paste purge (replaces synchronous purge on create)
- **Full test suite** one final run
- **Rehearse 5-min demo script**:
  - `0:00` Trust Visualizer + landing
  - `0:40` Create paste (API key, burn after 1 view, syntax highlight)
  - `1:20` Asymmetric Mode: paste Alice's public key → create → open in incognito without private key → lock screen; unlock with private key
  - `2:05` Shamir (k=2, n=3): shard 1 alone → quorum panel; shards 1+2 → decrypt
  - `2:50` Time-lock countdown → unlock
  - `3:35` Real-time collab: side-by-side tabs, live edits
  - `4:15` Swagger `/api/docs` live POST
  - `4:45` Mobile DevTools responsive check

#### Verification Commands
```bash
# Unit tests
vitest run

# E2E tests against production URL
PLAYWRIGHT_BASE_URL=https://obsidian.vercel.app npx playwright test

# Bundle size
npx next build && npx @next/bundle-analyzer
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| LCP | < 1.2s |
| INP | < 100ms |
| CLS | < 0.1 |
| Encrypt + submit | < 500ms |
| Decrypt on view | < 300ms |
| JS bundle (gzip) | < 150 KB |
| API latency | < 100ms |

---

## Scoring Map

| Rubric | Target | Covered In |
|--------|--------|------------|
| §1 Problem Understanding (20) | **20/20** | Phase 1+2 — all core crypto guarantees; Shamir + RSA-OAEP prove deep crypto understanding |
| §2 Innovation (20) | **18–20/20** | Phase 2 (Shamir, Asym) + Phase 3 (Collab) + Phase 4 (N-view, Time-lock, Trust Vis, etc.) |
| §3 Technical Architecture (15) | **14–15/15** | Phase 1 — TypeScript, Zod, Prisma, Web Worker, Edge Runtime, RSA-OAEP via SubtleCrypto |
| §4 UX & Accessibility (15) | **14–15/15** | Phase 4 — WCAG 2.1 AA, Framer Motion, dark mode, mobile-first |
| §5 Performance & Demo (20) | **18–20/20** | Phase 5 — live Vercel, Lighthouse, 5-min demo script |
| §6 Documentation (10) | **10/10** | Phase 4 — README, SECURITY.md, ADRs, Storybook, OpenAPI |
| **Total** | **94–100** | |

---

## Open Questions

> [!IMPORTANT]
> Please confirm before Phase 2 begins:
> - **Neon DB URL** — do you have a Neon project or should I include setup steps in Phase 1?
> - **Upstash Redis credentials** — same question: existing account or new setup?
> - **Pusher credentials** — needed for Phase 3 (App ID, Key, Secret, Cluster)

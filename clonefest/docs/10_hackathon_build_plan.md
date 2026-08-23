# Module 10 — Hackathon Build Plan (Maximum Score Blueprint)

> **Context:** Competitive hackathon judged on 6 rubrics worth 100 marks.
> Goal: understand the core problem → build a meaningfully better modern solution → score maximum.

---

## Rubric Map — How to Win Each Category

| Category | Marks | Strategy |
|----------|-------|----------|
| Problem Understanding & Core Functionality | 20 | Deep zero-knowledge model + go beyond text pastes |
| Innovation & Meaningful Differentiation | 20 | 10 novel features PrivateBin doesn't have |
| Technical Implementation & Architecture | 15 | Modern typed stack, Zod, OpenAPI, E2E tests |
| User Experience & Accessibility | 15 | WCAG 2.1 AA, animations, mobile-first, dark mode |
| Performance & Reliability / Demo Quality | 20 | <1.2s LCP, live Vercel deploy, 5-min demo script |
| Documentation & Explanation | 10 | README + ADRs + Storybook + OpenAPI/Swagger |

---

## The Product — "Obsidian"

**Tagline:** *Your secrets, encrypted by you, invisible to us.*

**Elevator pitch:** Every note is encrypted inside your browser before it touches the network. The server stores only unreadable ciphertext — not even the server operator can read what you shared.

**Key differentiators from PrivateBin:**
- Feels like a premium product, not a developer tool
- Real-time E2E encrypted collaboration
- Structured vaults (no accounts needed)
- Richer access control (Asymmetric Public-Key mode, Shamir key splitting, time-locks, N-view self-destruct)
- Full mobile experience
- Trust Visualizer: animated diagram that explains the crypto to non-technical users

---

## Tech Stack (Exact Versions)

### Frontend
```
Next.js 15 (App Router, RSC)     — framework
TypeScript 5.6                    — type safety
Tailwind CSS v4                   — styling
shadcn/ui (latest)                — component library (Radix primitives)
Framer Motion 11                  — animations
lucide-react                      — icons
next-themes                       — dark mode
React Hook Form + Zod             — form validation
CodeMirror 6                      — code editor with vim mode
Shiki                             — syntax highlighting (200+ languages)
react-markdown + rehype-sanitize  — markdown rendering
qrcode.react                      — QR code generation
```

### Backend
```
Next.js 15 API Routes             — REST endpoints (Edge Runtime)
Prisma ORM + PostgreSQL (Neon)    — primary data store
@upstash/redis + @upstash/ratelimit — rate limiting
jose                              — JWT signing for receipts
zod                               — API input validation
```

### Crypto (Client-side only)
```
Web Crypto API (SubtleCrypto)    — AES-256-GCM, PBKDF2, RSA-OAEP key wrapping
native CompressionStream API     — replaces WASM zlib
secrets.js-grempe                — Shamir's Secret Sharing
base-x                           — base58 URL key encoding
Comlink                          — typed Web Worker interface for PBKDF2
```

### Dev & Quality
```
Vitest + @testing-library/react  — unit + component tests
Playwright                       — E2E tests
Storybook 8                      — component documentation
ESLint 9 + Prettier              — code quality
Husky + lint-staged              — pre-commit hooks
GitHub Actions                   — CI/CD
```

### Deployment
```
Vercel                           — hosting (Edge Network, zero cold starts)
Neon                             — serverless PostgreSQL
Upstash Redis                    — rate limiting + ephemeral KV
```

---

## Database Schema (Prisma / PostgreSQL)

```prisma
model Paste {
  id               String    @id              // 16 hex chars (fnv1a64 of ciphertext)
  ciphertext       String    @db.Text         // base64 AES-256-GCM ciphertext
  adata            Json                       // authenticated metadata
  createdAt        DateTime  @default(now())
  expiresAt        DateTime?                  // null = never
  burnAfterReading Boolean   @default(false)
  openDiscussion   Boolean   @default(false)
  salt             String                     // per-paste 512-hex salt for delete token
  views            Int       @default(0)
  maxViews         Int?                       // INNOVATION: N-view self-destruct
  timelockedUntil  DateTime?                  // INNOVATION: time capsule
  shard            Boolean   @default(false)  // INNOVATION: Shamir shard flag
  shardIndex       Int?
  shardTotal       Int?
  recipientMode    Boolean   @default(false)  // INNOVATION: RSA-OAEP asymmetric mode flag
  ephemeralPubKey  String?   @db.Text          // Ephemeral public key for ECDH shared secret derivation
  comments         Comment[]
  accessLog        AccessLog[]
}

model Comment {
  id         String   @id
  pasteId    String
  parentId   String
  ciphertext String   @db.Text
  adata      Json
  icon       String?  // data URI for commenter avatar
  createdAt  DateTime @default(now())
  paste      Paste    @relation(fields:[pasteId], references:[id], onDelete: Cascade)
}

model AccessLog {
  id         String   @id @default(cuid())
  pasteId    String
  ipHash     String   // HMAC(ip, serverSalt) — no raw IPs
  accessedAt DateTime @default(now())
  paste      Paste    @relation(fields:[pasteId], references:[id], onDelete: Cascade)
}

model ServerConfig {
  key   String @id   // 'salt', 'receiptPrivateKey', etc.
  value String
}
```

---

## Core Features (§1 — Problem Understanding)

| Feature | Implementation |
|---------|---------------|
| Client-side AES-256-GCM | `SubtleCrypto.encrypt()`, PBKDF2-SHA256, 100k iterations |
| Key in URL fragment | 32 random bytes → base58 → `#fragment`, never sent to server |
| Password protection | Password bytes appended to random key before PBKDF2 |
| Expiry options | 5min, 10min, 1h, 1d, 1w, 1mo, 1yr, never |
| Burn after reading | Atomic: DELETE then RETURN in one DB transaction |
| Encrypted comments | Same AES-256-GCM pipeline, flat adata array |
| Syntax highlighting | Shiki (200+ languages, VS Code themes) |
| Markdown rendering | react-markdown + rehype-sanitize |
| File attachments | Encrypted inline as base64 within the paste JSON |
| QR code sharing | qrcode.react |
| Delete token | HMAC-SHA256(pasteId, per-paste-salt) |
| Rate limiting | Upstash Redis sliding window per IP hash |

---

## Innovation Features (§2 — 20 marks)

### INNOVATION 1: N-View Self-Destruct
PrivateBin only supports "burn after 1 read". Obsidian supports destroy after 1, 5, 10, or N views.
- Server increments `views` atomically; when `views >= maxViews`, deletes paste
- UI shows live "views remaining" counter

### INNOVATION 2: Time-Locked Notes (Time Capsule)
- Paste uploaded encrypted but server refuses to return ciphertext until `timelockedUntil`
- Server enforces; key still only in URL — server still cannot decrypt
- UI: pulsing padlock + countdown clock

### INNOVATION 3: Shamir's Secret Sharing (Key Splitting)
- k-of-n threshold key splitting via `secrets.js-grempe`
- Each shard = separate paste row; shard flag = true
- Reconstruction entirely client-side; server sees at most 1 shard
- UI: "Split Key" mode shows n shareable URLs

### INNOVATION 4: Real-Time E2E Encrypted Collaboration
- Two users on same URL see each other's edits live
- WebSocket relay (Pusher/Vercel KV) sees only ciphertext
- Both derive same AES key from `#fragment`
- UI: live cursor, typing indicator

### INNOVATION 5: Asymmetric Public-Key Mode (RSA-OAEP Key Wrapping)
- Sender inputs recipient's RSA Public Key (paste base64, GitHub lookup `github:<username>`, or contacts)
- Browser generates 32-byte AES Key K normally (Tier 1 encryption unchanged)
- AES Key K is wrapped via `SubtleCrypto.wrapKey('raw', aesKey, recipientRSAPublicKey, { name: 'RSA-OAEP' })`
- RSA-OAEP wrapped key (~256 bytes) stored in `adata[4]`
- URL fragment is `#asym` only — no decryption key in URL
- Recipient's browser: `SubtleCrypto.unwrapKey()` with their RSA Private Key → AES Key K recovered → plaintext decrypted
- Safe against Slack link leaks, clipboard sniffers, corporate logging, and misdirected messages
- Mutually exclusive with Shamir SSS and Real-Time Collab (per-paste UI toggle)

### INNOVATION 6: Paste Vault (Encrypted Collection)
- Master paste whose ciphertext IS a list of paste IDs + labels
- No accounts: vault URL = identity
- Server sees zero structure

### INNOVATION 7: Cryptographic Receipt System
- On burn-after-reading view: server signs `hash(pasteId + timestamp + ipHash)` with ES256 private key
- Receipt returned as JWT in response headers
- Sender can verify paste was opened exactly once at `/.well-known/receipt-key.json`

### INNOVATION 8: Trust Visualizer (UX Innovation)
- Animated step-by-step diagram of the encryption flow
- Each step revealed with Framer Motion; tabs for Symmetric Mode vs Recipient Mode; hover "ciphertext" to see real example
- Most impactful UI for judges — proves deep understanding of the problem

### INNOVATION 9: Keyboard-First / Command Palette
- `Ctrl+Enter` = submit, `Ctrl+C` = copy URL, `Esc` = reset
- `Cmd+K` = command palette with all actions
- CodeMirror 6 vim mode option

### INNOVATION 10: Paste Templates
- API Key Sharing, SSH Key, Medical Info, Emergency Contact, Interview Feedback
- Pre-fill editor with a structured prompt; still fully encrypted

### INNOVATION 11: API-First with OpenAPI Spec
- Swagger UI at `/api/docs`
- All endpoints documented with Zod-derived schemas
- curl examples in docs

---

## Architecture (§3)

```
Browser (Client)
├── Next.js App (RSC shell)
├── CryptoModule (TypeScript, DOM-free)
│   ├── lib/crypto/cipher.ts      — AES-256-GCM encrypt/decrypt  [TIER 1 — always runs]
│   ├── lib/crypto/kdf.ts         — PBKDF2-SHA256 (runs in Web Worker)
│   ├── lib/crypto/asymmetric.ts  — RSA-OAEP wrapKey / unwrapKey [TIER 2 — asym mode]
│   ├── lib/crypto/keystore.ts    — IndexedDB identity key persistence
│   ├── lib/crypto/compress.ts    — CompressionStream with fallback
│   ├── lib/crypto/shamir.ts      — Shamir SSS                   [TIER 2 — split mode]
│   └── lib/crypto/encoding.ts    — base58, base64, fnv1a64
├── API Client (typed, Zod-validated)
└── UI Components (shadcn/ui + custom)
    ├── components/editor/RecipientKeyInput.tsx   — RSA pub key input + GitHub lookup
    ├── components/viewer/PrivateKeyUnlock.tsx    — RSA private key prompt
    └── components/crypto/TrustVisualizer.tsx

Next.js API Routes (Edge Runtime)
├── POST   /api/v1/paste           — create paste
├── GET    /api/v1/paste/[id]      — read paste
├── DELETE /api/v1/paste/[id]      — delete paste (with deletetoken)
├── POST   /api/v1/paste/[id]/comment
├── GET    /api/v1/paste/[id]/comment
├── POST   /api/v1/vault           — create vault
├── GET    /api/v1/vault/[id]      — read vault
└── GET    /api/v1/receipt/[id]    — verify receipt JWT

Infrastructure
├── Neon PostgreSQL (serverless, auto-scale)
├── Upstash Redis (rate limiting, sliding window)
├── Vercel Edge Network
└── GitHub Actions CI/CD
```

### Key Architectural Decisions
1. **Edge Runtime** — zero cold starts, globally distributed
2. **Zod schemas** — single source of truth for API types + TypeScript inference
3. **Crypto module zero DOM deps** — testable in Node.js with `@peculiar/webcrypto`
4. **PBKDF2 in Web Worker** — 100k iterations blocks main thread ~500ms; use Comlink
5. **RSC shell** — CSP headers + SEO in server components; crypto in client components
6. **Optimistic UI** — create paste feels instant

---

## Project File Structure

```
obsidian/
├── app/
│   ├── layout.tsx              — root layout, CSP, dark mode provider
│   ├── page.tsx                — landing / create paste
│   ├── [id]/page.tsx           — view paste
│   ├── vault/
│   │   ├── page.tsx            — create vault
│   │   └── [id]/page.tsx       — view vault
│   └── api/v1/
│       ├── paste/route.ts      — POST create
│       ├── paste/[id]/route.ts — GET read, DELETE
│       ├── paste/[id]/comment/route.ts
│       ├── vault/route.ts
│       ├── vault/[id]/route.ts
│       └── receipt/[id]/route.ts
├── components/
│   ├── ui/                     — shadcn/ui base
│   ├── editor/PasteEditor.tsx  — CodeMirror 6 + vim
│   ├── viewer/PasteViewer.tsx  — decrypt + display
│   ├── crypto/TrustVisualizer.tsx  — animated diagram ← KEY COMPONENT
│   ├── sharing/SharePanel.tsx  — copy, QR, Shamir shards
│   └── layout/CommandPalette.tsx
├── lib/
│   ├── crypto/cipher.ts        — encrypt/decrypt  [Tier 1 — always runs]
│   ├── crypto/kdf.ts           — PBKDF2
│   ├── crypto/compress.ts      — CompressionStream
│   ├── crypto/shamir.ts        — Shamir SSS key splitting  [Tier 2]
│   ├── crypto/asymmetric.ts    — RSA-OAEP wrapKey/unwrapKey  [Tier 2]
│   ├── crypto/keystore.ts      — IndexedDB identity key persistence
│   ├── crypto/encoding.ts      — base58, base64, fnv1a64
│   ├── api/schemas.ts          — Zod schemas (API + TypeScript types)
│   ├── db/prisma.ts            — Prisma client singleton
│   ├── rate-limit.ts           — Upstash Redis
│   └── security-headers.ts    — CSP builder
├── workers/
│   └── crypto.worker.ts        — Web Worker for PBKDF2
├── hooks/
│   ├── usePasteEncryption.ts
│   ├── usePasteDecryption.ts
│   ├── useAsymmetricEncryption.ts  — RSA-OAEP key management
│   ├── useCollab.ts                — Pusher + encrypted Yjs deltas
│   └── useKeyboard.ts
├── tests/
│   ├── unit/cipher.test.ts
│   ├── unit/kdf.test.ts
│   ├── unit/shamir.test.ts
│   ├── unit/asymmetric.test.ts
│   └── e2e/
│       ├── create-paste.spec.ts
│       ├── burn-after-reading.spec.ts
│       ├── shamir.spec.ts
│       └── collab.spec.ts
├── prisma/schema.prisma
├── next.config.ts              — CSP headers
└── playwright.config.ts
```

---

## API Zod Schemas

```typescript
// POST /api/v1/paste
const CreatePasteSchema = z.object({
  v: z.literal(2),
  ct: z.string().min(1),
  adata: z.tuple([
    z.tuple([
      z.string().max(24),   // iv (base64)
      z.string().max(14),   // salt (base64)
      z.number().int().min(10001),
      z.union([z.literal(128), z.literal(192), z.literal(256)]),
      z.union([z.literal(64), z.literal(96), z.literal(128)]),
      z.literal('aes'),
      z.union([z.literal('gcm'), z.literal('ctr'), z.literal('cbc')]),
      z.union([z.literal('zlib'), z.literal('none')]),
      // NOTE: adata[0] always exactly 8 elements (RSA wrapped key goes in adata[4], NOT here)
    ]),
    z.enum(['plaintext', 'syntaxhighlighting', 'markdown']),
    z.union([z.literal(0), z.literal(1)]),
    z.union([z.literal(0), z.literal(1)]),
    z.string().optional(), // adata[4]: RSA-OAEP wrapped AES key (base64) — asym mode only
  ]),
  meta: z.object({
    expire: z.enum(['5min','10min','1hour','1day','1week','1month','1year','never']),
    maxViews: z.number().int().positive().optional(),
    timelockedUntil: z.string().datetime().optional(),
    shardIndex: z.number().int().optional(),
    shardTotal: z.number().int().optional(),
    recipientMode: z.boolean().optional(), // RSA-OAEP mode — adata[4] carries wrapped key
  }),
});
```

---

## UI/UX Design System (§4)

### Color Palette
```css
/* Dark mode (default) */
--background:   hsl(224, 71%, 4%);    /* deep navy */
--surface:      hsl(224, 45%, 8%);    /* card surface */
--surface-2:    hsl(224, 35%, 12%);   /* elevated */
--border:       hsl(224, 20%, 20%);
--primary:      hsl(263, 90%, 68%);   /* electric violet */
--accent:       hsl(195, 100%, 55%);  /* cyan */
--success:      hsl(142, 71%, 45%);
--danger:       hsl(0, 84%, 60%);
--text:         hsl(224, 20%, 94%);
--text-muted:   hsl(224, 15%, 60%);

/* Light mode */
--background:   hsl(0, 0%, 99%);
--primary:      hsl(263, 70%, 50%);
```

**Typography:** Geist (headings), Geist Mono (code), Inter (body)

**Style:** Glassmorphism panels, gradient borders, glow effects — premium, not minimal.

### Micro-animations (Framer Motion)
- Editor panel: slide-up entrance (0.3s ease-out)
- Submit: "encrypting" loading state with animated lock icon
- Share panel: fade-in + confetti burst on success
- Paste view: blur → clear decrypt animation
- Time-lock: pulsing padlock + countdown
- Burn-after-reading: flame effect on view
- Command palette: spring slide-down

### Accessibility (WCAG 2.1 AA)
- All interactive elements: `aria-label`
- Focus trap in modals
- Color contrast >= 4.5:1
- `prefers-reduced-motion` disables all animations
- Skip-to-content link
- `aria-live` for form errors
- Logical tab order, no keyboard traps outside modals
- Icons: `aria-hidden` or text alternative

---

## Performance Targets (§5)

| Metric | Target | How |
|--------|--------|-----|
| LCP | < 1.2s | RSC, no blocking JS |
| FID/INP | < 100ms | Crypto async in Web Worker |
| CLS | < 0.1 | Static layout |
| Encrypt+submit | < 500ms | PBKDF2 in worker |
| Decrypt on view | < 300ms | Same |
| JS bundle | < 150KB gzip | Tree-shaking, dynamic imports |
| API latency | < 100ms | Neon + Vercel Edge |

---

## Demo Script (§5 — Demo Quality)

5-minute script leading with the highest-priority innovations:

**[0:00–0:40] Landing Page & Trust Visualizer**
→ Show premium dark design; explain Trust Visualizer animation (Symmetric Mode → Recipient Mode tabs); zero-knowledge badge

**[0:40–1:20] Create a Paste & Burn-After-Reading**
→ Type a secret API key; select JSON syntax highlighting; set "1 view burn"; click Encrypt & Share
→ Open URL in incognito; blur → clear decrypt animation; reload → "note destroyed"

**[1:20–2:05] Asymmetric RSA-OAEP Mode** ← *HIGHEST PRIORITY*
→ Switch to "Recipient Key" mode; paste Alice's RSA public key; create paste
→ Open link in regular browser → "Locked: Private Key Required" *(safe even if link leaks in Slack!)*
→ Unlock with Alice's RSA private key → decrypts instantly via `SubtleCrypto.unwrapKey()`

**[2:05–2:50] Shamir Key Splitting (Multi-Custody)** ← *HIGHEST PRIORITY*
→ Create paste with Split Key (k=2, n=3); show 3 separate shard URLs
→ Open shard 1 alone → quorum panel "Need 1 more key"; paste shard 2 string → full decrypt

**[2:50–3:35] Real-Time E2EE Collab**
→ Open collaborative link in side-by-side windows; live edits sync via Pusher; show Pusher dashboard → only ciphertext visible

**[3:35–4:15] Time-Lock (Time Capsule)**
→ Create paste with 10-second time-lock; open URL → pulsing padlock + countdown; after 10s → unlocks

**[4:15–4:45] API Demo & Swagger UI**
→ Open `/api/docs` (Swagger UI); make live POST request; show JSON response

**[4:45–5:00] Mobile View**
→ DevTools mobile view — fully responsive, touch-friendly

---

## Documentation Plan (§6)

### README.md
- What is Obsidian
- Why it's better than PrivateBin (feature table)
- Security model (crypto walkthrough)
- Quick start (local dev)
- Deployment (Vercel one-click)
- API reference link
- Architecture diagram

### Architecture Decision Records (`docs/adr/`)
- ADR-001: Web Crypto API over WASM zlib
- ADR-002: Prisma + Neon over filesystem
- ADR-003: Shamir's Secret Sharing for key splitting
- ADR-004: CompressionStream over zlib WASM
- ADR-005: Edge Runtime for API routes

### Security Model (`docs/SECURITY.md`)
- Threat model (what we protect + what we don't)
- Cryptographic primitives + justification
- Key derivation walkthrough
- Server-side guarantees
- Known limitations

### API Reference (`/api/docs`)
- Swagger UI from Zod-derived OpenAPI spec

---

## Scoring Justification

| Rubric | Target | Why |
|--------|--------|-----|
| §1 Problem Understanding (20) | **20/20** | All PrivateBin core guarantees preserved; Shamir + RSA-OAEP demonstrate deep crypto understanding; Trust Visualizer explicitly shows the model |
| §2 Innovation (20) | **18-20/20** | 5 must-have innovations (Shamir, RSA-OAEP Asym, Collab, N-view, Time-lock) + extras (vault, receipt, Trust Vis, templates, API) |
| §3 Technical Architecture (15) | **14-15/15** | TypeScript, Zod, Prisma, Web Worker, RSA-OAEP via SubtleCrypto, IndexedDB keystore, Yjs CRDT, OpenAPI |
| §4 UX & Accessibility (15) | **14-15/15** | WCAG 2.1 AA, prefers-reduced-motion, ARIA, keyboard nav, Command palette, Framer Motion, mobile-first |
| §5 Performance & Demo (20) | **18-20/20** | Live Vercel deploy, <1.2s LCP, Web Worker (non-blocking), <300ms decrypt, structured 5-min demo leading with crown-jewel features |
| §6 Documentation (10) | **10/10** | README, SECURITY.md, ADRs, Storybook, OpenAPI/Swagger, inline JSDoc |
| **TOTAL** | **94-100/100** | |

---

## Critical Implementation Notes

1. **Do not break v2 wire format** — `adata[0]` must stay `[iv, salt, iter, keySize, tagSize, 'aes', mode, compression]`

2. **PBKDF2 MUST run in a Web Worker** — 100k iterations blocks main thread ~500ms; use `Comlink` for typed interface

3. **URL fragment is sacred** — Never log, send, or store. Verify at code review.

4. **Burn-after-reading atomicity** — `SELECT FOR UPDATE` → `DELETE` → `RETURN data` in one transaction

5. **CSP at next.config.ts level** — `script-src 'self'`, no `'unsafe-inline'`, `connect-src *`

6. **Shamir shards = independent paste rows** — server sees at most 1 shard; reconstruction is client-only

7. **Time-lock is server-enforced** — check `timelockedUntil > now()` before returning ciphertext; server cannot decrypt but can refuse to serve

8. **Receipt JWT** — sign with ES256 (ECDSA P-256) private key; public key at `/.well-known/receipt-key.json`

9. **Rate limiting** — Upstash sliding window: 10 req / 10s per IP hash (never store raw IPs)

10. **Trust Visualizer** — most important component for judges; self-contained Framer Motion animation

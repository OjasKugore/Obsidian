# Obsidian Pastebin

A modern, high-performance, **zero-knowledge encrypted pastebin** built on **Next.js 14**, evolved from the core security principles of **PrivateBin**.

Obsidian extends classic zero-knowledge paste sharing with advanced cryptographic workflows including **Asymmetric Key Wrapping**, **Shamir's Secret Sharing (Multi-User Quorum Control)**, and **End-to-End Encrypted Real-Time Collaboration**.

---

## Quickstart Guide

This guide sets up the Next.js application in `obsidian/`.

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL database (Neon or Vercel Postgres recommended)

### Install

```bash
cd obsidian
npm install
```

### Environment

Create `obsidian/.env.local` and add the required values:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
IP_HMAC_SECRET="GENERATE_A_RANDOM_32_BYTE_SECRET"

# Optional: Pusher credentials for remote multi-user real-time collaboration
PUSHER_APP_ID="your-app-id"
PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
PUSHER_CLUSTER="mt1"
NEXT_PUBLIC_PUSHER_KEY="your-pusher-key"
NEXT_PUBLIC_PUSHER_CLUSTER="mt1"
```

Never commit `.env.local`. Generate a secret with:

```bash
openssl rand -hex 32
```

The database URL is required for Prisma and paste storage. `IP_HMAC_SECRET` is used for IP rate-limiting.

### Database

Generate the Prisma client and apply the schema:

```bash
npm run db:generate
npm run db:push
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Verify

Run the available checks from `obsidian/`:

#### Lint

Run static code analysis:

```bash
npm run lint
```

#### Test

Run the unit test suite:

```bash
npm test
```

#### Build

Compile and optimize the application for production:

```bash
npm run build
```

#### Start

Start the local production server (must run `npm run build` first):

```bash
npm start
```

### Production

For Vercel, import the repository, set the project root to `obsidian/`, add the environment variables above, and deploy. Run Prisma generation during the build and apply production database changes through the deployment workflow.

### Project Structure

- [`obsidian/app/`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/app) — Next.js routes and API endpoints
- [`obsidian/components/`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/components) — UI components
- [`obsidian/hooks/`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/hooks) — client-side application hooks
- [`obsidian/lib/crypto/`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/lib/crypto) — browser encryption and key-management code
- [`obsidian/prisma/`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/prisma) — database schema
- [`obsidian/tests/`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/tests) — unit and integration tests

---

## Project Overview

Obsidian is a next-generation security platform for ephemeral data sharing and real-time document collaboration. Derived from the zero-knowledge security concepts of PrivateBin, it guarantees:

1. **Client-Side Zero-Knowledge Encryption**: Data is compressed and encrypted before it ever leaves the browser using **256-bit AES-GCM**.
2. **Zero Server Knowledge**: The decryption key is stored exclusively in the URL `#fragment`, which browsers never send to HTTP servers.
3. **Operator Deniability**: Server administrators store only unreadable base64 ciphertext (`ct`) and metadata (`adata`), rendering server compromises benign.
4. **Ephemeral & Granular Access**: Pastes support configurable expiration windows (5 minutes to 1 year), time-locking until future dates, single-view burn-after-reading, or multi-view self-destruct thresholds.
5. **Advanced Access Control**: Introduces target-recipient asymmetric key wrapping, Shamir secret sharing multi-user quorums, and end-to-end encrypted real-time collaborative editing.

---

## Technology Stack Overview

| Layer | Component / Technology | Description |
|---|---|---|
| **Frontend UI** | Next.js 14, React 19, Tailwind CSS v4 | Server & Client components, modern dark-mode responsive interface |
| **Component Primitives** | Radix UI, Framer Motion, Lucide Icons | Accessible dialogs, tooltips, tabs, dropdowns, and fluid micro-animations |
| **Client-Side Cryptography** | Web Crypto API (`SubtleCrypto`), Web Workers | Hardware-accelerated AES-256-GCM, PBKDF2 (100k iterations), RSA-OAEP, Galois Field GF(2^8) SSS |
| **Compression & Encoding** | Web Streams API (`deflate-raw`), Base58 / Base64 | Stream compression prior to encryption; compact URL hash key encoding |
| **Backend & Storage** | Next.js App Router API, PostgreSQL, Prisma ORM | Serverless PostgreSQL database (Neon / Vercel Postgres) managed via Prisma ORM |
| **Local State Store** | Browser `IndexedDB` (`identity-keys`) | Secure local persistence for RSA-2048 keypairs across sessions |
| **Rate Limiting & Security** | Upstash Redis, HMAC-SHA256 IP Hashing | Per-IP rate limiting with anonymized HMAC hashes to prevent raw IP logging |
| **Real-Time Engine** | Pusher WebSockets (Pusher JS) + `BroadcastChannel` API | End-to-end encrypted live keystroke delta syncing across local tabs & remote network peers |

---

## Cryptographic Workflows & In-Depth Architecture

Obsidian supports **four distinct operational workflows**, catering to different security requirements and multi-user interaction patterns:

```
                      ┌─────────────────────────────────────────┐
                      │    Choose Obsidian Encryption Workflow  │
                      └────────────────────┬────────────────────┘
                                           │
         ┌───────────────────┬─────────────┴─────────────┬───────────────────┐
         ▼                   ▼                           ▼                   ▼
 ┌───────────────┐   ┌───────────────┐           ┌───────────────┐   ┌───────────────┐
 │ 1. Plain Flow │   │ 2. Asymmetric │           │ 3. Shamir SSS │   │ 4. Real-Time  │
 │  (PrivateBin) │   │  (RSA-OAEP)   │           │  (k-of-n)     │   │ Collaboration │
 └───────────────┘   └───────────────┘           └───────────────┘   └───────────────┘
```

---

### Workflow 1: Plain Workflow (PrivateBin Equivalent)

#### Description
The foundational zero-knowledge workflow matching PrivateBin v2 specifications. The user writes plaintext, which is compressed via `deflate-raw` and encrypted with **AES-256-GCM** using a 256-bit key derived from **PBKDF2-SHA256** (100,000 iterations). 

The key is appended to the URL fragment (`#<keyBase58>`). The server receives only the ciphertext (`ct`) and the wire specification (`adata`). When a recipient opens the link, the browser extracts the fragment key, fetches the ciphertext from the API, decrypts the content, and auto-purges the paste if burn-after-reading was enabled.

#### Workflow Flowchart

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Creator Browser
    participant Worker as Web Worker (crypto.worker.ts)
    participant API as Backend API (/api/v1/paste)
    participant DB as PostgreSQL (Prisma)
    actor Recipient as Recipient Browser

    Creator->>Worker: Send Plaintext + Expiry Options
    Worker->>Worker: Compress (deflate-raw) + Derive Key (PBKDF2 100k)
    Worker->>Worker: AES-256-GCM Encrypt (IV + Salt + AAD)
    Worker-->>Creator: Return Ciphertext (ct), adata, & Raw Key
    Creator->>API: POST /api/v1/paste { ct, adata, meta }
    API->>DB: Save Paste record (id = fnv1a64(ct))
    API-->>Creator: Return pasteId & deleteToken
    Note over Creator: Generates URL: https://obsidian.app/<pasteId>#<keyBase58>
    Creator->>Recipient: Share URL via external channel
    Recipient->>API: GET /api/v1/paste/<pasteId>
    API->>DB: Query Paste (Atomic DELETE if burnAfterReading=true)
    API-->>Recipient: Return { ct, adata, meta }
    Note over Recipient: Extracts #keyBase58 from URL hash
    Recipient->>Recipient: Decrypt AES-256-GCM & Decompress in Browser
```

#### Modules Cited
- [`obsidian/lib/crypto/cipher.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/lib/crypto/cipher.ts) — Core AES-256-GCM encryption (`encrypt()`, `decrypt()`, `decryptWithRawKey()`)
- [`obsidian/lib/crypto/kdf.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/lib/crypto/kdf.ts) — PBKDF2-SHA256 key derivation (`deriveKey()`)
- [`obsidian/lib/crypto/compress.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/lib/crypto/compress.ts) — Stream compression engine (`tryCompress()`, `decompress()`)
- [`obsidian/workers/crypto.worker.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/workers/crypto.worker.ts) — Off-main-thread Web Worker background execution
- [`obsidian/hooks/usePasteEncryption.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/hooks/usePasteEncryption.ts) — Creator paste submission hook
- [`obsidian/hooks/usePasteDecryption.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/hooks/usePasteDecryption.ts) — Recipient paste retrieval and decryption hook
- [`obsidian/app/api/v1/paste/route.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/app/api/v1/paste/route.ts) — Creation API endpoint
- [`obsidian/app/api/v1/paste/[id]/route.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/app/api/v1/paste/[id]/route.ts) — Retrieval API endpoint with atomic self-destruct

---

### Workflow 2: Asymmetric Encryption Based (RSA-OAEP Key Wrapping)

#### Description
Targeted peer-to-peer sharing using hybrid cryptography. Instead of placing a symmetric decryption key in the shareable URL fragment, the paste creator encrypts the document with a random AES-256 key and then **wraps (encrypts) that AES key** using the recipient's **RSA-2048 public key** (SPKI base64 format).

The wrapped key is stored in `adata[4]`. The generated link is simply `/<pasteId>#asym`. When the recipient visits the link, their browser fetches the stored identity keypair from local `IndexedDB` (or prompts for a manual PKCS8 private key paste), unwraps the AES key using SubtleCrypto `unwrapKey`, and decrypts the paste content.

#### Workflow Flowchart

```mermaid
sequenceDiagram
    autonumber
    actor Recipient as Recipient Browser
    actor Creator as Creator Browser
    participant API as Backend API (/api/v1/paste)
    participant IDB as Browser IndexedDB (identity-keys)

    Recipient->>IDB: Generate & Store RSA-2048 Keypair (keystore.ts)
    Recipient->>Creator: Send Public Key (Base64 SPKI)
    Creator->>Creator: Encrypt Plaintext with random AES-256 Key
    Creator->>Creator: importRSAPublicKey() & wrapAESKey(rawAESKey, rsaPubKey)
    Note over Creator: Append base64 wrapped AES key to adata[4]
    Creator->>API: POST /api/v1/paste { ct, adata, meta: { recipientMode: true } }
    API-->>Creator: Return pasteId
    Note over Creator: Generates URL: https://obsidian.app/<pasteId>#asym
    Recipient->>API: GET /api/v1/paste/<pasteId>
    API-->>Recipient: Return { ct, adata (with wrapped key in adata[4]) }
    Recipient->>IDB: Load Private Key from IndexedDB (or PrivateKeyUnlock UI)
    Recipient->>Recipient: unwrapAESKey(adata[4], rsaPrivateKey) -> rawAESKey
    Recipient->>Recipient: Decrypt Ciphertext with rawAESKey
```

#### Modules Cited
- [`obsidian/lib/crypto/asymmetric.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/lib/crypto/asymmetric.ts) — RSA-2048-OAEP key generator, key wrapping (`wrapAESKey()`), and unwrapping (`unwrapAESKey()`)
- [`obsidian/lib/crypto/keystore.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/lib/crypto/keystore.ts) — IndexedDB storage manager for RSA keypairs (`generateAndSaveIdentityKey()`, `loadIdentityKey()`)
- [`obsidian/components/editor/RecipientKeyInput.tsx`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/components/editor/RecipientKeyInput.tsx) — UI component for entering recipient's public key
- [`obsidian/components/viewer/PrivateKeyUnlock.tsx`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/components/viewer/PrivateKeyUnlock.tsx) — UI modal for unwrapping asymmetric pastes with private keys
- [`obsidian/hooks/useAsymmetricEncryption.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/hooks/useAsymmetricEncryption.ts) — Management hook for RSA identity key creation and retrieval

---

### Workflow 3: Shamir's Secret Based Multiple User Control (SSS Quorum)

#### Description
Multi-party authorization workflow based on **Shamir's Secret Sharing (SSS)** over Galois Field \(GF(2^8)\) with irreducible polynomial \(P(x) = x^8 + x^4 + x^3 + x + 1\).

The master 32-byte AES key is mathematically split into \(n\) distinct shard strings (`shard-<threshold>-<index>-<total>-<hexData>`). To decrypt the paste, a quorum of at least \(k\) keyholders (\(k \le n\)) must submit their shards. The browser uses **Lagrange Basis Interpolation** evaluated at \(x=0\) over \(GF(2^8)\) to reconstruct the original 32-byte AES key. Any set of fewer than \(k\) shards provides zero mathematical information about the secret.

#### Workflow Flowchart

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Creator Browser
    participant API as Backend API (/api/v1/paste)
    actor Holder1 as Keyholder 1 (Shard #1)
    actor Holder2 as Keyholder 2 (Shard #2)

    Creator->>Creator: Encrypt Plaintext with AES-256 Key
    Creator->>Creator: splitKey(rawAESKey, shares=3, threshold=2) over GF(2^8)
    Note over Creator: Generates 3 shard strings (shard-2-1-3-..., shard-2-2-3-...)
    Creator->>API: POST /api/v1/paste { ct, adata, meta: { shard: true, shardTotal: 3 } }
    API-->>Creator: Return pasteId
    Creator->>Holder1: Sends Link 1: https://obsidian.app/<pasteId>#shard-2-1-3-<hex1>
    Creator->>Holder2: Sends Link 2: https://obsidian.app/<pasteId>#shard-2-2-3-<hex2>
    Holder1->>API: GET /api/v1/paste/<pasteId>
    API-->>Holder1: Return { ct, adata }
    Note over Holder1: Detected SSS mode. Shard #1 loaded (1/2 required). Quorum needed.
    Holder2->>Holder1: Provides Shard #2 string
    Holder1->>Holder1: addShard(shard-2-2-3-<hex2>) -> Quorum Reached (2/2)
    Holder1->>Holder1: combineShards([shard1, shard2]) -> Lagrange Interpolation -> masterKey
    Holder1->>Holder1: Decrypt Ciphertext using masterKey
```

#### Modules Cited
- [`obsidian/lib/crypto/shamir.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/lib/crypto/shamir.ts) — Galois Field \(GF(2^8)\) arithmetic, polynomial evaluation (`splitKey()`), Lagrange interpolation (`combineShards()`), and string parsing (`parseShard()`)
- [`obsidian/components/viewer/ShardQuorumPanel.tsx`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/components/viewer/ShardQuorumPanel.tsx) — Interactive UI panel for collecting and validating quorum shards
- [`obsidian/prisma/schema.prisma`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/prisma/schema.prisma) — Database schema tracking shard flags (`shard`, `shardIndex`, `shardTotal`)
- [`obsidian/hooks/usePasteEncryption.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/hooks/usePasteEncryption.ts) — Splitting and shareable URL generator for SSS pastes
- [`obsidian/hooks/usePasteDecryption.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/hooks/usePasteDecryption.ts) — Shard aggregation and master key reconstruction loop

---

### Workflow 4: Collab Access in Real Time (E2EE WebSockets & BroadcastChannel)

#### Description
Real-time end-to-end encrypted live document collaboration across multiple active peers. When real-time collaboration is enabled on an open paste, active browser sessions connect via two real-time transport backplanes:

1. **BroadcastChannel API (`obsidian-collab-<pasteId>`)**: Handles instant local multi-tab synchronization on the same client machine with zero network latency.
2. **Pusher WebSockets Presence Room (`presence-collab-<pasteId>`)**: Relays encrypted keystroke deltas and presence metadata across remote network peers.

**Blind Relay Architecture**: Pusher servers act purely as blind relays. All keystroke deltas, document state updates (`client-delta`), typing heartbeats (`client-typing`), and session locks (`client-locked`) are encrypted client-side with AES-256-GCM before broadcast and decrypted client-side upon arrival.

#### Workflow Flowchart

```mermaid
sequenceDiagram
    autonumber
    actor PeerA as Peer A (Browser)
    participant Pusher as Pusher WSS (Blind Relay)
    actor PeerB as Peer B (Browser)

    PeerA->>Pusher: Subscribe presence-collab-<pasteId>
    PeerB->>Pusher: Subscribe presence-collab-<pasteId>
    Pusher-->>PeerA: Event: member_added (Peer B)
    Pusher-->>PeerB: Event: subscription_succeeded

    Note over PeerA: Peer A types text modification
    PeerA->>PeerA: encrypt(newText, customKey=rawKey) -> { ct, adata }
    PeerA->>Pusher: trigger('client-delta', { ct, adata, senderId })
    Pusher-->>PeerB: Relay 'client-delta' event
    PeerB->>PeerB: decrypt(ct, adata, rawKey) -> Render Live Text Update

    Note over PeerB: Peer B typing activity heartbeat
    PeerB->>PeerB: encrypt({ name: 'Peer B', isTyping: true }, rawKey)
    PeerB->>Pusher: trigger('client-typing', { ct, adata })
    Pusher-->>PeerA: Relay 'client-typing' event
    PeerA->>PeerA: Decrypt & Display Active Typing Pill

    Note over PeerA: Peer A finalizes document / Locks edit state
    PeerA->>Pusher: trigger('client-locked', { finalContent })
    Pusher-->>PeerB: Relay 'client-locked' event
```

#### Modules Cited
- [`obsidian/hooks/useCollab.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/hooks/useCollab.ts) — Complete client-side real-time collaboration hook managing BroadcastChannel, Pusher presence rooms, delta encryption/decryption, and typing indicators
- [`obsidian/lib/pusher.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/lib/pusher.ts) — Server-side Pusher client factory & blind relay initializer
- [`obsidian/app/api/v1/collab/auth/route.ts`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/app/api/v1/collab/auth/route.ts) — Presence channel authentication API endpoint
- [`obsidian/components/collab/CollabIndicator.tsx`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/components/collab/CollabIndicator.tsx) — Header UI component displaying online collaborators and typing status
- [`obsidian/components/viewer/PasteViewer.tsx`](file:///c:/Users/ADMIN/OneDrive/Desktop/clonefest/obsidian/components/viewer/PasteViewer.tsx) — Integration of live collaboration state inside paste viewer component

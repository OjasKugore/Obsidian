# Obsidian

**A zero-knowledge pastebin. The server never sees what you write.**

Built on Next.js 16, evolved from [PrivateBin](https://privatebin.info/)'s security model — extended with asymmetric key wrapping, Shamir's Secret Sharing, and end-to-end encrypted real-time collaboration.

---

## The guarantee

Everything is encrypted in your browser before it touches the network. The server stores ciphertext and nothing else — not even a compromised server can read your data, because the decryption key lives only in the URL `#fragment`, which browsers never transmit.

---

## Four ways to share a secret

### 1 · Plain — the PrivateBin baseline
Write text → compressed (`deflate-raw`) → encrypted (AES-256-GCM, key from PBKDF2-SHA256, 100k iterations) → key appended to the URL fragment. The server never receives it.

```mermaid
sequenceDiagram
    autonumber
    actor Creator
    participant Worker as Web Worker
    participant API
    actor Recipient

    Creator->>Worker: Plaintext + options
    Worker->>Worker: Compress → derive key (PBKDF2) → AES-256-GCM encrypt
    Worker-->>Creator: ciphertext, adata, key
    Creator->>API: POST /api/v1/paste
    API-->>Creator: pasteId → URL#keyBase58
    Creator->>Recipient: Share URL
    Recipient->>API: GET /api/v1/paste/:id
    Recipient->>Recipient: Decrypt using #fragment key
```

### 2 · Asymmetric — RSA-OAEP key wrapping
Instead of a key in the URL, the AES key is wrapped with the *recipient's* RSA-2048 public key. The link (`/<pasteId>#asym`) is useless without their private key — safe even if it leaks in Slack, a clipboard, or a log.

```mermaid
sequenceDiagram
    autonumber
    actor Recipient
    actor Creator
    participant API
    participant IDB as IndexedDB

    Recipient->>IDB: Generate & store RSA-2048 keypair
    Recipient->>Creator: Public key (SPKI base64)
    Creator->>Creator: Encrypt with random AES key
    Creator->>Creator: Wrap AES key with recipient's public key
    Creator->>API: POST { ct, adata[4] = wrapped key }
    API-->>Creator: pasteId → URL#asym
    Recipient->>API: GET /api/v1/paste/:id
    Recipient->>IDB: Load private key
    Recipient->>Recipient: Unwrap AES key → decrypt
```

### 3 · Shamir — k-of-n quorum control
The AES key is split into *n* shards over GF(2⁸). Any *k* shards reconstruct it via Lagrange interpolation; fewer than *k* reveal nothing. Built for secrets that need multiple people to agree before they're readable.

```mermaid
sequenceDiagram
    autonumber
    actor Creator
    participant API
    actor Holder1 as Keyholder 1
    actor Holder2 as Keyholder 2

    Creator->>Creator: Encrypt with AES key
    Creator->>Creator: Split key → 3 shards, threshold 2
    Creator->>API: POST { ct, adata, shardTotal: 3 }
    API-->>Creator: pasteId
    Creator->>Holder1: URL#shard-2-1-3-...
    Creator->>Holder2: URL#shard-2-2-3-...
    Holder1->>API: GET /api/v1/paste/:id
    Holder2->>Holder1: Shard #2
    Holder1->>Holder1: Combine shards → Lagrange interpolation → key
    Holder1->>Holder1: Decrypt
```

### 4 · Collab — live E2EE editing
Two peers on the same paste see each other's edits in real time. Pusher relays only ciphertext — it never holds a key.

```mermaid
sequenceDiagram
    autonumber
    actor PeerA
    participant Pusher as Pusher (blind relay)
    actor PeerB

    PeerA->>Pusher: Subscribe presence-collab-:id
    PeerB->>Pusher: Subscribe presence-collab-:id
    PeerA->>PeerA: Encrypt keystroke delta
    PeerA->>Pusher: trigger('client-delta', ct)
    Pusher-->>PeerB: Relay ct only
    PeerB->>PeerB: Decrypt → render live update
```

---

## Run it

```bash
cd obsidian
npm install
```

`.env.local`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
IP_HMAC_SECRET="openssl rand -hex 32"

# optional — enables remote real-time collaboration
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
```

```bash
npm run db:generate && npm run db:push
npm run dev        # http://localhost:3000
```

| Check | Command |
|---|---|
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Production build | `npm run build && npm start` |

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16, React 19, Tailwind v4 |
| Crypto | Web Crypto API — AES-256-GCM, PBKDF2, RSA-OAEP, custom GF(2⁸) Shamir SSS |
| Storage | PostgreSQL (Neon) via Prisma |
| Real-time | Pusher WebSockets + `BroadcastChannel` |
| Rate limiting | Upstash Redis, HMAC-SHA256 IP hashing |

---

## Where things live

```
obsidian/
├── app/api/v1/paste/        create · read · delete · comment
├── app/api/v1/collab/       presence-channel auth
├── components/editor/       paste creation UI, recipient-key input
├── components/viewer/       decryption, quorum panel, comments
├── lib/crypto/              cipher · kdf · asymmetric · shamir · compress
├── workers/crypto.worker.ts off-main-thread PBKDF2
├── hooks/                   usePasteEncryption · usePasteDecryption · useCollab
└── prisma/schema.prisma     Paste · Comment · AccessLog
```

---

*Zero-knowledge means what it says: even we can't read what you paste.*
# Obsidian

## 🔐 What is Obsidian

A zero-knowledge pastebin where **the server never sees what you write**. Built on Next.js 16 and evolved from [PrivateBin](https://privatebin.info/)'s battle-tested security model, extended with asymmetric RSA key wrapping, Shamir's Secret Sharing for multi-party quorum control, and end-to-end encrypted real-time collaboration.

---

## Features

- 🆕 **Modernised Legacy Features** —  next-gen tech stack (Next.js 16, React 19, Tailwind v4, Web Crypto API) for legacy features
- 💻 **Developer CLI Tool (`obsidian`)** — terminal client for encrypted pastes, RSA key management, whole-repo sharing, and Shamir quorum operations
- 👁️ **Zero-Knowledge Trust Visualizer** — animated encryption explainer UI
- 💥 **N-View Self-Destruct** — atomic burn-after-reading with configurable view limits
- ⏳ **Time-Locked Notes** — Time Capsule mode for delayed message access
- 🔐 **Asymmetric RSA-OAEP Key Wrapping** — public-key mode for 1-to-1 recipient delivery
- 🔑 **Shamir's Secret Sharing** — k-of-n key splitting for multi-party threshold quorum
- 🔴 **Real-Time E2EE Collaboration** — Pusher + BroadcastChannel for instant encrypted updates
- ⌨️ **Command Palette** — Cmd+K shortcuts for power-user workflows
- 📋 **Paste Starter Templates** — pre-built content templates
- 🗄️ **Encrypted Paste Vault** — searchable collection of saved pastes
- 🧾 **Cryptographic Destruction Receipts** — JWT-signed proof of paste deletion
- ✅ **Comprehensive Test Suite** — 85/85 unit tests + 7/7 E2E tests passing

---

## 🛠️ Stack

| Layer | Tech |
|---|---|
| 🚀 Framework | Next.js 16, React 19, Tailwind v4 |
| 🔒 Crypto | Web Crypto API — AES-256-GCM, PBKDF2, RSA-OAEP, custom GF(2⁸) Shamir SSS |
| 💻 CLI | Node.js (ESM), Commander, Chalk, Ora, Tar, TSX |
| 🗄️ Storage | PostgreSQL (Neon) via Prisma |
| ⚡ Real-time | Pusher WebSockets + `BroadcastChannel` |
| 🚦 Rate limiting | Upstash Redis, HMAC-SHA256 IP hashing |

---

## 🚀 Quickstart

### Web Application

```bash
cd obsidian
npm install
```

`.env.local`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
IP_HMAC_SECRET=<32_byte_secret> # openssl rand -hex 32

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

## 💻 Developer CLI Tool (`obsidian`)

Obsidian includes a full-featured terminal CLI for scripting, CI/CD pipelines, and terminal-first workflows. Encrypt, decrypt, manage RSA identity keys, split secrets with Shamir quorum, or share entire codebases directly from your shell.

### 📦 Installation & Setup

```bash
cd obsidian/cli
npm install

# Link globally to use the `obsidian` command anywhere
npm link

# Or run directly via tsx:
npm run dev -- <command>
```

Configure target server (defaults to `http://localhost:3000`):
```bash
obsidian config set-url https://your-obsidian-instance.com
```

---

### ⚡ Command Reference

| Command | Description | Example |
|---|---|---|
| `obsidian send` | Encrypt & upload text or a file | `obsidian send "my secret API key" --burn` |
| `obsidian read` | Decrypt & read a paste from a URL | `obsidian read "https://...#key"` |
| `obsidian key` | Manage RSA-2048 identity keypair | `obsidian key generate && obsidian key show --public` |
| `obsidian repo send` | Tar, encrypt & upload entire folder | `obsidian repo send ./my-project --exclude dist` |
| `obsidian repo get` | Download, decrypt & extract repo | `obsidian repo get "<url>#key" --output ./restored` |
| `obsidian shamir split` | Offline mathematical secret splitting | `obsidian shamir split "root-token" -n 5 -k 3` |
| `obsidian shamir combine` | Offline secret reconstruction | `obsidian shamir combine "<shard1>" "<shard2>"` |
| `obsidian config` | Inspect or update CLI settings | `obsidian config set-url https://app.example.com` |

---

### 🛠️ Common CLI Workflows

#### 1️⃣ Send a Secret or File (Burn-on-Read)
```bash
# Encrypt text with automatic self-destruction upon reading (default)
obsidian send "sk_live_998822334455"

# Encrypt a file (.env, config, certificate) without burning
obsidian send --file .env.production --no-burn

# Pipe raw decrypted content in CI/CD scripts
obsidian read "https://obsidian.app/pasteId#key" --raw > .env
```

#### 2️⃣ Asymmetric RSA-OAEP Targeted Secret Delivery
```bash
# 1. Recipient generates and shares their public key
obsidian key generate
obsidian key show --public

# 2. Sender encrypts with recipient's public key (link is useless without recipient's private key)
obsidian send "confidential deployment keys" --recipient "<RECIPIENT_PUBKEY_BASE64>"

# 3. Recipient decrypts automatically using their local keystore (~/.obsidian/identity.json)
obsidian read "https://obsidian.app/pasteId#asym"
```

#### 3️⃣ Multi-Party Quorum (Shamir's Secret Sharing)
```bash
# Create a 2-of-3 threshold paste (outputs 3 individual shard links)
obsidian send "Production Root Access" --shares 3 --threshold 2

# Combine any 2 shard links to reconstruct the key and decrypt
obsidian read "<shard1_url>" --shards "<shard2_url>"
```

#### 4️⃣ Entire Repository & Folder Sharing
```bash
# Compresses (tar.gz), encrypts, and uploads directory (supports --recipient for 1-to-1 secure delivery)
obsidian repo send ./backend-service --exclude node_modules dist .git

# Download, decrypt, and unpack directly to an output directory
obsidian repo get "https://obsidian.app/pasteId#key" --output ./restored-backend
```

---

## 4️⃣ Four ways to share a secret

### 1️⃣ Plain — the PrivateBin baseline

**Key in URL fragment:** encrypt locally, share link with embedded key — one-click decrypt for recipient, server learns nothing.

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

### 2️⃣ Asymmetric — RSA-OAEP key wrapping

**Recipient's public key wraps the AES key:** link is useless without their private key — safe for untrusted channels (Slack, email, logs).

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

### 3️⃣ Shamir — k-of-n quorum control

**Split the AES key into N shards, require K to unlock:** multi-party threshold control via Lagrange interpolation over GF(2⁸).

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

### 4️⃣ Collab — live E2EE editing

**Real-time collaborative editing:** encrypted deltas streamed via Pusher as a blind relay—server never holds keys or plaintext.

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

## 📁 Project structure

```
obsidian/
├── app/              API routes · pages · vault · interactive docs
│   ├── api/v1/paste/           create · read · delete · comment
│   ├── api/v1/collab/          presence-channel auth
│   ├── api/docs/               interactive API & CLI portal
│   ├── pad/                    paste editor UI
│   └── vault/                  user vault
├── cli/              Developer CLI tool (`obsidian-cli`)
│   ├── bin/                    CLI executable wrapper (`obsidian.js`)
│   ├── src/commands/           send · read · key · repo · shamir · config
│   ├── src/lib/                crypto · shamir · keystore · API clients
│   └── src/utils/              archive tar/gzip · display formatters
├── components/       UI components
│   ├── editor/                 paste creation UI
│   ├── viewer/                 decryption · quorum panel · comments
│   ├── crypto/                 crypto helpers
│   ├── collab/                 real-time collaboration
│   ├── sharing/                share UI
│   ├── qr/                     QR code generator
│   ├── ui/                     generic UI primitives
│   └── header/ · layout/       layout components & CLI modal
├── lib/              core libraries
│   ├── crypto/                 cipher · kdf · asymmetric · shamir · compress
│   ├── api/                    API clients
│   └── db                      database helpers
├── workers/          off-main-thread PBKDF2 worker
├── hooks/            custom React hooks
│   └── usePasteEncryption · usePasteDecryption · useCollab
├── prisma/           Prisma schema → Paste · Comment · AccessLog
├── tests/            unit · e2e tests
└── public/           static assets
```

---
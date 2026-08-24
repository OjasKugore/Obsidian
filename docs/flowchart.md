# Architecture & Flowchart

This document outlines the architecture, component connections, and data flow of the Obsidian Next.js application, originating from the **Home Page (`app/page.tsx`)**.

## Architectural Flowchart (ASCII)

```text
                               ┌─────────────────────────────────────────┐
                               │     HomePage (obsidian/app/page.tsx)     │
                               └────────────────────┬────────────────────┘
                                                    │
        ┌──────────────────────┬────────────────────┼────────────────────┬──────────────────────┐
        ▼                      ▼                    ▼                    ▼                      ▼
┌──────────────┐     ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   UI Shell   │     │   Paste Editor   │  │   Share Panel    │  │ Encryption Hook  │  │ Dynamic Viewing  │
│ (Header &    │     │ (PasteEditor.tsx)│  │ (SharePanel.tsx) │  │ (usePasteEncry-  │  │ Route ([id])     │
│ AuroraBg)    │     └──────────────────┘  └──────────────────┘  │  ption.ts)       │  └──────────────────┘
└──────────────┘                                                 └────────┬─────────┘
                                                                          │
                                                ┌─────────────────────────┴─────────────────────────┐
                                                ▼                                                   ▼
                                    ┌───────────────────────┐                           ┌───────────────────────┐
                                    │ Web Worker / Crypto   │                           │ Backend API Endpoint  │
                                    │ Engine (lib/crypto/)  │                           │ (/api/v1/paste)       │
                                    └───────────────────────┘                           └───────────┬───────────┘
                                                                                                    │
                                                                                        ┌───────────┴───────────┐
                                                                                        ▼                       ▼
                                                                            ┌──────────────────────┐  ┌──────────────────┐
                                                                            │ Database (Prisma ORM │  │ Rate Limiting    │
                                                                            │ schema.prisma)       │  │ (rate-limit.ts)  │
                                                                            └──────────────────────┘  └──────────────────┘
```

---

## Connections Breakdown

### 1. UI Layer & Editor Components
- **`Header`** (`components/layout/Header.tsx`): Top navigation bar containing theme toggle (`next-themes`) and brand logo.
- **`PasteEditor`** (`components/editor/PasteEditor.tsx`): User interface for pasting text, selecting syntax highlighting, setting expiration options, and adding optional password protection.
- **`SharePanel`** (`components/sharing/SharePanel.tsx`): Rendered after successful encryption. Displays the generated secret URL, QR code, and raw key copy buttons.

### 2. Encryption Engine & Web Worker
When the user clicks **"Encrypt & Create Paste"**, `HomePage` invokes the custom hook **`usePasteEncryption`** (`hooks/usePasteEncryption.ts`):
- **`crypto.worker.ts`** (`workers/crypto.worker.ts`): Offloads key derivation (PBKDF2 100k iterations) and AES-256-GCM encryption to a background Web Worker so the main UI thread never freezes.
- **`cipher.ts`** (`lib/crypto/cipher.ts`): Core encryption library handling salt generation, GCM auth tags, compression (`compress.ts`), and Base58 encoding (`encoding.ts`).

### 3. Backend API & Storage (`/api/v1/paste`)
Once encrypted in the browser, `usePasteEncryption` sends an HTTP POST request to **`app/api/v1/paste/route.ts`**:
- **`rate-limit.ts`** (`lib/rate-limit.ts`): Rate limits requests per IP (using HMAC hash).
- **`schema.prisma`** (`prisma/schema.prisma`): Saves **only** the encrypted ciphertext (`ct`) and metadata (`adata`) to PostgreSQL.
  > 🔒 **Security Guarantee**: The raw text and secret decryption key stay in the browser. The server never receives or sees them.

### 4. Recipient Viewing Flow (`/[id]`)
The generated URL format is `http://localhost:3000/<pasteId>#<secretKey>`:
- **`app/[id]/page.tsx`**: Handles recipient visits.
- Fetches `ct` from `/api/v1/paste/[id]`.
- Extracts `#secretKey` from the URL fragment (URL fragments are never sent to HTTP servers).
- Decrypts payload in browser via `lib/crypto/cipher.ts` and renders **`PasteViewer`** (`components/viewer/PasteViewer.tsx`).
- **`useCollab.ts`** (`hooks/useCollab.ts`) & **`pusher.ts`** (`lib/pusher.ts`): If real-time editing is enabled, syncs encrypted deltas between active viewers.
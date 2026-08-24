# Obsidian — Paranoia-Grade E2EE Pastebin

![Obsidian Web UI](https://raw.githubusercontent.com/your-username/obsidian/main/public/banner.png) <!-- Update this path if you add a banner -->

Obsidian is an open-source, End-to-End Encrypted (E2EE) pastebin and secure data-sharing platform. Built with Next.js and the Web Crypto API, it ensures that the server **never** sees the plaintext of the data being shared.

What sets Obsidian apart is its **Powerful Developer CLI**, bringing enterprise-grade secret sharing, automated encrypted logging, multi-user threshold quorum sharing (Shamir SSS), and whole-repository encryption directly to the terminal.

---

## 🌟 Cryptographic Architecture & Features

Obsidian supports three distinct cryptographic access models in both the Web UI and CLI:

1. **Single-User Symmetric (AES-256-GCM):** Data is encrypted locally with a 256-bit key. The key is embedded in the URL fragment (`#base58Key`), which browsers and clients never send to the server.
2. **Single-User Asymmetric (RSA-OAEP):** Data is encrypted with a recipient's 2048-bit public key. The private key never leaves the recipient's machine or browser (`#asym`).
3. **Multi-User Threshold Quorum (Shamir Secret Sharing GF($2^8$)):** The 256-bit AES key is mathematically split into $n$ polynomial shares. Any $k$ ($threshold \le n$) shares can reconstruct the key and decrypt the payload.
4. **Burn-After-Reading:** Pastes are permanently deleted from the database upon the first successful read.
5. **Encrypted Discussions:** Support for E2EE threaded comments on pastes without revealing identities or content to the server.
6. **Whole-Repo Sharing:** Securely archive, compress, encrypt, and share entire git repositories via the CLI.

---

## 💻 The Obsidian CLI (Command Line Interface)

The standout feature of this project is the CLI, designed to seamlessly integrate secure encryption into developer workflows and CI/CD pipelines.

### Setup
```bash
# Navigate to the CLI directory and install dependencies
cd cli
npm install

# Test the CLI
npm run dev -- --help
```

---

### 1. Single-User Symmetric Encryption
Developers shouldn't have to leave the terminal to share sensitive data. Pipe anything directly to Obsidian:

```bash
# Securely share a .env file (burn-after-reading)
cat .env.production | npm run dev -- send --silent

# Automatically upload crash logs from a CI pipeline
docker logs backend_container | npm run dev -- send --burn

# Read & decrypt from the terminal
npm run dev -- read "http://localhost:3000/1234abcd#keyBase58"
```

---

### 2. Single-User Asymmetric Encryption (RSA-OAEP)
For maximum security, avoid the browser entirely. The CLI can generate local RSA-2048 keys. The private key never touches a web browser, eliminating XSS risks.

```bash
# Generate a local identity key (saved to ~/.obsidian-cli/identity.json)
npm run dev -- key generate

# Output your public key to give to a sender
npm run dev -- key show --public

# A sender encrypts specifically for your public key:
npm run dev -- send "Highly classified secret" --recipient <your-public-key>

# You decrypt using your local identity key:
npm run dev -- read "http://localhost:3000/1234abcd#asym"
```

---

### 3. Multi-User Threshold Quorum (Shamir Secret Sharing)
Need a secret to be accessible **only when multiple team members agree** (e.g. 2-of-3 executives or 3-of-5 engineers)? 

```bash
# Create a 2-of-3 quorum paste:
npm run dev -- send "Root Database Credentials" --shares 3 --threshold 2
```
*The CLI will generate 3 unique shard links. Distribute one link to each team member.*

```bash
# If a member opens only 1 shard:
npm run dev -- read "<shard-url-1>"
# Output: 🔒 Shamir Quorum Required (1/2 shards provided). Missing 1 more shard.

# When quorum is reached (e.g. Shard 1 + Shard 3):
npm run dev -- read "<shard-url-1>" --shards "<shard-url-3>"
# Output: Lagrange interpolation complete — AES-256 key recovered & paste decrypted!
```

#### Standalone Shamir Toolkit
You can also split and combine arbitrary secrets locally without uploading to a server:
```bash
# Split a password into 5 shares (requiring any 3):
npm run dev -- shamir split "super-secret-password" --shares 5 --threshold 3

# Reconstruct from any 3 shares:
npm run dev -- shamir combine "<shard1>" "<shard2>" "<shard3>"
```

---

### 4. Whole-Repository Sharing
Need to share a proprietary codebase with a contractor without giving them GitHub access? The CLI can parse `.gitignore`, compress the repo, and encrypt it for their public key:

```bash
# Encrypt and upload an entire repository
npm run dev -- repo send ./my-startup-project --recipient <contractor-pubkey>

# The recipient downloads and extracts it locally:
npm run dev -- repo get "http://localhost:3000/repo123#asym" --output ./recovered-project
```

---

## 🚀 Running the Web App Locally

1. **Database Setup:** Ensure your PostgreSQL database is running and the connection string is set in `.env.local`:
   ```env
   DATABASE_URL="postgresql://user:password@host:port/db?sslmode=require"
   ```

2. **Install & Generate Prisma:**
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Tech Stack

* **Framework:** Next.js 14 (App Router)
* **Language:** TypeScript
* **Database:** PostgreSQL (Neon) via Prisma ORM
* **Styling:** Tailwind CSS + Framer Motion
* **Cryptography:** Web Crypto API (AES-256-GCM, RSA-OAEP, PBKDF2) + Galois Field GF($2^8$) Shamir SSS
* **CLI Engine:** Commander.js + tsx

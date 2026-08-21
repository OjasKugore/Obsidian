# Module 01 — Project Overview & Security Architecture

> **Read this first.** Contains the zero-knowledge guarantee, project identity, and all server-side security mechanisms.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| Name | PrivateBin |
| Version | 2.0.5 (July 2026) |
| License | zlib/libpng |
| Origin | Fork of ZeroBin by Sébastien Sauvage (2012) |
| Language | PHP 7.4+ / 8.x (backend), Vanilla JS ES2020+ (frontend) |
| Entry point | `index.php` → `new PrivateBin\Controller` |
| Config file | `cfg/conf.php` (INI-style, PHP-protected) |
| Default storage | Filesystem (JSON files in `data/`) |
| Namespace | `PrivateBin\` (PSR-4 autoloaded from `lib/`) |

---

## 2. Core Security Objective — Zero-Knowledge Architecture

**The server NEVER sees plaintext.** The entire security guarantee rests on this:

1. The browser generates a random 256-bit symmetric key.
2. The key is placed in the **URL fragment** (`#...`), which browsers do **not** send to the server in HTTP requests.
3. The plaintext is compressed (zlib via WebAssembly) then encrypted (AES-256-GCM) using the Web Crypto API **before** any network request.
4. Only ciphertext + authenticated metadata (adata) is POSTed to the server.
5. The server stores only the opaque encrypted blob.
6. To read a paste, the recipient needs the full URL (including the `#fragment`).
7. Optional password protection adds a KDF layer on top of the random key.

> **IMPORTANT:** Any modernised version **must** preserve this client-side-only encryption model. Moving encryption to the server destroys the entire security model.

---

## 3. Security Architecture

### Client-Side Security
- **AES-256-GCM** — authenticated encryption (prevents tampering)
- **PBKDF2-SHA256, 100,000 iterations** — key derivation (slows brute force)
- **16-byte random IV + 8-byte random salt** per paste — no IV reuse
- **DOMPurify** — sanitizes all Markdown-rendered HTML and comment icons
- URL-rendered links get `rel="nofollow noopener noreferrer"` + `target="_blank"`
- Attachment filenames sanitized before display (CVE-2025-62796 fix)

### Server-Side Security
- **CSP header** — restrictive default, `'wasm-unsafe-eval'` only for WASM
- **SRI** — Subresource Integrity hashes for all JS files
- **`X-Frame-Options: deny`** — no iframing
- **`Referrer-Policy: no-referrer`** — no URL leakage
- **`X-Content-Type-Options: nosniff`** — MIME sniffing blocked
- **`COEP: require-corp`** + `CORP: same-origin`
- **`Permissions-Policy: browsing-topics=()`**
- **Rate limiting** — per-IP, HMAC-hashed (no raw IP stored), configurable
- **Delete tokens** — HMAC-SHA256(pasteid, paste-specific-salt); server-specific
- **Entropy check** on upload — rejects obviously non-ciphertext data
- **Template path validation** — only whitelisted templates loadable (CVE-2025-64714 fix)
- All paste/comment files protected by PHP `http_response_code(403)` guard line
- `.htaccess` auto-generated with `Require all denied`
- Paste files stored as `chmod 0640`

### Security Headers (set in `Controller::_view()`)
```
Content-Security-Policy: <from config>
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Permissions-Policy: browsing-topics=()
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: deny
```

### Default CSP Value
```
default-src 'none'; base-uri 'self'; form-action 'none'; manifest-src 'self';
connect-src * blob:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self';
font-src 'self'; frame-ancestors 'none'; frame-src blob:; img-src 'self' data: blob:;
media-src blob:; object-src blob:;
sandbox allow-same-origin allow-scripts allow-forms allow-modals allow-downloads
```

---

## 4. Key Identifiers & Tokens

| Item | Algorithm | Format |
|------|-----------|--------|
| Paste ID | `fnv1a64(ciphertext)` | 16 lowercase hex chars |
| URL key (Standard / Shamir) | 32 random bytes → base58 | ~43 base58 chars in `#fragment` |
| Recipient Key (RSA-OAEP Asym Mode) | RSA-2048/4096 OAEP keypair | Public key: SPKI base64 (safe to share); Private key: stored in browser IndexedDB |
| RSA-OAEP Wrapped AES Key | `SubtleCrypto.wrapKey('raw', aesKey, rsaPubKey, {name:'RSA-OAEP'})` | ~256 bytes base64 in `adata[4]` |
| Delete token | `HMAC-SHA256(pasteId, per-paste-salt)` | hex string |
| Server salt | `bin2hex(random_bytes(256))` | 512 hex chars, stored once per install |
| IP hash (rate limiter) | `HMAC-SHA256(ip, serverSalt)` | never stored as raw IP |
| Comment icon hash | `HMAC-SHA512(ip, serverSalt)` | used to generate deterministic icon |

---

## 5. Data Flow Diagrams

### 5.1 Standard Mode (Symmetric Key in URL Fragment)

```
[User types secret]
       |
       v
[Browser: random 256-bit key K]
       |
       v
[PBKDF2-SHA256(K + password, salt, 100000 iter) → derivedKey]
       |
       v
[CompressionStream / zlib.deflate(plaintext)]
       |
       v
[AES-256-GCM.encrypt(compressed, derivedKey, IV) → ciphertext]
       |
       v
[POST {ct, adata, meta} to server]   ← KEY NEVER LEAVES BROWSER
       |
       v
[Server stores opaque blob, returns pasteId]
       |
       v
[URL: https://host/?{pasteId}#{base58key}]
       |
       v  (recipient opens URL)
[Browser extracts key from #fragment]
       |
       v
[AES-256-GCM.decrypt(ciphertext, derivedKey) → plaintext]
       |
       v
[Display to recipient]
```

### 5.2 Asymmetric Public-Key Mode (RSA-OAEP Key Wrapping)

```
[Sender types secret + inputs Recipient's RSA Public Key R_pub]
       |
       v
[Tier 1: AES-256-GCM encrypts plaintext with 32-byte Key K — IDENTICAL to standard mode]
       |
       v
[Tier 2: SubtleCrypto.wrapKey('raw', K, R_pub, {name:'RSA-OAEP'}) → wrappedKey]
       |
       v
[POST {ct, adata (wrappedKey in adata[4]), meta} to server]
       |
       v
[URL: https://host/?{pasteId}#asym]   ← NO DECRYPTION KEY IN URL
       |
       v  (recipient opens URL, browser detects #asym sentinel)
[UI: Prompt recipient for RSA Private Key (or load from IndexedDB)]
       |
       v
[SubtleCrypto.unwrapKey(wrappedKey, R_priv, {name:'RSA-OAEP'}) → AES Key K]
       |
       v
[AES-256-GCM.decrypt(ciphertext, K) → plaintext]
       |
       v
[Display to recipient]

Key Security Properties:
• RSA Private Key never leaves recipient's browser
• unwrapKey() returns non-exportable CryptoKey (K never exposed to JS)
• Link can be posted publicly — useless without R_priv
```

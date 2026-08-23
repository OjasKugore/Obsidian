# clonefest
# PrivateBin — Repository Deep Dive

## What is PrivateBin?

**PrivateBin** (v2.0.5) is a minimalist, open-source, self-hosted **pastebin** service built on a **zero-knowledge architecture** — meaning the server _never_ sees or stores unencrypted data. All encryption and decryption happens entirely in the user's browser. It is a fork of the now-abandoned **ZeroBin** project, originally created by Sébastien Sauvage.

> [!IMPORTANT]
> The defining security guarantee: **the server has zero knowledge of stored data**. Even if the server is compromised, the ciphertext alone is useless without the key embedded in the URL fragment (which is never sent to the server).

---

## Objective

The primary objective is to allow users to share sensitive text or files securely over the internet with the following guarantees:

1. **Client-side encryption** — data is encrypted before it ever leaves the browser using **256-bit AES-GCM**.
2. **Zero server knowledge** — the decryption key is stored only in the URL `#fragment`, which browsers do not send to the server.
3. **Deniability for operators** — server admins genuinely cannot read what is stored.
4. **Ephemeral sharing** — pastes can expire after a time, or self-destruct after first read ("burn after reading").
5. **Optional password protection** — adds a second factor on top of the URL key.

---

## High-Level Architecture

```
Browser (Client)                    Server (PHP Backend)
─────────────────                   ────────────────────
  User writes text
        │
  Encrypt (AES-256-GCM)  ──POST──►  Controller.php
  Key stays in URL #frag             │
                                     ├─ Validate / Rate-limit
                                     ├─ Store ciphertext only
                                     └─ Return paste ID

  URL shared with recipient
        │
  Browser fetches paste  ──GET──►   Controller.php
        │                            │
        │ ◄── Encrypted blob ────────┘
        │
  Decrypt using #fragment key
  Display plaintext
```

---

## Technology Stack

### Backend (PHP)

| Component | Details |
|-----------|---------|
| **Language** | PHP 7.4+ / 8.x |
| **Entry point** | [`index.php`](file:///Users/ojaskugore/PrivateBin/index.php) — bootstraps and delegates to `Controller` |
| **Controller** | [`lib/Controller.php`](file:///Users/ojaskugore/PrivateBin/lib/Controller.php) — routes operations: `create`, `read`, `delete`, `jsonld`, URL shortener proxies |
| **Configuration** | [`lib/Configuration.php`](file:///Users/ojaskugore/PrivateBin/lib/Configuration.php) — parses INI-style `cfg/conf.php` with typed defaults |
| **Request** | [`lib/Request.php`](file:///Users/ojaskugore/PrivateBin/lib/Request.php) — handles HTTP input, detects JSON API vs HTML requests |
| **I18n** | [`lib/I18n.php`](file:///Users/ojaskugore/PrivateBin/lib/I18n.php) — browser language detection, translation system |
| **View** | [`lib/View.php`](file:///Users/ojaskugore/PrivateBin/lib/View.php) — renders PHP templates |
| **Filter** | [`lib/Filter.php`](file:///Users/ojaskugore/PrivateBin/lib/Filter.php) — input sanitization |
| **FormatV2** | [`lib/FormatV2.php`](file:///Users/ojaskugore/PrivateBin/lib/FormatV2.php) — validates the v2 paste data format |
| **Vizhash** | [`lib/Vizhash16x16.php`](file:///Users/ojaskugore/PrivateBin/lib/Vizhash16x16.php) — generates IP-based visual avatars for commenters |

### Data Models

| File | Purpose |
|------|---------|
| [`lib/Model/Paste.php`](file:///Users/ojaskugore/PrivateBin/lib/Model/Paste.php) | CRUD for pastes; handles expiry, burn-after-reading, delete tokens (HMAC-SHA256 of paste ID + server salt) |
| [`lib/Model/Comment.php`](file:///Users/ojaskugore/PrivateBin/lib/Model/Comment.php) | CRUD for threaded encrypted comments on pastes |

### Storage Backends (pluggable)

All backends implement the same interface defined in [`lib/Data/AbstractData.php`](file:///Users/ojaskugore/PrivateBin/lib/Data/AbstractData.php):

| Backend | File | Notes |
|---------|------|-------|
| **Filesystem** | [`lib/Data/Filesystem.php`](file:///Users/ojaskugore/PrivateBin/lib/Data/Filesystem.php) | Default; stores pastes as JSON files on disk |
| **Database** | [`lib/Data/Database.php`](file:///Users/ojaskugore/PrivateBin/lib/Data/Database.php) | MySQL, PostgreSQL, SQLite via PDO |
| **Google Cloud Storage** | [`lib/Data/GoogleCloudStorage.php`](file:///Users/ojaskugore/PrivateBin/lib/Data/GoogleCloudStorage.php) | GCS bucket backend |
| **S3 Storage** | [`lib/Data/S3Storage.php`](file:///Users/ojaskugore/PrivateBin/lib/Data/S3Storage.php) | AWS S3 or S3-compatible (e.g., Ceph/Rados) |

### Persistence Utilities

| File | Purpose |
|------|---------|
| [`lib/Persistence/ServerSalt.php`](file:///Users/ojaskugore/PrivateBin/lib/Persistence/ServerSalt.php) | Generates/stores a per-server secret used for HMAC delete tokens |
| [`lib/Persistence/TrafficLimiter.php`](file:///Users/ojaskugore/PrivateBin/lib/Persistence/TrafficLimiter.php) | Rate-limits paste creation per IP (configurable); supports CIDR exemptions and allowlists |
| [`lib/Persistence/PurgeLimiter.php`](file:///Users/ojaskugore/PrivateBin/lib/Persistence/PurgeLimiter.php) | Batches expired paste cleanup to avoid performance spikes |

### URL Shortener Proxies

| File | Purpose |
|------|---------|
| [`lib/Proxy/YourlsProxy.php`](file:///Users/ojaskugore/PrivateBin/lib/Proxy/YourlsProxy.php) | Server-side proxy for YOURLS — hides API key from the browser |
| [`lib/Proxy/ShlinkProxy.php`](file:///Users/ojaskugore/PrivateBin/lib/Proxy/ShlinkProxy.php) | Server-side proxy for Shlink URL shortener |

### Frontend (JavaScript)

| File | Purpose |
|------|---------|
| [`js/privatebin.js`](file:///Users/ojaskugore/PrivateBin/js/privatebin.js) | Core ~207KB frontend: AES-GCM encryption/decryption, paste UI, API calls, attachment handling |
| [`js/zlib.js`](file:///Users/ojaskugore/PrivateBin/js/zlib.js) + `zlib-1.3.2.wasm` | WebAssembly zlib compression (applied before encryption) |
| [`js/showdown-2.1.0.js`](file:///Users/ojaskugore/PrivateBin/js/showdown-2.1.0.js) | Markdown → HTML rendering |
| [`js/prettify.js`](file:///Users/ojaskugore/PrivateBin/js/prettify.js) | Syntax highlighting for code pastes |
| [`js/purify-3.4.12.js`](file:///Users/ojaskugore/PrivateBin/js/purify-3.4.12.js) | DOMPurify — sanitizes rendered HTML to prevent XSS |
| [`js/kjua-0.10.0.js`](file:///Users/ojaskugore/PrivateBin/js/kjua-0.10.0.js) | QR code generation for paste URLs |
| [`js/base-x-5.0.1.js`](file:///Users/ojaskugore/PrivateBin/js/base-x-5.0.1.js) | Base58/base encoding for paste IDs |
| [`js/bootstrap-5.3.8.js`](file:///Users/ojaskugore/PrivateBin/js/bootstrap-5.3.8.js) | Bootstrap 5 UI framework |
| [`js/dark-mode-switch.js`](file:///Users/ojaskugore/PrivateBin/js/dark-mode-switch.js) | Dark mode toggle |
| [`js/legacy.js`](file:///Users/ojaskugore/PrivateBin/js/legacy.js) | Backwards compatibility for older paste formats |

### PHP Dependencies (Composer)

| Package | Version | Purpose |
|---------|---------|---------|
| `jdenticon/jdenticon` | 2.0.0 | SVG identicons for anonymous commenters |
| `yzalis/identicon` | 2.0.0 | Alternative identicon generator |
| `mlocati/ip-lib` | 1.22.0 | IP address & CIDR parsing for rate limiting |
| `symfony/polyfill-php80` | 1.34.0 | PHP 8.0 features on PHP 7.4 |
| `google/cloud-storage` _(optional)_ | 1.45.0 | GCS backend |
| `aws/aws-sdk-php` _(optional)_ | 3.336.2 | S3 backend |

### Testing

- **Backend**: PHPUnit 9 (`tst/` directory — 21 test files covering Controller, Models, Persistence, API, I18n, View, Proxies)
- **Frontend**: JavaScript tests in `js/test/`
- **CI**: GitHub Actions (`.github/`), Scrutinizer, CodeClimate, StyleCI

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🔒 **Zero-knowledge encryption** | AES-256-GCM in browser; key only in URL `#fragment` |
| 🔥 **Burn after reading** | Paste auto-deletes on first view |
| ⏱️ **Expiration** | 5 min / 10 min / 1 hr / 1 day / 1 week / 1 month / 1 year / never |
| 💬 **Discussions** | Encrypted, threaded comments on pastes |
| 🔑 **Password protection** | Extra KDF layer on top of the URL key |
| 📎 **File attachments** | Optional file upload with image/PDF preview |
| 📝 **Formatters** | Plain text, Markdown (Showdown.js), syntax-highlighted code (Prettify.js) |
| 🌍 **i18n** | ~30+ languages, auto-detected from browser |
| 📱 **QR codes** | One-click QR for mobile sharing |
| 🔗 **URL shortener** | Integration with YOURLS and Shlink (server-side proxied to hide API keys) |
| 🎨 **Templates** | Bootstrap 5 (default), dark variants, compact layouts |
| 🛡️ **Security headers** | Strict CSP, HSTS warnings, no inline scripts, SRI support |
| 🚦 **Rate limiting** | Per-IP traffic limiting with CIDR exemptions |
| 🗑️ **Purge system** | Batched cleanup of expired pastes |

---

## Encryption Flow (Technical)

```
User input (plaintext)
    │
    ▼
[zlib compress (wasm)]
    │
    ▼
[AES-256-GCM encrypt]
  key = PBKDF2(random_key [+ password], paste_salt, iterations)
  random_key → stored in URL #fragment
  paste_salt  → stored in adata (authenticated, sent to server)
    │
    ▼
[base64 ciphertext → JSON payload → POST to server]
Server stores only: { ct (ciphertext), adata (auth data), meta (expiry) }
```

The server **never** receives the encryption key. The key lives exclusively in the URL hash fragment after the `#`.

---

## Configuration Highlights ([`cfg/conf.sample.php`](file:///Users/ojaskugore/PrivateBin/cfg/conf.sample.php))

- `[main]` — feature toggles (discussion, password, fileupload, compression, CSP header, icon style, template)
- `[expire_options]` — available expiry durations
- `[formatter_options]` — available paste formats
- `[traffic]` — rate limit seconds and IP exemptions
- `[purge]` — batch cleanup settings
- `[model]` + `[model_options]` — choose storage backend and its credentials
- `[shlink]` / `[yourls]` — URL shortener API config (server-side, never exposed to client)
- `[sri]` — Subresource Integrity hashes for JS files

---

## Project Lineage

```
ZeroBin (Sébastien Sauvage, ~2012)
    └─► PrivateBin (fork, ~2015 onwards)
              Current version: 2.0.5 (July 2026)
              License: zlib/libpng
```

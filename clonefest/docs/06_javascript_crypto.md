# Module 06 — JavaScript Crypto Engine

> Critical module. Read when implementing the crypto layer of the modern app.
> The security of the entire system depends on getting this right.

---

## Overview

All cryptography runs **client-side only** in `js/privatebin.js` via the `CryptTool` module.
The server never sees plaintext, keys, or passwords.

Libraries used:
- `window.crypto.subtle` (Web Crypto API) — AES-256-GCM, PBKDF2
- `zlib-1.3.2.js` + `.wasm` (WebAssembly) — deflate/inflate compression
- `base-x-5.0.1.js` — base58 encoding for URL key

---

## Cipher Spec Array (`adata[0]`)

This array is stored inside `adata` and travels with the ciphertext:

```javascript
spec = [
  getRandomBytes(16),  // [0] IV  — 16 random bytes, base64-encoded in wire format
  getRandomBytes(8),   // [1] salt — 8 random bytes, base64-encoded in wire format
  100000,              // [2] PBKDF2 iterations (NIST minimum: 10001)
  256,                 // [3] AES key size in bits (128|192|256)
  128,                 // [4] GCM auth tag size in bits (64|96|128)
  'aes',               // [5] algorithm identifier
  'gcm',               // [6] mode identifier
  compression,         // [7] 'zlib' or 'none'
  // [8] REMOVED — ephemeralPubKey field (was ECDH draft, superseded by RSA-OAEP in adata[4])
]
```

Wire format encodes `spec[0]` and `spec[1]` as base64 (`btoa()`); the rest are stored as-is. In standard symmetric mode, `adata[0]` is always exactly 8 elements.

**Asymmetric Mode (RSA-OAEP):** The wrapped AES key is placed at the **top-level `adata[4]`** (not inside `spec`), keeping `adata[0]` fully backward-compatible:
```json
adata = [
  ["<iv>", "<salt>", 100000, 256, 128, "aes", "gcm", "zlib"],  // adata[0] — unchanged
  "plaintext",                                                    // adata[1]
  0,                                                              // adata[2]
  0,                                                              // adata[3]
  "<base64 RSA-OAEP wrapped 32-byte AES key>"                     // adata[4] — asym only
]```

---

## Key Derivation (PBKDF2)

```javascript
// 1. Build key material: concat(randomKey bytes, password bytes if set)
let keyArray = stringToArraybuffer(key);  // 32-byte random key
if (password.length > 0) {
  let pwArray = stringToArraybuffer(password);
  let combined = new Uint8Array(keyArray.length + pwArray.length);
  combined.set(keyArray, 0);
  combined.set(pwArray, keyArray.length);
  keyArray = combined;
}

// 2. Import as PBKDF2 base key
const importedKey = await crypto.subtle.importKey(
  'raw', keyArray, { name: 'PBKDF2' }, false, ['deriveKey']
);

// 3. Derive AES-256-GCM key
const derivedKey = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: stringToArraybuffer(spec[1]),  // 8-byte random salt
    iterations: spec[2],                 // 100000
    hash: { name: 'SHA-256' }
  },
  importedKey,
  { name: 'AES-GCM', length: spec[3] }, // 256 bits
  false,                                 // not exportable
  ['encrypt', 'decrypt']
);
```

---

## Asymmetric Key Management (RSA-OAEP Key Wrapping)

For targeted recipient sharing (PGP / Age-like). The **Encryption Engine (AES-256-GCM) is unchanged**; only the Key Management Tier changes.

### Architecture
```
 Tier 1 (always):  AES-256-GCM encrypts plaintext with 32-byte Key K
 Tier 2 (asym):    RSA-OAEP wraps Key K for the specific recipient
```

### Sender Side (Key Wrapping)
```typescript
// 1. Generate or load recipient's RSA Public Key
const recipientPublicKey = await crypto.subtle.importKey(
  'spki',
  recipientPublicKeyBytes,
  { name: 'RSA-OAEP', hash: 'SHA-256' },
  false,
  ['wrapKey']
);

// 2. Encrypt plaintext normally with AES-256-GCM (Tier 1 — unchanged)
const { ciphertext, aesKey, adata } = await encryptAESGCM(plaintext);

// 3. Wrap (encrypt) the 32-byte AES Key K with RSA-OAEP
const wrappedKey = await crypto.subtle.wrapKey(
  'raw',          // export format for AES key
  aesKey,         // The 32-byte AES-256 Key K
  recipientPublicKey,
  { name: 'RSA-OAEP' }
);

// 4. Store wrapped key in adata[4]; URL fragment = '#asym'
adata[4] = base64Encode(wrappedKey);   // ~256 bytes (RSA-2048) or ~512 bytes (RSA-4096)
```

### Recipient Side (Key Unwrapping)
```typescript
// 1. Recipient loads their RSA Private Key (from IndexedDB or prompted input)
const recipientPrivateKey = await crypto.subtle.importKey(
  'pkcs8',
  privateKeyBytes,
  { name: 'RSA-OAEP', hash: 'SHA-256' },
  false,
  ['unwrapKey']
);

// 2. Unwrap AES Key K using RSA Private Key
const aesKey = await crypto.subtle.unwrapKey(
  'raw',
  base64Decode(adata[4]),   // RSA-OAEP wrapped key from adata[4]
  recipientPrivateKey,
  { name: 'RSA-OAEP' },
  { name: 'AES-GCM' },
  false,
  ['decrypt']
);

// 3. Decrypt ciphertext normally with recovered AES Key K (Tier 1 — unchanged)
const plaintext = await decryptAESGCM(ciphertext, aesKey, adata);
```

### Identity Key Management (Browser-Persistent)
```typescript
// Generate RSA-2048 OAEP keypair (one-time, stored in IndexedDB)
const keyPair = await crypto.subtle.generateKey(
  { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' },
  true,
  ['wrapKey', 'unwrapKey']
);

// Export public key for sharing (safe to paste in Slack bio, GitHub, email sig)
const publicKeyBase64 = base64Encode(await crypto.subtle.exportKey('spki', keyPair.publicKey));
```

---

## Encryption Flow (`CryptTool.cipher()`)

```
Input: plaintext (UTF-16 JS string), key (32 random bytes), password, adata

1. Build spec array (random IV + salt)
2. If adata empty → comment mode (adata = encodedSpec)
   If adata[0] === null → paste mode (adata[0] = encodedSpec)

3. utf16To8(message)           → UTF-8 string
4. stringToArraybuffer(utf8)   → Uint8Array
5. zlib.deflate(bytes)         → compressed Uint8Array  [if compression='zlib']
   (skip if 'none' or WASM unavailable)
6. deriveKey(key, password, spec) → CryptoKey
7. crypto.subtle.encrypt(
     { name:'AES-GCM', iv: spec[0], additionalData: JSON.stringify(adata), tagLength: spec[4] },
     derivedKey,
     compressedData
   ) → ArrayBuffer
8. arraybufferToString(cipherbuffer) → binary string
9. btoa(binaryString)               → base64 ciphertext

Return: [base64_ct, adata]
```

**Key detail:** `additionalData` is `JSON.stringify(adata)` — the entire adata array is authenticated by GCM. Tampering with any adata field will cause decryption to fail.

---

## Decryption Flow (`CryptTool.decipher()`)

```
Input: [base64_ct, adata], key, password

1. Parse adata:
   - paste:   spec = adata[1][0]  (nested array)
   - comment: spec = adata[1]     (flat array)
2. spec[0] = atob(spec[0])        → raw IV bytes
3. spec[1] = atob(spec[1])        → raw salt bytes
4. deriveKey(key, password, spec) → CryptoKey
5. crypto.subtle.decrypt(
     { name:'AES-GCM', iv: spec[0], additionalData: JSON.stringify(adata), tagLength: spec[4] },
     derivedKey,
     stringToArraybuffer(atob(base64_ct))
   ) → ArrayBuffer (plaintext bytes)
6. If spec[7] === 'zlib':
     zlib.inflate(new Uint8Array(plaintext)) → decompressed ArrayBuffer
7. arraybufferToString(decompressed) → UTF-8 binary string
8. utf8To16(utf8)                    → UTF-16 JS string

Return: plaintext string
```

---

## Key Generation & URL Encoding

```javascript
// Generate 256-bit (32-byte) random symmetric key
function getSymmetricKey() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return String.fromCharCode(...bytes);  // raw binary string
}

// Encode key for URL fragment (base58, no ambiguous chars)
const base58alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const base58 = new baseX(base58alphabet);

function base58encode(input) {
  return base58.encode(stringToArraybuffer(input));
}

function base58decode(input) {
  return arraybufferToString(base58.decode(input));
}
```

**URL format:** `https://host/?{pasteId}#{base58encodedKey}`
- `pasteId` = 16 lowercase hex chars
- base58 key = ~43 chars
- The `#fragment` is never sent to the server by browsers

---

## Wire Format — v2 Paste POST Body

```json
{
  "v": 2,
  "ct": "<base64 AES-256-GCM ciphertext>",
  "adata": [
    [
      "<base64 IV (16 bytes)>",
      "<base64 salt (8 bytes)>",
      100000,
      256,
      128,
      "aes",
      "gcm",
      "zlib"
    ],
    "plaintext",
    0,
    0
  ],
  "meta": {
    "expire": "1week"
  }
}
```

**`adata` breakdown:**
- `adata[0]` — cipher spec array (8 elements)
- `adata[1]` — formatter: `"plaintext"` | `"syntaxhighlighting"` | `"markdown"`
- `adata[2]` — open_discussion: `0` or `1`
- `adata[3]` — burn_after_reading: `0` or `1`

---

## Wire Format — v2 Comment POST Body

```json
{
  "v": 2,
  "ct": "<base64 ciphertext>",
  "adata": [
    "<base64 IV>",
    "<base64 salt>",
    100000,
    256,
    128,
    "aes",
    "gcm",
    "zlib"
  ],
  "pasteid": "<16hexid>",
  "parentid": "<16hexid>"
}
```

**Note:** For comments, `adata` is the flat cipher spec array (no nesting, no formatter flags).

---

## URL Schema

```
Standard paste (Symmetric — Direct Hash):
  https://example.com/?{pasteid}#{base58key}

Load-confirmation mode:
  https://example.com/?{pasteid}#-{base58key}
  (requires user click to confirm before decryption starts)

Asymmetric / RSA-OAEP mode:
  https://example.com/?{pasteid}#asym
  (no decryption key in URL; recipient unlocks via RSA Private Key + adata[4] wrapped key)

Shamir shard links:
  https://example.com/?{pasteid}#shard-1-{base58shard1}
  https://example.com/?{pasteid}#shard-2-{base58shard2}
```

- `pasteid` = `fnv1a64(ciphertext)` as 16 lowercase hex chars
- `base58key` = 32 random bytes, base58-encoded (~43 chars)
- `#asym` = literal sentinel signaling RSA-OAEP mode to the viewer page

---

## String Encoding Utilities

```javascript
// UTF-16 DOMString → UTF-8 string
function utf16To8(message) {
  return encodeURIComponent(message).replace(
    /%([0-9A-F]{2})/g,
    (match, hex) => String.fromCharCode('0x' + hex)
  );
}

// UTF-8 string → UTF-16 DOMString
function utf8To16(message) {
  return decodeURIComponent(
    message.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
}

// ArrayBuffer → binary string
function arraybufferToString(buf) {
  const arr = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return s;
}

// binary string → Uint8Array
function stringToArraybuffer(str) {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}
```

---

## Compression

- Compression mode is set server-side (config `compression = zlib|none`) and passed to JS via `<body data-compression="zlib">`.
- `zlib` mode uses the bundled WebAssembly zlib (`zlib-1.3.2.js` + `.wasm`).
- Falls back to `none` if WASM is unavailable (old browsers).
- **Modernisation:** Replace with native `CompressionStream` API:
  ```javascript
  // Modern browsers only (Chrome 80+, Firefox 113+, Safari 16.4+)
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const compressed = await new Response(cs.readable).arrayBuffer();
  ```

---

## Security Notes for Modernisation

1. **PBKDF2 blocks the main thread** for ~500ms at 100,000 iterations. Must run in a Web Worker.
2. **IV must be random per paste** — never reuse an IV with the same key.
3. **`additionalData` in GCM** authenticates the entire `adata` structure — any modification breaks decryption. This is intentional.
4. **Password mixing** — password bytes are appended to the random key before PBKDF2, not used separately.
5. **Base58 key** — chosen over base64 because it avoids `+`, `/`, `=` which can be mangled by URL parsers or email clients.
6. **RSA-OAEP key wrapping** — the RSA Private Key never leaves the browser; `SubtleCrypto.unwrapKey()` returns a non-exportable AES-GCM CryptoKey directly. The plaintext AES key is never accessible to JavaScript code.
7. **RSA key size** — use RSA-2048 minimum; RSA-4096 for long-lived identity keys. RSA-OAEP with SHA-256 is NIST-approved for key transport.

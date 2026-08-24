# ADR-001: WebCrypto API & In-Browser AES-256-GCM Tier 1 Encryption

## Status
Accepted

## Context
PrivateBin originally implemented cryptography using legacy JS libraries (SJCL) executed on the main browser thread. For Obsidian, we required a modern, standardized, high-performance cryptographic primitive with hardware acceleration and zero dependencies.

## Decision
We adopted the W3C **Web Cryptography API (`SubtleCrypto`)** as the non-negotiable Tier 1 encryption engine for all pastes and comments:
- **Cipher:** AES-256-GCM (`AES-GCM` with 256-bit keys and 128-bit authentication tags).
- **Key Derivation:** PBKDF2-SHA256 with $\ge 100,000$ iterations.
- **Key Isolation:** Symmetric keys are retained strictly in the client URL fragment (`#<keyBase58>`) and are never sent over HTTP requests.
- **Thread Isolation:** PBKDF2 operations are offloaded to a Web Worker via Comlink to prevent main-thread UI lag.

## Consequences
### Positive
- Native browser C++ execution: encrypt/decrypt operations execute in $< 5$ ms.
- Zero external cryptographic runtime vulnerabilities.
- Cryptographic authentication: GCM tags ensure ciphertext tampering is immediately detected.

### Negative
- Requires HTTPS / Secure Contexts (enforced in production via Strict-Transport-Security).

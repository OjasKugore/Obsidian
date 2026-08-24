# ADR-006: Zero-Knowledge Threat Model, Proof of Destruction & CSP

## Status
Accepted

## Context
A zero-knowledge application is only as secure as its trust boundaries, threat model, and host security headers. If malicious scripts can inject into the page or servers can forge destruction claims, users cannot trust the system.

## Decision
We implemented a multi-layered zero-knowledge security framework:
1. **Strict Content Security Policy (CSP):** `script-src 'self' 'nonce-{nonce}'`, `connect-src 'self' https://*.pusher.com`, `frame-ancestors 'none'`, prohibiting inline scripts and unauthorized external network exfiltration.
2. **Cryptographic Proof of Destruction (Burn Receipts):** When a paste is destroyed (via burn-after-reading or N-views exhausted), the server generates an HMAC-SHA256 signed burn receipt containing `receiptId`, `pasteIdHash`, `timestamp`, and `reason`, verifiable via `/api/v1/receipt/[id]`.
3. **Zero Plaintext Logging:** Access logs and rate limit keys exclusively store salted HMAC hashes (`HMAC-SHA256(ip, serverSecret)`).

## Consequences
### Positive
- Verifiable audit trail proving secrets are purged.
- Total protection against XSS exfiltration of in-memory keys.

# PrivateBin Modernisation — Module Index

> This folder contains a modular breakdown of the full technical reference.
> Each file is scoped to one concern so an AI coding agent can load only what it needs.

---

## Module Map

| File | Topic | When to Read |
|------|-------|-------------|
| [`01_overview_and_security.md`](./01_overview_and_security.md) | Project identity, zero-knowledge model, security architecture | Always — read first |
| [`02_http_routing_and_api.md`](./02_http_routing_and_api.md) | HTTP routing, operations, JSON API contract, REST endpoints | When building the API layer |
| [`03_php_backend_classes.md`](./03_php_backend_classes.md) | Every PHP class: Controller, Request, Model, Paste, Comment, View, I18n, Proxy | When understanding or porting the backend |
| [`04_storage_backends.md`](./04_storage_backends.md) | AbstractData interface, Filesystem, Database (SQL schema), GCS, S3 | When choosing/implementing a storage layer |
| [`05_configuration_reference.md`](./05_configuration_reference.md) | Every config key, type, default, and backend config examples | When configuring or porting the config system |
| [`06_javascript_crypto.md`](./06_javascript_crypto.md) | CryptTool, PBKDF2, AES-256-GCM, encryption/decryption pipelines, wire format, URL schema | When implementing the crypto module |
| [`07_javascript_frontend.md`](./07_javascript_frontend.md) | All 18 JS internal classes, bundled libraries, template system, i18n | When building the frontend |
| [`08_testing_and_deps.md`](./08_testing_and_deps.md) | PHP + JS test files, Composer deps, npm deps, CI commands, deployment | When setting up tests or CI/CD |
| [`09_technical_debt.md`](./09_technical_debt.md) | Known weaknesses, modernisation guide, stack recommendations, migration tasks | When planning the modernisation |
| [`10_hackathon_build_plan.md`](./10_hackathon_build_plan.md) | Full hackathon build plan: tech stack, features, architecture, UX spec, demo script, scoring | When building the new product (Obsidian) |

---

## Quick Reference — Critical Rules for Modernisation

1. **Key stays in URL fragment** — never sent to server, never logged
2. **AES-256-GCM with PBKDF2 (>=100k iterations)** — all client-side via `SubtleCrypto`
3. **Burn-after-reading must be atomic** — delete before returning ciphertext, in one DB transaction
4. **v2 wire format must be preserved** — `adata[0]` = `[iv, salt, iter, keySize, tagSize, 'aes', mode, compression]`
5. **Paste ID** = `fnv1a64(ciphertext)` as 16 hex chars
6. **Delete token** = `HMAC-SHA256(pasteId, per-paste-salt)`
7. **CSP** = strict, `script-src 'self'`, no `'unsafe-inline'`
8. **Asymmetric Mode (RSA-OAEP)** = AES Key K wrapped with `SubtleCrypto.wrapKey(RSA-OAEP)`; stored in `adata[4]`; private key stays in browser IndexedDB — URL contains only `#asym` sentinel

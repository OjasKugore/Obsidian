# ADR-004: Asymmetric RSA-OAEP Key Wrapping & Non-Exportable Keystore

## Status
Accepted

## Context
Standard symmetric paste links carry the decryption key in the `#fragment`. If a link is accidentally shared in a public Slack channel or compromised chat, anyone with the link can decrypt. We needed a mode where only a specific recipient can read the secret, even if the URL is leaked publicly.

## Decision
We implemented **RSA-OAEP Key Wrapping** (`lib/crypto/asymmetric.ts`):
- Plaintext is encrypted normally with a fresh 32-byte AES-256-GCM key $K$.
- $K$ is wrapped (encrypted) with the recipient's RSA-2048/4096 Public Key using `SubtleCrypto.wrapKey('raw', aesKey, rsaPublicKey, { name: 'RSA-OAEP' })`.
- The wrapped key (~256 bytes) is stored in `adata[4]`.
- The URL fragment is `#asym` with **no decryption key in the URL**.
- Private keys are stored in an isolated, non-exportable IndexedDB keystore (`lib/crypto/keystore.ts`).

## Consequences
### Positive
- Public link leakage is harmless: only the holder of the corresponding RSA private key can unwrap $K$.
- Seamless identity generation in header identity panel.

### Negative
- Senders must possess the recipient's public key beforehand (supported via raw base64, file import, or GitHub username lookup `github:<user>`).

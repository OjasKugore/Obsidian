# ADR-003: Pure TypeScript Shamir's Secret Sharing (SSS) GF(2^8)

## Status
Accepted

## Context
Multi-party secret authorization (e.g., board approvals, dual-custody database unsealing, incident response) requires splitting a secret among $N$ custodians such that any $K$ can reconstruct it, while fewer than $K$ gain zero mathematical information.

## Decision
We implemented a zero-dependency, pure TypeScript Galois Field $GF(2^8)$ Shamir's Secret Sharing engine (`lib/crypto/shamir.ts`):
- Uses standard Rijndael irreducible polynomial $x^8 + x^4 + x^3 + x + 1$ ($0x11b$).
- Precomputed log and exponent tables for constant-time finite field arithmetic.
- Lagrange polynomial interpolation evaluated at $x = 0$ to reconstruct the 32-byte AES key.
- Shards encoded as `shard-k-n-index-hexData` and distributed across $N$ distinct URLs.

## Consequences
### Positive
- Information-theoretic security: an adversary with $K - 1$ shards learns literally nothing about the key.
- Shard holders can collaborate asynchronously or combine shards in-browser via `ShardQuorumPanel`.

### Negative
- Splitting creates $N$ distinct shard URLs that must be distributed across communication channels.

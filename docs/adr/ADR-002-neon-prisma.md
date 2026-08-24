# ADR-002: Neon PostgreSQL & Atomic Row Locking for Burn-After-Reading

## Status
Accepted

## Context
PrivateBin relied on flat filesystem directory structures or SQLite for storage, which suffered from race conditions during concurrent reads on burn-after-reading pastes (two concurrent GET requests could both read the secret before disk deletion completed).

## Decision
We chose **Neon Serverless PostgreSQL** paired with **Prisma ORM**:
- **Atomic Single-Transaction Burn:** Atomic reads execute inside a PostgreSQL isolation block (`SELECT FOR UPDATE → DELETE → RETURN`).
- **N-View Destruction:** Automatic deletion triggers atomically within the transaction once `views + 1 >= maxViews`.
- **IP Anonymization:** Access logs store `HMAC-SHA256(raw_ip, server_secret)` instead of raw IP addresses.

## Consequences
### Positive
- Strict mathematical guarantee that a burn-after-reading paste can NEVER be returned more than once, regardless of concurrent request spikes.
- Instant serverless scale with Neon connection pooling.

### Negative
- Requires a relational database connection string (`DATABASE_URL`).

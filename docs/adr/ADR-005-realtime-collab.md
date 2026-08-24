# ADR-005: Real-Time E2EE Collaboration with Pusher & BroadcastChannel

## Status
Accepted

## Context
Collaborative editing of sensitive secrets (e.g., incident runbooks, API rotations) typically requires central plaintext servers (like Google Docs or Etherpad), violating zero-knowledge guarantees.

## Decision
We implemented a blind relay architecture for real-time collaboration (`hooks/useCollab.ts`):
- **Transport:** Pusher presence channels (`presence-collab-{pasteId}`) with fallback to browser `BroadcastChannel` for multi-tab sync.
- **End-to-End Encryption:** All delta broadcast payloads and typing statuses are encrypted client-to-client with AES-256-GCM using the paste's symmetric key.
- **Zero-Knowledge Relay:** Pusher acts as a blind relay and cannot inspect or alter collaborative edits.
- **Lock & Seal Action:** Any collaborator can re-encrypt the finalized state, persist it to PostgreSQL (`PUT /api/v1/paste/[id]`), broadcast an instant lock signal, and seal the paste.

## Consequences
### Positive
- Real-time multi-user editing with 0% server plaintext exposure.
- Works offline/locally between browser tabs via `BroadcastChannel`.

### Negative
- Asymmetric RSA pastes cannot support anonymous multi-user real-time collaboration (enforced via UI mutual exclusion).

# ADR-001: Replace Make with Cloudflare-native CEO Notes automation

**Status:** ACCEPTED FOR STAGED IMPLEMENTATION  
**Date:** 2026-11-15  
**Scope:** CEO Notes only. This decision does not authorize a production deployment, merge, public post, or activation of any scheduled publisher.

## Decision

Use the existing Cloudflare Worker as the CEO Notes automation runtime, with SQLite-backed Durable Objects for serialized state transitions and the outbox, the isolated preview KV for preview data, and Cloudflare Cron Triggers for scheduling only after release gates pass.

Do not install Activepieces or n8n for this project. Do not retain Make as a runtime dependency after the native implementation has passed the complete acceptance suite. GitHub Actions remains CI only, not the social-publishing engine.

This is a targeted replacement for the CEO Notes workflows. It is not a mandate to migrate unrelated Royal Egypt Group, OCTOPUSA, or other project automations.

## Why this decision fits the project constitution

| Criterion | Required standard | Cloudflare-native result |
|---|---|---|
| Cost | Zero budget; no new paid plan, card, or recurring service | Uses the existing Cloudflare account and Free-plan allowances. Exceeding Free limits must fail closed; no automatic upgrade. |
| Security | Secrets server-side; least privilege; no credential leakage | Meta credentials belong only in Worker Secrets. Never store them in Git, KV, D1, logs, Make, or chat. |
| Data boundaries | CEO Notes remains independent of Royal Egypt Properties | Dedicated Worker, KV, outbox identities and pinned Page/Instagram IDs. |
| Reliability | Idempotency, concurrency control, receipts, recovery | SQLite Durable Object outbox, per-day isolation, explicit state transitions, unknown-outcome blocking and reconciliation. |
| Truthful delivery | A successful HTTP response is not proof of publication | Worker must read the resulting object back from Meta and verify ID, owner/Page identity, permalink and published status itself. |
| Approval | No public post without owner authorization | Preview has no publishing Cron or Meta credentials. Production publishing remains disabled until explicit controlled-post approval and release gates. |
| Portability and maintainability | Avoid another platform and its hidden hosting costs | Uses the existing Worker codebase, GitHub CI and Cloudflare resources already in use. |

## Alternatives reviewed

### Activepieces Community Edition

Not selected. Its self-hosted production-oriented installation uses Docker Compose, PostgreSQL and Redis; the official requirements list at least 2 vCPU and 4 GB RAM. The one-container hobbyist setup is useful for local evaluation, but it does not provide a reliable, always-on, zero-cost hosted runtime for this project. A free software license does not make the host machine, uptime, backups, or public webhook access free.

Official references:
- https://www.activepieces.com/docs/install/options/docker-compose
- https://www.activepieces.com/docs/install/options/docker

### n8n Community Edition

Not selected. Self-hosting is free for internal use under its Sustainable Use License, but still requires a continuously available host and operational maintenance. The license also imposes restrictions on offering n8n itself as a service or exposing workflow-building/configuration to outside customers. It adds a second runtime rather than using the existing Cloudflare deployment.

Official references:
- https://docs.n8n.io/sustainable-use-license/
- https://support.n8n.io/article/can-i-use-your-license-for-my-use-case

### GitHub Actions

Retained for CI, syntax checks, unit tests and configuration guards. Not selected as the publisher runtime: it is not the right place for durable social-publication state, platform credentials and real-time reconciliation.

Official reference:
- https://docs.github.com/en/actions/administering-github-actions/usage-limits-billing-and-administration

### Cloudflare-native Worker

Selected. The current Free plan documents 100,000 Worker requests/day, 10 ms CPU per invocation and five Cron Triggers per account. SQLite-backed Durable Objects are available on Workers Free with bounded daily/storage allowances; exceeding Free limits fails rather than silently upgrading the account. Limits must be monitored and the system must stop safely on quota errors.

Official references:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/

## Required target architecture

1. **Editorial queue:** retain the existing CEO Notes content schema and canonical feed. Do not rewrite historical posts or generate a second draft for the same Cairo publishing day.
2. **Approval gate:** only an owner-approved content hash can enter the publishing queue. Approval must be explicit and auditable; a caller-supplied `approved: true` flag alone is not sufficient.
3. **Scheduler:** one Cloudflare Cron entry point checks the Africa/Cairo local time and processes only approved, due work. Keep backup scheduling separate from publishing eligibility.
4. **Outbox:** one reservation per day, platform and pinned identity; atomic state transitions; no blind retry after timeout; preserve `unknown` until authoritative reconciliation.
5. **Native Meta adapter:** publish through the official Meta Graph APIs from the Worker. Do not use scraping, browser automation, unofficial schedulers, or Make as a hidden execution dependency.
6. **Independent verification:** the Worker itself reads the created Facebook Page post or Instagram media object from Meta. It verifies the pinned destination ID, returned post/media ID, permalink and published state before marking the outbox `succeeded`. A Make/HTTP caller must never be able to self-attest publication by sending strings such as `verificationSource=facebook_graph_api`.
7. **Receipts and audit:** store minimal durable receipt metadata, state transitions, timestamps and content hashes. Never store access tokens or authorization headers in logs or receipts.
8. **Recovery:** checksum-verified backup and preview-only restore rehearsal; unknown outcomes require read-back or manual review, never automatic duplicate publication.
9. **Isolation:** Preview uses only its dedicated KV and SQLite Durable Object namespace, has no AI binding, no publishing Cron, no Meta secrets and no production data. Production secrets and bindings remain untouched until authorized release gates pass.

## Non-negotiable release gates

- [x] The staged Worker removes the caller-attestation trust boundary for `/api/outbox/verify`: it performs Meta read-back itself, ignores caller-supplied proof fields, and fails closed when the required Worker Secret is absent. Unit tests cover Facebook and Instagram identity checks, wrong destination and missing credentials. Live Meta verification remains untested until credentials are independently authorized in Preview.
- [ ] Native Facebook Page and Instagram publishing adapters use only the pinned CEO Notes identities:
  - Facebook Page: `115226621594988`
  - Instagram professional account: `17841402949410977`
- [ ] Meta API credentials are independently authorized and stored as Cloudflare Worker Secrets. Never copy Make connection secrets into source, logs, chat, or client-side code.
- [ ] Preview-only secret and isolated integration tests are configured without production credentials.
- [ ] Tests cover concurrent reservations, duplicate suppression, partial channel failure, API timeout after remote success, token expiry, wrong destination identity, read-back mismatch, backup/restore failure and safe retry.
- [ ] Cron remains absent from Preview and publishing remains disabled in Production until the owner approves the controlled first post.
- [ ] The canonical CEO Notes Pages feed and both social destinations are verified independently.
- [ ] The first controlled public post is explicitly approved by the owner. Only after its receipts and read-back pass may the daily schedule be considered for separate approval.
- [ ] Make publishing scenarios remain paused and are not deleted until the native system has passed acceptance and the owner authorizes retirement.

## Current implementation findings (2026-11-15)

- PR #77 stages the v2 outbox and isolated Preview Worker.
- PR #78 adds a dedicated read-only Worker test workflow.
- PR #81 adds Preview-only backup restore and tests.
- PR #81 is a superset of the PR #77 head plus the Worker CI workflow and restore work. It should be the single review line targeting `ceo-notes-site`; do not merge any PR as part of this ADR.
- The staged v2 `/api/outbox/verify` now performs server-side Meta Graph API read-back using Worker Secrets and ignores caller-supplied verification assertions. Unit tests cover Facebook and Instagram, wrong destination identity, and missing credentials. The native Meta publishing adapter, owner approval queue and scheduled publisher are not yet implemented.
- Existing `scheduled()` performs backup only. The current Worker is not yet a complete Make replacement and must not be described as one.
- Preview has no Meta credentials, AI binding or Cron. Protected routes remain closed until a unique Preview-only `ADMIN_TOKEN` is set and tested. No live Meta verification has been claimed.
- Cloudflare API credentials previously returned HTTP 401. No deployment, binding, secret or production setting may be changed until the correct Cloudflare account is reconnected and read-only identity verification succeeds.

## Cost and AI policy

The automation runtime must not introduce paid services. Do not enable Workers Paid, R2, paid image APIs, paid connectors, or any billing upgrade. Existing Workers AI generation/image calls are a separate usage dependency: check current Free-plan availability and quota before any invocation. If free quota is unavailable, stop and leave the draft for manual preparation; do not silently substitute a paid model or provider.

## Rollback

Keep Make publisher scenarios paused while validating the native runtime. On any failed gate, leave publishing disabled, preserve feed/outbox/backups, and do not delete a remote post or credential as a cleanup shortcut. Reconcile ambiguous platform outcomes before another attempt.

# CEO Notes AI Worker

This directory tracks the source deployed as the Cloudflare Worker `ceo-notes-ai`.

## Current runtime

- Worker: `ceo-notes-ai`
- Public feed and image delivery use the `CEO_NOTES_KV` namespace.
- AI inference uses the `AI` Workers AI binding.
- The existing Cron Trigger remains a daily backup at `0 2 * * *` UTC.
- The deployed source backup from before access hardening is retained in KV under `backup:2026-11-11:worker-source-pre-hardening`.

## Security

The generation, image-generation, and archive-write routes require an `Authorization: Bearer <ADMIN_TOKEN>` header. Requests fail closed when `ADMIN_TOKEN` is absent or shorter than 32 characters. Public read-only feed and image-delivery routes remain available.

Set `ADMIN_TOKEN` as a Cloudflare Worker Secret before using the protected routes. Do not commit secrets to this repository or send them in chat.

## Publishing status

This Worker currently generates content/images and writes the local feed archive. It does **not** call the Facebook Graph API. No Facebook Page access tokens are currently bound to this Worker, so Facebook publishing must remain disabled until credentials are added securely and each Page's result can be recorded independently with retry-safe idempotency.

Do not add a publishing Cron Trigger until the full end-to-end workflow is implemented and verified. The current Cron is backup-only.

## Outbox coordination (staged v2)

The staged `worker-v2.js` implementation requires a Durable Object binding named `OUTBOX_COORDINATOR` targeting the exported `CEOOutboxCoordinator` class. Use a SQLite-backed Durable Object migration (`new_sqlite_classes`) for this class. Do not point a preview Worker at the production feed/KV namespace; provision an isolated preview namespace and validate the full deployment plan before binding anything.

Outbox state is sharded into one SQLite-backed Durable Object per published day, so unrelated days do not contend on a single global coordinator. Each object uses the synchronous SQLite-backed `storage.kv` API for atomic state transitions without holding `blockConcurrencyWhile` across requests. Same-day editorial generation, image creation, and feed publication use a separate date-keyed lease in a date-specific object; the lease is released in `finally` and expires after 15 minutes if an execution disappears. A reservation can be claimed only once; repeated concurrent reserve calls are blocked. Ambiguous publish outcomes remain blocked until reconciled. A receipt is first recorded as `receipt_recorded` and is not considered successful until `/api/outbox/verify` performs a server-side Meta Graph API read-back. The Worker ignores caller-supplied verification assertions and checks the returned post/media ID, pinned destination identity and permalink itself. Meta credentials are read only from Worker Secrets (`META_FACEBOOK_PAGE_ACCESS_TOKEN` and `META_INSTAGRAM_ACCESS_TOKEN`); they are never accepted from request bodies, stored in KV, or logged. Unknown outcomes after a publish attempt remain blocked; a caller cannot clear an attempt by claiming `not_found`, and unresolved cases require authoritative resolution or manual review. The Worker pins the CEO Facebook Page and CEO Notes Instagram account IDs; callers cannot substitute the Royal Egypt Properties identity. The native Meta publishing adapter and owner-approval queue are still outstanding release gates.

Supported CEO Notes identities are Facebook `ceo-page` and Instagram `ceo-notes`. Corporate Royal Egypt Properties identities are deliberately rejected. The daily backup walks published feed days, snapshots each corresponding day-specific coordinator, combines the records into the existing KV backup, and records their count and SHA-256 in manifest version 3. Unit tests cover backup capture; a full restore rehearsal is still a separate release gate and has not been claimed.

Before enabling a deployment:
1. Create an isolated preview KV namespace and bind it as `CEO_NOTES_KV`; keep `AI` disabled or quota-checked in preview.
2. Add `OUTBOX_COORDINATOR` and a SQLite-class migration for `CEOOutboxCoordinator` in the preview Worker configuration.
3. Set `ADMIN_TOKEN` as a Worker secret (32+ characters); never put its value in source, Make logs, or chat.
4. Complete the native Meta publishing adapter inside the Worker. The adapter must use only Worker Secrets, publish to the pinned CEO Notes destinations, and let the Worker perform its own read-back. Do not pass platform tokens or verification claims through Make or request bodies.
5. Add an auditable owner approval record bound to the exact content hash. A caller-supplied approval boolean is not sufficient.
6. Run concurrency, recovery, backup/restore, token-expiry, destination-mismatch and preview-only integration tests before any production migration or scheduled publishing.

Cloudflare documents bounded Free-plan usage for SQLite-backed Durable Objects. Free-plan overages fail rather than silently charging, but usage must still be monitored. See [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

No production Worker binding, secret, deployment, or Make scenario was changed by this staged code update.

### Preview configuration

`wrangler.preview.jsonc` is a standalone, isolated Worker configuration. It deploys `worker-v2.js` as `ceo-notes-ai-preview`, binds only the dedicated preview KV namespace `CEO_NOTES_PREVIEW_2026_11_12`, and declares the SQLite Durable Object migration for `CEOOutboxCoordinator`. It sets `PREVIEW_MODE=true`, so an empty preview KV seeds an empty feed rather than downloading production editorial content. It intentionally has no AI binding and no cron trigger, so preview validation cannot spend Workers AI quota or run production-style scheduled backups. The public read-only `/health` endpoint checks that the KV and Durable Object bindings are present and that the coordinator can be invoked; all `/api/*` routes still fail closed until a separate preview `ADMIN_TOKEN` secret is configured. The preview KV namespace ID is `8dabeef7884e4c68bb50e48f51e82389`; it is not the production namespace. CI asserts that the preview config never points at the production KV ID.

The isolated preview Worker `ceo-notes-ai-preview` is deployed with the dedicated preview KV namespace and SQLite-backed Durable Object binding. It has no Workers AI binding, no Cron trigger, and no `ADMIN_TOKEN` secret yet. Public `/health` and `/feed` are read-only; protected `/api/*` routes fail closed until a unique preview-only secret is added. Never reuse the production token in preview. Runtime HTTP checks remain pending because the available verification channel cannot reach the `workers.dev` host; verify from Termux or the Cloudflare dashboard after setting the preview secret.


## Review state

The v2 worker and preview configuration are staged for review only. No production Worker, production KV, live feed, Pages deployment, Make scenario, or social account is changed by this source branch.


## Serving boundary

The canonical editorial website is the separate Cloudflare Pages project `ceo-notes`. This AI Worker is API-only: it serves health, feed, and image endpoints, and does not fetch or serve HTML from the Royal Egypt Group `main` branch or any other site branch.

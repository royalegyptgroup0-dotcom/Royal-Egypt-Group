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

The coordinator serializes each outbox transition inside `blockConcurrencyWhile` and stores per-platform records in strongly consistent Durable Object storage. A reservation can be claimed only once; repeated concurrent reserve calls are blocked. Ambiguous publish outcomes remain blocked until reconciled. A receipt is first recorded as `receipt_recorded` and is not considered successful until the separate `/api/outbox/verify` action receives a matching platform lookup attestation (post ID, permalink, platform-specific Graph API source, and published status). The Worker validates the attestation fields; it does not call Meta itself. Make must perform the actual Graph API read-back before submitting the attestation, so this remains an integration trust boundary until that step is implemented and tested.

Supported CEO Notes identities are Facebook `ceo-page` and Instagram `ceo-notes`. Corporate Royal Egypt Properties identities are deliberately rejected. The daily backup snapshots coordinator records into the existing KV backup and records their count and SHA-256 in manifest version 3.

Before enabling a deployment:
1. Create an isolated preview KV namespace and bind it as `CEO_NOTES_KV`; keep `AI` disabled or quota-checked in preview.
2. Add `OUTBOX_COORDINATOR` and a SQLite-class migration for `CEOOutboxCoordinator` in the preview Worker configuration.
3. Set `ADMIN_TOKEN` as a Worker secret (32+ characters); never put its value in source, Make logs, or chat.
4. Update Make to call `receipt` followed by authoritative platform verification and `verify`. A receipt payload or a successful HTTP response alone is not proof of a public post.
5. Run concurrency, recovery, backup/restore, and preview-only integration tests before any production migration or scenario activation.

Cloudflare documents SQLite-backed Durable Objects on Workers Free with daily limits of 5 million rows read, 100,000 rows written, and 5 GB total stored data. Free-plan overages fail rather than charging, but usage must still be monitored. See [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

No production Worker binding, secret, deployment, or Make scenario was changed by this staged code update.

### Preview configuration

`wrangler.preview.jsonc` is a standalone, isolated Worker configuration. It deploys `worker-v2.js` as `ceo-notes-ai-preview`, binds only the dedicated preview KV namespace `CEO_NOTES_PREVIEW_2026_11_12`, and declares the SQLite Durable Object migration for `CEOOutboxCoordinator`. It intentionally has no AI binding and no cron trigger, so preview validation cannot spend Workers AI quota or run production-style scheduled backups. The preview KV namespace ID is `8dabeef7884e4c68bb50e48f51e82389`; it is not the production namespace. CI asserts that the preview config never points at the production KV ID.

The preview config is source-only until a controlled deployment. Do not deploy until a separate preview `ADMIN_TOKEN` has been provisioned and the target Worker configuration, namespace binding, and migration plan have been reviewed. Never reuse the production token in preview.

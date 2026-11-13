# CEO Notes AI Worker

This directory tracks the source deployed as the Cloudflare Worker `ceo-notes-ai`.

## Current runtime

- Worker: `ceo-notes-ai`
- Public feed and image delivery use the `CEO_NOTES_KV` namespace.
- AI inference uses the `AI` Workers AI binding.
- The existing Cron Trigger remains a daily backup at `0 2 * * *` UTC.
- The deployed source backup from before access hardening is retained in KV under `backup:2026-11-11:worker-source-pre-hardening`.

## Security

The generation, image-generation, and archive-write routes accept **POST only** and require an `Authorization: Bearer <ADMIN_TOKEN>` header. Image generation accepts JSON with a `post` object and an `imagePrompt`. Requests fail closed when `ADMIN_TOKEN` is absent or shorter than 32 characters. Public GET routes are read-only; the legacy GET mutation methods return HTTP 405 without writing to KV.

Set `ADMIN_TOKEN` as a Cloudflare Worker Secret before using the protected routes. Do not commit secrets to this repository or send them in chat.

## Publishing status

This Worker currently generates content/images and writes the local feed archive. It does **not** call the Facebook Graph API. No Facebook Page access tokens are currently bound to this Worker, so Facebook publishing must remain disabled until credentials are added securely and each Page's result can be recorded independently with retry-safe idempotency.

The existing Make scenario must also switch its image-generation module from GET query parameters to POST JSON before it can be run. Keep the scenario paused until that change, the Worker secret, independent per-platform outbox/receipts, and partial-failure recovery are verified.

Do not add a publishing Cron Trigger until the full end-to-end workflow is implemented and verified. The current Cron is backup-only.

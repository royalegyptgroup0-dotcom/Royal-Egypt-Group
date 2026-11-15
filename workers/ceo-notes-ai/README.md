# CEO Notes AI Worker

CEO Notes is an independent editorial project. Its native automation runtime is the Cloudflare Worker; Make publisher scenarios remain paused during migration.

## Architecture and boundaries

- Production Worker name: `ceo-notes-ai`.
- Isolated Preview Worker name: `ceo-notes-ai-preview`.
- Canonical website: Cloudflare Pages project `ceo-notes` at https://ceo-notes.pages.dev.
- `CEO_NOTES_KV`: canonical feed, drafts, generated images, metadata and backups.
- `OUTBOX_COORDINATOR`: SQLite-backed Durable Object, sharded by Cairo publishing day.
- GitHub Actions: syntax, unit, recovery and content validation only.
- Activepieces, n8n and Make are not the target runtime.

CEO Notes must never publish to Royal Egypt Properties or Royal Egypt Group corporate destinations. The only pinned social identities are Facebook Page `115226621594988` (`ceo-page`) and Instagram professional account `17841402949410977` (`ceo-notes`). LinkedIn is out of scope.

## API

All `/api/*` routes require POST JSON and `Authorization: Bearer <ADMIN_TOKEN>`. The token must be at least 32 characters and must exist only as a Worker Secret. Public `/health`, `/feed`, `/notes/posts.json` and generated image delivery are read-only.

Editorial workflow:
- `POST /api/generate`: create or reuse one date-keyed Cairo draft.
- `POST /api/image`: create or reuse the image bound to the exact draft hash.
- `POST /api/publish`: publish the approved editorial item into the canonical site feed. This is not social-network publishing.

Native social workflow:
- `POST /api/approval/approve`: records an explicit owner approval for one platform, pinned identity, day and exact SHA-256 content hash. Requires `confirm: "APPROVE_CEO_NOTES_PUBLICATION"`. An optional offset-aware `scheduledFor` timestamp must be in the future.
- `POST /api/approval/status`: read the approval for the exact hash.
- `POST /api/social/publish`: manually publish one approved post to one platform.
- `POST /api/outbox/reserve`, `start`, `receipt`, `verify`, `unknown`, `reconcile`: internal lifecycle exposed through authenticated endpoints for controlled reconciliation.
- `POST /api/backup/restore`: explicit-confirmation Preview-only restore; never available in Production.

A post cannot be published socially unless it already exists in the canonical feed, its image metadata matches its current content hash, and an owner approval exists for the same day, platform, identity and hash. Content hashes are recomputed from the actual feed fields; stale stored hashes do not bypass approval.

## Native Meta adapter

The staged v2 Worker implements both official Graph API adapters:
- Facebook: `POST /{page-id}/photos` with the public generated image URL and editorial caption; records the returned Page `post_id`.
- Instagram: creates a media container with `POST /{ig-user-id}/media`, waits for `FINISHED`, then publishes with `POST /{ig-user-id}/media_publish`.

After either create call, the Worker reads the resulting post/media object back from Meta. It verifies the returned ID, pinned destination identity, permalink and published state before the outbox can become `succeeded`. Caller-supplied verification claims are ignored. Unknown or ambiguous outcomes remain blocked for reconciliation; no blind retry is allowed.

Credentials are separate Worker Secrets:
- `META_FACEBOOK_PAGE_ACCESS_TOKEN`
- `META_INSTAGRAM_ACCESS_TOKEN`

For the Facebook Login Instagram API flow, use a token authorized for the pinned professional account and the required Meta permissions, including `instagram_basic` and `instagram_content_publish`; Facebook Page publishing requires the Page task and permissions documented by Meta, including `pages_manage_posts` and `pages_read_engagement`. The app/account must have the necessary Page and Instagram roles and any required Meta app review. Never store credentials in Git, KV, D1, Make, request bodies, browser storage, logs, receipts or chat. Never copy Make's existing credentials into this Worker.

Official references:
- [Meta Page Feed and publishing](https://developers.facebook.com/docs/graph-api/reference/page/feed/)
- [Meta Page Photo publishing](https://developers.facebook.com/docs/graph-api/reference/photo/)
- [Instagram Media object](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/)

## Scheduling

The scheduler is deliberately inert unless `PUBLISHING_ENABLED=true` and `PREVIEW_MODE` is not true. The production schedule target is 19:30 Africa/Cairo. A `*/15 * * * *` Cron Trigger checks the Cairo clock and only runs at 19:30; it publishes only posts with a due, exact-hash owner approval. A separate backup Cron remains independent. Preview has no Cron Triggers and cannot publish even if a publishing flag is accidentally added.

The current production Worker is still the older generation: its live configuration has the AI binding and production KV but no Durable Object binding, no `ADMIN_TOKEN` secret and no Meta secrets. Its existing backup Cron is `0 2 * * *` UTC. Do not mistake the staged v2 source or a Pages Preview for a production Worker deployment.

## Preview isolation

`wrangler.preview.jsonc` targets only the dedicated Preview KV namespace `CEO_NOTES_PREVIEW_2026_11_12` and the SQLite namespace `ceo-notes-ai-preview_CEOOutboxCoordinator`. Preview has `PREVIEW_MODE=true`, no AI binding, no Meta credentials, no Cron Trigger and no `ADMIN_TOKEN` secret. Its empty KV must never seed from the production feed. Set a unique Preview-only admin secret before exercising protected routes; never reuse a Production secret.

## Release gates

- [x] Server-side Meta read-back and caller-attestation rejection.
- [x] Owner approval persisted per platform and exact content hash.
- [x] Native Facebook and Instagram publishing adapters in staged v2 code.
- [x] Cairo-time scheduler guarded by `PUBLISHING_ENABLED`, with Preview hard-disabled.
- [x] Unit coverage for approval, Facebook/Instagram publish flow, destination verification, missing credentials, stale content hash, ambiguous outcomes and Preview schedule isolation.
- [ ] Deploy v2 to the isolated Preview Worker and verify live health, auth failure, KV/DO readiness and public image URL.
- [ ] Configure a unique Preview `ADMIN_TOKEN` and independent Meta test credentials; complete live Meta read-back tests without public posting.
- [ ] Verify token scopes, expiry handling, Page role, Instagram professional account linkage and Meta app permissions.
- [ ] Complete failure-injection for timeout-after-remote-success, partial channel failure, container timeout, expired tokens and read-back mismatch.
- [ ] Rehearse checksum-verified Preview backup/restore.
- [ ] Deploy to Production only after Preview acceptance, with Production bindings and secrets read back before and after deployment.
- [ ] Keep publishing Cron absent until the first controlled post is separately approved and verified.
- [ ] Obtain explicit approval for the exact first public post; verify both channels independently.
- [ ] Obtain separate approval before enabling the 19:30 Cairo daily schedule.
- [ ] Retire Make publisher scenarios only after native acceptance and separate owner authorization.

No paid plan, card, R2, paid image API, new recurring service, auto-upgrade or customer-data access is permitted. Free quota exhaustion must fail safely. Keep all Make publisher scenarios paused during the migration.

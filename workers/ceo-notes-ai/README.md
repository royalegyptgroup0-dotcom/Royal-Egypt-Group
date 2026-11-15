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

All `/api/*` routes require POST JSON and either a Cloudflare Access-authenticated owner identity (`ctx.access`) or a Bearer `ADMIN_TOKEN` of at least 32 characters stored only as a Worker Secret. The `/admin` dashboard is served only when Cloudflare Access has authenticated the request; a bearer token alone cannot expose the dashboard. Public `/health`, `/feed`, `/notes/posts.json` and generated image delivery are read-only.

Private dashboard and draft workflow:
- `GET /admin`: Access-only Arabic editorial dashboard. It never stores an admin token in browser storage; it uses the Access session cookie for same-origin API requests.
- `POST /api/draft/status`: load the current Cairo-date draft.
- `POST /api/draft/update`: edit the draft, recompute the content hash, and invalidate any image generated for an older hash.

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
- `META_APP_SECRET`

For the Facebook Login Instagram API flow, use a token authorized for the pinned professional account and the required Meta permissions, including `instagram_basic` and `instagram_content_publish`; Facebook Page publishing requires the Page task and permissions documented by Meta, including `pages_manage_posts` and `pages_read_engagement`. The app/account must have the necessary Page and Instagram roles and any required Meta app review. All Graph API calls send the token only to Meta over TLS and include an HMAC-SHA256 `appsecret_proof` generated server-side from `META_APP_SECRET`. Configure Meta's Require App Secret setting to enforce proof validation. Never store credentials in Git, KV, D1, Make, request bodies to this Worker, browser storage, logs, receipts or chat. Never copy Make's existing credentials into this Worker.

Official references:
- [Meta Page Feed and publishing](https://developers.facebook.com/docs/graph-api/reference/page/feed/)
- [Meta Page Photo publishing](https://developers.facebook.com/docs/graph-api/reference/photo/)
- [Instagram Media object](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/)

## Scheduling

The scheduler is deliberately inert unless `PUBLISHING_ENABLED=true` and `PREVIEW_MODE` is not true. The production schedule target is 19:30 Africa/Cairo. A `*/15 * * * *` Cron Trigger checks the Cairo clock and only runs at 19:30; it publishes only posts with a due, exact-hash owner approval. A separate backup Cron remains independent. Preview has no Cron Triggers and cannot publish even if a publishing flag is accidentally added.

The current production Worker is still the older generation: its live configuration has the AI binding and production KV but no Durable Object binding, no `ADMIN_TOKEN` secret and no Meta secrets. Its existing backup Cron is `0 2 * * *` UTC. Do not mistake the staged v2 source or a Pages Preview for a production Worker deployment.

## Access protection

The dashboard and every `/api/*` route must be protected by Cloudflare Access path-based applications on the Preview and Production `workers.dev` hostnames. Protect `/admin*` and `/api/*` while leaving `/health`, `/feed`, `/notes/posts.json` and `/image/*` public. The Worker independently checks `ctx.access` for the dashboard and accepts Access identity for API authorization; requests without Access or a valid Bearer token are rejected. Cloudflare Access is not enabled in the current account yet, so the dashboard intentionally returns 401 until Zero Trust is enabled and the owner-only Access policies are created. Use a Cloudflare-account-member policy rather than a broad email-domain or Everyone policy. See [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

## Preview isolation

`wrangler.preview.jsonc` targets only the dedicated Preview KV namespace `CEO_NOTES_PREVIEW_2026_11_12` and the SQLite namespace `ceo-notes-ai-preview_CEOOutboxCoordinator`. Preview has `PREVIEW_MODE=true`, no AI binding, no Meta credentials, no Cron Trigger and no `ADMIN_TOKEN` secret. Its empty KV must never seed from the production feed. Enable Cloudflare Access and create owner-only policies for `/admin*` and `/api/*` before exercising the dashboard; never expose a client-side token or reuse a Production secret.

## Release gates

- [x] Server-side Meta read-back and caller-attestation rejection.
- [x] Owner approval persisted per platform and exact content hash.
- [x] Native Facebook and Instagram publishing adapters in staged v2 code.
- [x] Cairo-time scheduler guarded by `PUBLISHING_ENABLED`, with Preview hard-disabled.
- [x] Unit coverage for approval, Facebook/Instagram publish flow, destination verification, missing credentials, stale content hash, ambiguous outcomes and Preview schedule isolation.
- [x] Deploy v2 to the isolated Preview Worker; verify deployment metadata, dedicated KV/DO bindings, no AI binding, no Cron and no Worker Secrets.
- [ ] Enable Cloudflare Access in the account and protect Preview `/admin*` and `/api/*` with an owner-only policy.
- [ ] Verify live Preview `/health`, Access login, protected dashboard, API authorization, KV/DO readiness and public image URL.
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

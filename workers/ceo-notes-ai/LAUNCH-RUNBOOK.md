# CEO Notes Official Launch Runbook

**Status:** STAGED IMPLEMENTATION — LIVE SOCIAL PUBLISHING NOT YET AUTHORIZED

- Website: https://ceo-notes.pages.dev
- Pages project: `ceo-notes`
- Production Worker: `ceo-notes-ai`
- Isolated Preview Worker: `ceo-notes-ai-preview`
- Legacy Make publisher scenario: `8438190` (must remain paused)

## 1. Project and identity boundary

CEO Notes is an independent editorial project. It is not Royal Egypt Group corporate publishing and must never publish to Royal Egypt Properties destinations.

| Channel | Pinned identity | ID |
|---|---|---|
| Facebook | CEO Page | `115226621594988` |
| Instagram | CEO Notes / @kiritoon | `17841402949410977` |

Never route CEO Notes content to Royal Egypt Properties, Royal Egypt Group LinkedIn Company Page, or any other corporate identity. LinkedIn personal-profile publishing is a separate project and is not authorized here.

Keep existing Make connections intact while all Make publisher scenarios remain paused. Do not copy Make credentials into Cloudflare. Do not delete Make scenarios until the native system has passed acceptance and the owner separately authorizes retirement.

## 2. Selected zero-new-service runtime

- Cloudflare Worker: orchestration and Meta API adapter.
- SQLite-backed Durable Object: per-day locks, approvals and publication outbox.
- Dedicated Cloudflare KV: editorial feed, drafts, images and backups.
- Cloudflare Cron Triggers: backup and the guarded Cairo-time scheduler.
- GitHub Actions: CI and validation only.

Activepieces and n8n are not part of the selected architecture. Their self-hosted editions still require a continuously available host and maintenance. No new paid service, paid plan, payment card, R2, paid image API, recurring charge or automatic plan upgrade is allowed.

## 3. Staged native API

All state-changing `/api/*` endpoints require POST JSON and either an authenticated Cloudflare Access owner identity or `Authorization: Bearer <ADMIN_TOKEN>`. The Bearer secret, if used for non-browser automation, must be at least 32 characters and stored only in Worker Secrets. The Arabic `/admin` dashboard requires Cloudflare Access and never asks the browser to store a bearer token.

Private owner interface:
- `GET /admin` serves the Arabic editorial dashboard only when `ctx.access` is present.
- Cloudflare Access must protect `/admin*` and `/api/*` on the Worker hostname. Keep `/health`, `/feed`, `/notes/posts.json` and `/image/*` public.
- The dashboard uses the Access session for same-origin API calls; it has no localStorage/sessionStorage token.

Editorial flow:
1. `POST /api/draft/status` loads the current Cairo-date draft.
2. `POST /api/generate` creates or reuses the current Cairo-date draft.
2. `POST /api/image` creates or reuses the matching image.
3. `POST /api/publish` saves the item to the canonical CEO Notes feed. This does not publish to social networks.

Approval flow:
1. `POST /api/approval/approve` requires day, platform, pinned identity, exact content hash and `confirm: "APPROVE_CEO_NOTES_PUBLICATION"`.
2. An optional `scheduledFor` must be an offset-aware ISO timestamp in the future and resolve to exactly 19:30 Africa/Cairo.
3. Approval is persisted in the day-specific Durable Object, with owner label, timestamp, platform, target identity and content hash.
4. An approval for one channel does not approve the other channel. Any change to the article fields invalidates the hash and blocks publication.

Native publishing preflight:
- `POST /api/meta/verify` checks the Meta app ID, token validity, required scopes, expiry window, exact Facebook Page identity and the pinned Instagram professional account linkage. It is read-only and does not create posts.
- Configure `META_APP_ID` as a non-secret Worker variable.
- Configure `META_FACEBOOK_PAGE_ACCESS_TOKEN`, `META_INSTAGRAM_ACCESS_TOKEN` and `META_APP_SECRET` as Worker Secrets.
- The Facebook token must be a Page access token with `pages_manage_posts` and `pages_read_engagement`. The Instagram token must have `instagram_basic`, `instagram_content_publish`, `pages_show_list` and `pages_read_engagement`; the Page token must also have the scopes needed to read the linked Instagram account. The Worker checks token type, app ID, expiry and scopes before reserving an outbox attempt.
- The Instagram professional account ID `17841402949410977` must be linked to the CEO Facebook Page ID `115226621594988`. If it is not linked, stop. Do not silently substitute another account or change the identity.
- The Worker validates token app ID, scopes and expiry (at least 24 hours remaining) before reserving an outbox attempt. It also uses HMAC-SHA256 `appsecret_proof` with the App Secret on Graph API calls.

Native publishing:
- `POST /api/social/publish` publishes one approved day to one pinned destination.
- Facebook uses the official Page Photos edge with the public generated JPEG URL and caption, then reads the returned Page post back.
- Instagram creates a media container, waits for `FINISHED`, publishes it, then reads the resulting media back.
- The Worker verifies post/media ID, pinned destination identity, permalink and published state before marking the outbox `succeeded`.
- A caller cannot self-attest success. A receipt or HTTP 200 alone is not proof of a public post.
- Any ambiguous result remains blocked for reconciliation. Never blindly retry a request that may already have published remotely.

## 4. Meta credentials and permissions

Follow [META-SETUP.md](./META-SETUP.md) for the exact app, token and secret setup steps. Do not send any credential values through chat.

Store independently authorized tokens only as Worker Secrets:
- `META_FACEBOOK_PAGE_ACCESS_TOKEN`
- `META_INSTAGRAM_ACCESS_TOKEN`
- `META_APP_SECRET`

Facebook Page publishing requires an authorized Page access token and Page task permissions, including `pages_manage_posts` and `pages_read_engagement`. Instagram publishing uses the official Instagram Graph API flow for the professional account and requires `instagram_basic` and `instagram_content_publish` plus the appropriate Page/account access and Meta app configuration. The app must be authorized for the actual Page and professional Instagram account; complete any Meta app review or role requirements that apply.

Official documentation:
- https://developers.facebook.com/docs/graph-api/reference/page/feed/
- https://developers.facebook.com/docs/graph-api/reference/photo/
- https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/

Every Graph API call sends the access token only to Meta over TLS and includes a server-generated HMAC-SHA256 `appsecret_proof` derived from `META_APP_SECRET`. Enable Meta's Require App Secret setting for the app. Never place tokens or the App Secret in Git, KV, D1, Make, request bodies to this Worker, browser storage, logs, receipts, screenshots or chat. Never reuse a Production token in Preview. Do not assume the existing Make connection proves that a separate Worker token is valid.

## 5. Scheduler and backup policy

- Target daily publishing time: 19:30 Africa/Cairo.
- Production publishing Cron candidate: `*/15 * * * *`; the Worker checks the local Cairo clock and only runs at 19:30.
- Backup remains a separate Cron. The currently deployed Production Worker has `0 2 * * *` UTC configured.
- The publishing scheduler runs only when `PUBLISHING_ENABLED=true` and `PREVIEW_MODE` is not true.
- It processes only published feed items with a due, exact-hash approval for the relevant platform.
- Preview must have no Cron Trigger and must never publish, even if a publishing flag is accidentally added.
- Do not add or enable the publishing Cron until a controlled first public post has been separately approved and independently verified on both intended channels.

## 6. Current Cloudflare state (read-only inspection and Preview deployment)

The correct account is now authenticated and can be queried. The production `ceo-notes-ai` Worker currently has:
- AI binding and the production `CEO_NOTES_KV` namespace.
- Existing backup Cron `0 2 * * *` UTC.
- No Durable Object binding in the current live configuration.
- No `ADMIN_TOKEN`, Facebook token or Instagram token listed among its Worker Secrets.

The isolated `ceo-notes-ai-preview` Worker has now received the tested v2 source (deployment version created 2026-11-15):
- Dedicated Preview KV `CEO_NOTES_PREVIEW_2026_11_12`.
- Existing SQLite Durable Object binding `OUTBOX_COORDINATOR` / `CEOOutboxCoordinator` (migration tag `v1` preserved).
- `PREVIEW_MODE=true` and Preview public base URL.
- No AI binding, no Cron Trigger, no Meta credentials and no `ADMIN_TOKEN`.
- New `/admin` dashboard route checks `ctx.access`; all API routes accept Access identity or Bearer auth. The account's Cloudflare Access feature is not enabled yet, so the dashboard remains intentionally inaccessible until the owner enables Access and owner-only path policies are created.

Do not confuse a Cloudflare Pages Preview URL with a deployed Worker runtime. The code has passed CI, but live Worker Preview deployment and runtime HTTP checks are still separate release gates.

## 7. Release gates

- [x] Architecture decision and zero-new-service comparison documented.
- [x] Durable outbox, server-side Meta read-back and caller-attestation rejection staged.
- [x] Explicit owner approval persisted per platform and exact content hash.
- [x] Facebook and Instagram native adapters staged in v2.
- [x] Scheduler checks Africa/Cairo 19:30, requires `PUBLISHING_ENABLED=true`, and is hard-disabled in Preview.
- [x] Unit tests cover Facebook and Instagram API sequences, exact-hash approval, missing credentials, stale content hash, ambiguous outcomes and Preview schedule isolation.
- [x] Deploy the tested source to the isolated Preview Worker only; Cloudflare API confirmed successful upload, `fetch` + `scheduled` handlers, DO class and preserved migration tag.
- [ ] Enable Cloudflare Access in the account; create owner-only policies for Preview `/admin*` and `/api/*` using the Cloudflare-account-member identity rule. Do not use Everyone or broad Gmail-domain access.
- [ ] Verify Preview `/health` returns 200 with KV and Durable Object ready, AI disabled, and no Cron.
- [ ] Verify protected APIs are blocked without Access and work only after owner Access authentication (or a valid Bearer secret for a controlled service client).
- [ ] Test the Access-protected dashboard and authenticated editorial flow with synthetic Preview content only. Do not create a client-side admin token.
- [ ] Configure separately authorized Preview Meta test credentials only if a non-public/test-only Meta destination is available. Never publish a test post publicly as part of unattended testing.
- [ ] Verify Page and Instagram permissions, token expiry, wrong destination, read-back mismatch, container failure and timeout-after-remote-success handling.
- [ ] Complete backup/restore rehearsal and failure injection on Preview.
- [ ] Read back Production Worker bindings, version, secrets and Cron before any deployment.
- [ ] Deploy Production only after all Preview gates pass and explicit deployment approval is recorded.
- [ ] Add the Durable Object binding and migration to Production only with a verified backup and a reviewed migration plan.
- [ ] Add Meta Worker Secrets independently; never migrate credentials from Make.
- [ ] Keep `PUBLISHING_ENABLED` absent/false and publishing Cron absent during initial Production validation.
- [ ] Obtain approval for the exact first public article and its content hash.
- [ ] Publish the first controlled post to Facebook and Instagram independently; read both back and verify the outbox receipts.
- [ ] Obtain separate approval before enabling `*/15 * * * *` and `PUBLISHING_ENABLED=true`.
- [ ] Retire Make publisher scenarios only after the native runtime has passed live acceptance and the owner explicitly authorizes retirement.

## 8. Cost, editorial and rollback controls

- Stay within existing Cloudflare Free allowances. Free quota exhaustion must stop safely; never upgrade automatically.
- No paid plans, R2, paid image generation, paid connectors or recurring services.
- If Workers AI Free quota is unavailable, stop and leave the draft for manual preparation.
- Reuse the same draft and image for the same Cairo publishing day; never create a second copy on retry.
- Preserve the established Egyptian Arabic professional editorial fields: `title`, `article`, `ideaOfTheDay`, `ceoChallenge`, `discussionQuestion`, `hashtags`.
- Do not publish DAY 28 or any other pending item without exact owner approval.
- On any failed gate, keep Make publishers paused, keep publishing Cron absent, preserve feed/outbox/backups, and require authoritative reconciliation before another attempt.

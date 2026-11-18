# CEO Notes Official Launch Runbook

**Status:** STAGED IMPLEMENTATION — CONTROLLED PUBLICATION REQUESTED; PER-TARGET AUTH, CONTENT AND RECEIPT GATES REMAIN OPEN

- Website: https://ceo-notes.pages.dev
- Pages project: `ceo-notes`
- Production Worker: `ceo-notes-ai`
- Isolated Preview Worker: `ceo-notes-ai-preview`
- Legacy Make publisher scenario: `8438190` (must remain paused)

## 1. Project and identity boundaries

CEO Notes remains an independent editorial identity. A destination receiving a distinct adaptation does not become part of CEO Notes. Corporate channels must never receive a verbatim CEO Notes article or personal leadership commentary.

| Sequence | Channel | Pinned identity | ID | Content boundary | PR82 implementation |
|---:|---|---|---|---|---|
| 1 | Facebook | CEO Page | `115226621594988` | CEO Notes editorial copy | Supported |
| 2 | Facebook | Royal Egypt Properties Page | `101823889330644` | Separate property-audience adaptation only; independent approval, content hash, outbox and receipt | Not implemented |
| 3 | Instagram | CEO Notes / @kiritoon | `17841402949410977` | CEO Notes editorial copy | Supported |
| 4 | LinkedIn member | Owner's personal profile | URL recorded in PR #54; not independently verified | CEO Notes-native adaptation only | Not implemented; OAuth and scopes absent |
| 5 | LinkedIn Company Page | Royal Egypt Group Company Page | Public URL and organization URN not verified | Royal Egypt Group corporate copy based only on verified facts; never CEO Notes articles | Not implemented; role and scopes absent |

The two Facebook destinations must remain in this order: CEO Page first, Royal Egypt Properties second. Royal Egypt Properties requires its own audience-specific wording; it is not a blind or verbatim cross-post. Do not add the Royal Egypt Properties Instagram account as a CEO Notes destination. Do not use any additional LinkedIn Page without an exact verified URL/URN and an authorized account.

**Current Make discrepancy:** scenario `8438190` currently contains only the CEO Facebook module; the former Royal Egypt Properties module and combined receipt module are absent. The surviving scenario note says they were disabled, but the exact audience copy, filters and mappings were not preserved in the current blueprint or retrieved run history. Do not recreate that wording or mapping from guesswork. Recover the original module configuration from Make history or an owner-provided export before implementing the REP route.

Keep the CEO Notes personal LinkedIn and Royal Egypt Group Company Page tracks separate. They require independent credentials, content, approvals, outboxes and receipts. Keep existing Make connections intact while publisher scenarios remain paused. Do not copy Make credentials into Cloudflare or delete Make scenarios until the replacement runtime passes acceptance and the owner separately authorizes retirement.

## 2. Proposed zero-new-service runtime (staged; Production runtime decision pending)

- Cloudflare Worker: orchestration and Meta API adapter.
- SQLite-backed Durable Object: per-day locks, approvals and publication outbox.
- Dedicated Cloudflare KV: editorial feed, drafts, images and backups.
- Cloudflare Cron Triggers: backup and the guarded Cairo-time scheduler.
- GitHub Actions: CI and validation only.

The Cloudflare-native implementation in this PR is a staged proposal, not an approved Production runtime switch. The existing Make scenario remains paused. Do not activate Make, enable the native publishing Cron, merge this PR, deploy Production or retire Make until the owner accepts the runtime decision and every authorized target is implemented and independently verified.

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

The isolated `ceo-notes-ai-preview` Worker is deployed with the tested v2 source (version `5842579f-d70c-4ee4-a60a-140843425c3e`, deployment `d3a788c2-d213-499f-a239-5812bcdf0052`, created 2026-11-15):
- Dedicated Preview KV `CEO_NOTES_PREVIEW_2026_11_12`.
- Existing SQLite Durable Object binding `OUTBOX_COORDINATOR` / `CEOOutboxCoordinator` (migration tag `v1` preserved).
- `PREVIEW_MODE=true` and Preview public base URL.
- No AI binding, no Cron Trigger, no Meta credentials and no `ADMIN_TOKEN`.
- New `/admin` dashboard route checks `ctx.access`; all API routes accept Access identity or Bearer auth. The account's Cloudflare Access feature is not enabled yet, so the dashboard remains intentionally inaccessible until the owner enables Access and owner-only path policies are created.

Do not confuse a Cloudflare Pages Preview URL with a deployed Worker runtime. The Worker itself is deployed. GitHub Actions run `43709190369` passed the live HTTP smoke test: `/health` returned 200 with KV and Durable Object ready, AI remained disabled, the unauthenticated publishing API was rejected, and `/admin` remained inaccessible without Access.

## 7. Release gates

- [x] Architecture decision and zero-new-service comparison documented.
- [x] Durable outbox, server-side Meta read-back and caller-attestation rejection staged.
- [x] Explicit owner approval persisted per platform and exact content hash.
- [x] Facebook and Instagram native adapters staged in v2.
- [x] Scheduler checks Africa/Cairo 19:30, requires `PUBLISHING_ENABLED=true`, and is hard-disabled in Preview.
- [x] Unit tests cover Facebook and Instagram API sequences, exact-hash approval, missing credentials, stale content hash, ambiguous outcomes and Preview schedule isolation.
- [x] Deploy the tested source to the isolated Preview Worker only; Cloudflare API confirmed successful upload, `fetch` + `scheduled` handlers, DO class and preserved migration tag.
- [ ] Enable Cloudflare Access in the account; create owner-only policies for Preview `/admin*` and `/api/*` using the Cloudflare-account-member identity rule. Do not use Everyone or broad Gmail-domain access.
- [x] Verify Preview `/health` returns 200 with KV and Durable Object ready, AI disabled, and no Cron.
- [x] Verify unauthenticated publishing API requests and `/admin` are rejected. Owner-authenticated Access flow remains pending until Access is enabled.
- [ ] Verify protected APIs and the dashboard work after owner Cloudflare Access authentication.
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


## 9. Current operations acceptance evidence (2026-11-15)

### Verified
- PR #82 is the current staged Draft against `ceo-notes-site`; it is not merged. PRs #77 and #81 were superseded and closed unmerged.
- Worker CI run [43750692781](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/43750692781) passed. The PR records 46/46 isolated Worker tests and a successful Preview health/auth smoke check.
- Live-site CI run [43750692856](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/43750692856) passed. It checked `/`, `/feed`, `/posts.json`, `/rss.xml`, `/sitemap.xml`, `/robots.txt`, `/markets`, `/post/27`, and existing JPEG media `/image/26` and `/image/27`.
- Production feed currently contains 27 Published posts, DAY 1 through DAY 27, with unique day numbers and no duplicate days.
- Production backup manifest for 2026-11-15 was created at 02:00:12 UTC. Its feed and both image checksums match; the restored feed is structurally identical to the live feed.
- Preview Worker deployment `d3a788c2-d213-499f-a239-5812bcdf0052` has the isolated KV and SQLite Durable Object binding. Preview has no AI binding, no Cron and no secrets.

### Failed or blocked
- Production Worker still has only the legacy AI/KV bindings and backup Cron `0 2 * * *`; it has no Durable Object binding, `ADMIN_TOKEN` or Meta credentials.
- Preview has no Cloudflare Access applications or owner identity policy. Access API inventory requests currently return 403. Preview has no `ADMIN_TOKEN`, Meta secrets or AI binding, so authenticated generation, image and Meta preflight were not run.
- Make scenario `8438190` remains paused on its daily 19:30 schedule. Its HTTP modules use an authorized API-key connection, but the Worker secret list is empty. Module 2 still performs image generation with GET and eight query parameters; modules 1 and 4 still use legacy endpoints rather than the v2 `/api/*` contract. No protected route was called.
- The current Make blueprint has no Royal Egypt Properties publisher or independent receipt route. The exact old module-5 audience wording and mapper were not preserved. PR82 supports only the CEO Facebook Page and CEO Notes Instagram account.
- No LinkedIn publishing integration exists. PR #54 remains a draft plan. The personal profile URL is not independently verified; the Company Page URL/organization URN and approved Page role are missing.
- Production outbox/receipt state is not deployed. The production backup is manifest v1 and contains the feed and two images only; it does not contain image metadata, drafts or outbox records. Backup restore has passed isolated unit tests, but a live Preview restore rehearsal has not been run.
- No new editorial item, image or social post was created during this run. No platform-specific post ID, permalink or durable publication receipt exists.

See [CEO Notes target acceptance matrix](../../docs/CEO_NOTES_TARGET_ACCEPTANCE.md) for the per-target gate table.

## 11. Latest isolated Preview deployment

Verified on 2026-11-15 after the latest Worker source commit:

- Source commit: `34d850843e63fef7adf89e6ceb7424820e9d79af`.
- GitHub source blob SHA: `6ccfea3b5903e510736cde50b319fbecda6d3401`.
- Preview Worker version 7: `8b79c509-171d-4ba8-8d5c-ac3f5a0c0e86`.
- Preview deployment: `a4ca76c0-1213-46dc-8c8f-09591d6029a0`, 100% traffic to version 7.
- Existing isolated Preview KV and SQLite Durable Object namespace IDs were preserved. No new namespace or paid resource was created.
- Preview secret list remains empty and Cron schedule list remains empty. No AI binding or Meta credentials were added.
- Production Worker, Production Pages and Make scenario 8438190 were not changed by this Preview deployment.
- The deployed script content contains the latest image/publication timestamp separation fix and no longer uses image-generation time as `publishedAt`.
- Post-deployment live health and unauthenticated API checks are delegated to the GitHub Actions Preview smoke workflow; do not claim them until that run completes successfully.

## 12. Isolated Preview sync — 2026-11-18

The latest reviewed Worker source from PR #82 was uploaded and deployed to the dedicated `ceo-notes-ai-preview` Worker only.

- PR source commit: `196dcb60bd4efdf2c5e95dd24c57921fb36c486b`.
- Worker source blob SHA: `1be6878fa00c6b79a16fdd64d35b46aa36ce95c4` (`worker-v2.js`, 1,150 lines).
- Preview version 8: `11e93334-8b5f-4a5c-8c74-392435cd00aa`.
- Preview deployment: `1c1015e7-87ca-4643-9afa-564becf0e609`, 100% traffic to version 8.
- Cloudflare read-back confirms the existing isolated KV namespace and SQLite Durable Object namespace were preserved. `PREVIEW_MODE=true` and the Preview public base remain set.
- Preview secret inventory is empty. There is no AI binding and no Cron schedule. No Production Worker setting, secret, binding, schedule, KV value or Pages deployment was changed.
- Pre-deployment CI evidence remains Worker Tests run [44171870827](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/44171870827), 49/49 passing, and Site Checks run [44171870851](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/44171870851), successful.
- The runbook update triggers a fresh Worker and site workflow pass against this Preview version. Do not mark post-deployment health/auth acceptance verified until those workflow jobs complete successfully.
- An authenticated live Preview restore or Meta preflight was not run: Preview still has no Cloudflare Access policy or `ADMIN_TOKEN`/Meta secrets. Unit tests are not a substitute for that live acceptance.

This deployment is staging-only. PR #82 remains Draft, Make remains the Production runtime and stays paused, and no social post or new article was published.

# CEO Notes Official Launch Runbook

**Status:** PREPARATION ONLY — NOT AUTHORIZED FOR PUBLICATION

Target site: https://ceo-notes.pages.dev  
Pages project: `ceo-notes`  
Repository branch: `ceo-notes-site`  
Worker: `ceo-notes-ai`  
Legacy Make publisher scenario: `8438190` (must remain paused; do not use as the native runtime)

## 1. Project and identity boundary

CEO Notes is an independent editorial identity. It is not Royal Egypt Group corporate publishing and must never publish to Royal Egypt Properties destinations.

| Channel | Authorized identity | Target |
|---|---|---|
| Facebook | CEO Page | Page ID `115226621594988` |
| Instagram | CEO Notes / @kiritoon | Professional account ID `17841402949410977` |

Explicit exclusions:
- Royal Egypt Properties Facebook Page and Instagram account are separate corporate identities and are never CEO Notes destinations.
- Royal Egypt Group LinkedIn Company Page must never receive CEO Notes articles.
- LinkedIn personal-profile publishing is a separate, not-yet-authorized integration track.
- Do not add BulkPublish, Tareno, scraping connectors, unofficial LinkedIn tools, or another social scheduler.

Keep existing Make connections intact while its publisher scenarios remain paused. Do not delete credentials or connections as a cleanup shortcut. Do not copy their secrets into Cloudflare or source code; authorize the native Meta integration independently.

## 2. Selected automation runtime

Use Cloudflare-native automation:
- Cloudflare Worker for the API and orchestration.
- SQLite-backed Durable Object `OUTBOX_COORDINATOR` for serialized state, per-day reservations and receipts.
- Dedicated preview KV for all preview-only feed and draft data.
- Cloudflare Cron Triggers for scheduled work only after the explicit release gates pass.
- GitHub Actions for CI only.

Activepieces and n8n are not part of this deployment. Their self-hosted editions require a continuously available host and maintenance; the standard Activepieces production-oriented Docker Compose deployment requires PostgreSQL, Redis, Docker Compose v2 and at least 2 vCPU / 4 GB RAM. A free license does not make hosting and uptime free. GitHub Actions is not the social-publishing runtime.

No new paid services, cards, Workers Paid plan, R2, paid image APIs, paid connectors or recurring charges are allowed.

## 3. Worker API and outbox contract

Current staged API:
- `POST /api/generate`
- `POST /api/image`
- `POST /api/publish` (canonical feed save, not a social-network post)
- `POST /api/outbox/reserve`
- `POST /api/outbox/start`
- `POST /api/outbox/receipt`
- `POST /api/outbox/verify`
- `POST /api/outbox/unknown`
- `POST /api/outbox/reconcile`
- `POST /api/backup/restore` (Preview-only, explicit confirmation)

All state-changing routes require Bearer authorization and POST JSON. Never use legacy path-token routes or GET requests for mutations. Never log authorization headers or secret values.

Outbox states are durable and per destination. A receipt is not success. A successful HTTP create response is not proof of publication. The staged Worker now performs its own Meta Graph API read-back on `/api/outbox/verify`; caller-supplied verification assertions are ignored. It checks the returned ID, pinned destination identity, permalink and published state before marking a receipt successful.

Unknown results after a publish attempt remain blocked. A caller cannot clear an unknown attempt by claiming `not_found`; if authoritative absence cannot be established safely, stop for manual review. Never blindly retry a request that may already have published remotely.

## 4. Native Meta integration target (not yet complete)

The following is the implementation contract, not a claim that social publishing is already wired into the Worker.

### Credentials

Store independently authorized tokens only as Cloudflare Worker Secrets:
- `META_FACEBOOK_PAGE_ACCESS_TOKEN`
- `META_INSTAGRAM_ACCESS_TOKEN`

Never store tokens in Git, KV, D1, request bodies, client-side code, Make, logs, receipts, screenshots or chat. Never reuse a production token in Preview. The current Preview must remain without Meta secrets.

### Facebook CEO Page

The native adapter must:
1. Require an owner approval record for the exact content hash.
2. Reserve `facebook / ceo-page` for the day and content hash.
3. Start the reservation before the remote side effect.
4. Publish through the official Meta Graph API to Page `115226621594988`.
5. Record the returned post ID as a receipt.
6. Let the Worker read back the post using the Page Post fields `id,from{id},permalink_url,is_published`.
7. Verify the returned Page ID, post ID, permalink and published state before marking `succeeded`.

### Instagram CEO Notes

The native adapter must:
1. Require the same owner approval gate and reserve `instagram / ceo-notes` independently.
2. Create a media container through the official Instagram Content Publishing API using the public JPEG URL and approved caption.
3. Check container readiness before publishing; do not tight-loop poll.
4. Publish the container and record the returned media ID.
5. Let the Worker read back the media using `id,owner,permalink,timestamp`.
6. Verify owner ID `17841402949410977`, media ID, permalink and published timestamp before marking `succeeded`.

Facebook and Instagram routes must succeed or fail independently. A success on one channel must never be retried because the other channel failed.

## 5. Approval and schedule policy

- Draft generation and image creation are not public publication.
- Only an explicit, auditable owner approval bound to the exact content hash may make a draft eligible.
- A caller-supplied `approved: true` value is not sufficient.
- Preview must have no publishing Cron, no Meta secrets and no AI binding.
- The current staged `scheduled()` handler performs backup only; it is not yet a daily social publisher.
- The target publishing time is 19:30 Africa/Cairo, but do not add or activate a publishing Cron until the controlled first post is separately approved and all release gates pass.
- Do not publish DAY 28 or any other pending article without the owner's explicit approval.

## 6. Required release gates

- [ ] Preview-only `ADMIN_TOKEN` configured securely; never reuse production credentials.
- [ ] Preview `/health` returns 200 and confirms KV + Durable Object readiness.
- [ ] Preview protected API returns 401 without auth and accepts only the authorized Bearer credential.
- [ ] POST-only generation/image/feed contract tested with synthetic Preview data only.
- [ ] Concurrent reservations, duplicate suppression, partial channel failure and ambiguous-outcome handling pass.
- [ ] Worker-side Meta read-back tests pass for both Facebook and Instagram, including wrong destination, wrong post ID, wrong permalink, unpublished state, missing token and expired-token responses.
- [ ] Native Meta publishing adapters are implemented; no Make publishing module remains in the execution path.
- [ ] Owner approval is persisted and cryptographically/content-hash bound; unapproved content cannot be published.
- [ ] Backup capture and isolated restore rehearsal pass, including Durable Object outbox records and failure-injection cases.
- [ ] Production Worker source, AI/KV/DO bindings and secret names are read back before any deployment.
- [ ] Cloudflare identity and least-privilege API authorization are verified. The previous API connection returned HTTP 401; do not deploy until the correct account is reconnected.
- [ ] Preview and Production identities, KV namespaces, Durable Object namespaces and secrets are independently verified.
- [ ] Canonical Pages project, article, feed, RSS, sitemap, canonical URLs and social metadata are verified.
- [ ] One controlled public post is explicitly approved by the owner and independently read back on each destination.
- [ ] Only after that controlled post passes may a separate approval be requested to enable the 19:30 Africa/Cairo daily schedule.
- [ ] Keep Make publisher scenarios paused until native acceptance is complete and the owner separately authorizes retirement.

## 7. Cost and editorial controls

- Free-first. Check Cloudflare Workers, Durable Objects and Workers AI usage before any call.
- Free-plan overages must fail safely; never auto-upgrade or incur a charge.
- Do not enable paid plans, R2, paid image services, paid connectors or recurring charges.
- Do not generate a new article or image when retrying the same Cairo publishing day; reuse the stored draft and media.
- If Workers AI Free quota is unavailable, stop and leave the draft for manual preparation. Do not substitute a paid model/provider.
- Preserve the established Egyptian Arabic professional editorial voice and fields: `title`, `article`, `ideaOfTheDay`, `ceoChallenge`, `discussionQuestion`, `hashtags`.
- Do not rewrite historical posts or publish DAY 28 until the release gates and explicit owner approval are complete.

## 8. Rollback

If any gate fails:
- Keep all Make publisher scenarios paused.
- Keep publishing Cron absent or disabled.
- Preserve the feed, drafts, outbox, receipts and backups.
- Disable only the failing native route.
- Reconcile uncertain remote outcomes before another attempt.
- Do not delete public posts, credentials, feed entries or backups as a cleanup shortcut.

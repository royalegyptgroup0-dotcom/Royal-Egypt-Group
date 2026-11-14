# CEO Notes Official Launch Runbook

Status: PREPARATION ONLY — NOT AUTHORIZED FOR PUBLICATION

Target site: https://ceo-notes.pages.dev  
Pages project: `ceo-notes`  
Repository branch: `ceo-notes-site`  
Worker: `ceo-notes-ai`  
Make scenario: `8438190` (daily 19:30 Africa/Cairo; must remain paused until all gates pass)

## 1. Identity allowlist

CEO Notes is an independent editorial identity.

| Channel | Authorized identity | Target |
|---|---|---|
| Facebook | CEO Page | Page ID `115226621594988` |
| Instagram | CEO Notes / @kiritoon | Business account ID `17841402949410977` |

Explicit exclusions:
- Royal Egypt Properties Facebook Page and Instagram account are separate corporate identities and are not CEO Notes destinations.
- Royal Egypt Group LinkedIn Company Page must never receive CEO Notes articles.
- LinkedIn personal-profile publishing is a separate, not-yet-authorized integration track. It is not part of the initial launch gate.
- Do not add BulkPublish, Tareno, scraping connectors, unofficial LinkedIn tools, or another social scheduler to this workflow.

Keep the existing authorized Facebook and Instagram connections. Do not delete credentials or connections as a substitute for removing unused modules.

## 2. Minimal Make application allowlist

Retain only the applications needed for the approved first launch:
- HTTP: authenticated calls to the CEO Notes Worker API.
- Facebook Pages: publish and authoritative post read-back for the CEO Page.
- Instagram for Business (Facebook login): publish and authoritative media read-back for @kiritoon.

The old Royal Egypt Properties Facebook module and combined two-Page receipt module were removed from scenario 8438190 on 2026-11-14. The scenario now contains only the existing HTTP generation/image/feed modules and the CEO Facebook publication module. It remains paused.

## 3. Worker API contract

All state-changing calls are POST JSON with the same Bearer authorization connection:
- `POST /api/generate`
- `POST /api/image` with the saved Cairo date and exact generated draft/image prompt
- `POST /api/publish` with the same draft; this saves the canonical feed entry and returns its content hash
- `POST /api/outbox/reserve`
- `POST /api/outbox/start`
- `POST /api/outbox/receipt`
- `POST /api/outbox/verify`
- `POST /api/outbox/unknown` and `POST /api/outbox/reconcile` for ambiguous outcomes

Never use legacy path-token routes or GET requests for mutations. Do not log authorization headers or secret values.

## 4. Independent publication routes

After one canonical feed save, use a Make Router with independent channel routes. Each route uses the same day and content hash but its own platform + identity reservation.

### Facebook CEO Page
1. Reserve `facebook / ceo-page`.
2. Start the reservation.
3. Publish the post with image to Page `115226621594988`.
4. Read back the returned post ID using Facebook Pages `GetPost`.
5. Confirm the returned post is published and has a permalink for the intended Page.
6. Submit the receipt, then submit the authoritative Graph API read-back attestation to `verify`.

### Instagram CEO Notes
1. Reserve `instagram / ceo-notes`.
2. Start the reservation.
3. Publish a photo post to account `17841402949410977` using the public JPEG URL and an Instagram-appropriate caption.
4. Read back the returned media ID using Instagram for Business `GetMedia`.
5. Confirm the media owner is `17841402949410977`, and capture its permalink and timestamp.
6. Submit the receipt, then submit the authoritative Instagram Graph API read-back attestation to `verify`.

A successful create response is not publication proof. A receipt remains `receipt_recorded` until the platform-specific read-back verifies the same ID, destination and permalink. Each channel may succeed or fail independently. A successful channel is never retried.

On timeout or uncertain result, mark the attempt unknown and reconcile against the platform before any retry. Never blindly repeat a publish action.

## 5. Required release gates

- [ ] Preview-only `ADMIN_TOKEN` configured securely; never reuse production credentials.
- [ ] Preview `/health` returns 200 and confirms KV + Durable Object readiness.
- [ ] Preview protected API returns 401 without auth and accepts only the authorized Bearer credential.
- [ ] POST-only generation/image/feed API contract tested without production writes.
- [ ] Outbox concurrency, duplicate, partial-failure and ambiguous-outcome tests pass.
- [ ] Backup capture and isolated restore rehearsal pass, including Durable Object outbox records.
- [ ] Production Worker source, AI/KV/DO bindings and secret names read back before deployment.
- [ ] Production Worker deployment and authenticated endpoint checks pass.
- [ ] Make modules 1, 2 and 4 migrated to the v2 POST JSON contract; no legacy route tokens.
- [ ] Independent Facebook and Instagram routes, read-back verification, receipts and error handlers tested in paused mode.
- [ ] Canonical Pages project deployed from `ceo-notes-site`; live article, feed, RSS, sitemap, canonical and social metadata verified.
- [ ] One controlled public post explicitly approved by the owner; verify both target identities and durable receipts before enabling the daily schedule.
- [ ] Verify the next scheduled execution is 19:30 Africa/Cairo after activation.

## 6. Cost and content controls

- Free-first. Check current Workers AI and Make usage before calls.
- Do not enable paid plans, R2, paid image services, paid connectors or recurring charges.
- Do not generate a new article or image when retrying the same Cairo publishing day; reuse the stored draft and media.
- Preserve Egyptian Arabic professional editorial voice and the fields title, article, ideaOfTheDay, ceoChallenge, discussionQuestion and hashtags.
- Do not rewrite historical posts or publish DAY 28 until the release gates and explicit controlled-publication approval are complete.

## 7. Rollback

If a gate fails, keep scenario 8438190 paused, preserve existing feed and receipts, disable only the failing route, and reconcile any uncertain platform result. Do not delete production posts, credentials, feed entries or backups to make a test pass.

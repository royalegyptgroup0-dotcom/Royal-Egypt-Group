# CEO Notes — Product Roadmap

Canonical site: https://ceo-notes.pages.dev
Scope: CEO Notes only. Keep this code and its publishing data separate from Royal Egypt Group production.

## Operating rules
- Free-first: prefer open standards, browser-native features, and services with no required subscription.
- The blog is the source of truth: publish to the website first, then CEO Notes Facebook, then Royal Egypt Properties.
- Never activate, run, reschedule, or change a production publisher scenario without separate explicit authorization.
- Never publish to Facebook, rewrite the archive, or change production data as part of a code-only feature.
- Keep preview validation separate from production deployment.
- Third-party radio streams play directly from broadcasters; CEO Notes does not host, record, proxy, or rebroadcast audio.

## Verified baseline — 2026-11-08
- Independent Cloudflare Pages project: ceo-notes.pages.dev; production branch label: ceo-notes-site.
- Existing site includes article feed, per-post routes, search, sharing, RSS, sitemap/robots, currency/gold reference data, world clocks, and a Cloudflare Worker API.
- The isolated ceo-notes-site branch contains DAY25, DAY26, and DAY27 marked Published. Do not use the Royal Egypt Group main-branch archive as the CEO Notes source of truth.
- Primary Make publisher scenario `8438190`: repeated read-only check on 2026-11-08 returned `status=paused`, `isActive=true`, configured daily time 19:30 Cairo, and a listed next execution of 17:30 UTC (already passed). No Nov 8 run was found. Last run: 2026-11-07 21:41:52 UTC, success, four operations; execution inspection shows modules 1–4 ran, including the CEO Facebook module, while the Royal Egypt Properties and final receipt modules did not run. Module input/output drill-down returned no stored records, so the resulting Facebook post ID and final receipt cannot be independently confirmed from Make. Legacy scenario `8419318` remains paused and inactive (`isActive=false`). No scenario state or schedule was changed.
- Radio production deployment: Cloudflare Pages deployment `b8636969`, commit `1460d24a3167341ffd429aadd1d65f9e19772fee`.
- Editorial production deployment: Cloudflare Pages deployment `15621b34`, commit `8993671de94319e26fd56bfe8e54c5286c71fb62`.
- Market freshness production deployment: Cloudflare Pages deployment `5cb38832`, commit `f538a59d0777584e3135077aca79482de43da474`.

## Milestones

### P0 — Content integrity and publishing safety <in progress 2026-11-08>
- [x] Reconcile the live website feed (Days 25–27) against the CEO Facebook Page history (32 posts; explicit day labels cover Days 1–8, 10–17, and 19–27, with Day 6 repeated and several unnumbered items).
- [x] Confirm the latest published website articles (Days 25–27) match the corresponding CEO Facebook posts.
- [x] Audit Royal Egypt Properties history (26 posts); no CEO Notes-series post was present at audit time.
- [x] Identify the separate inactive 30-draft bank (Days 25–54). Its Day 26 and Day 27 titles differ from the published versions; it remains untouched and is not treated as canonical.
- [x] Verify the current publisher flow is website feed first, CEO Facebook second, Royal Egypt Properties third.
- [x] Add a gate that blocks social publishing when the canonical feed reports that the day already exists.
- [x] Add a receipt handler to the Cloudflare publisher Worker to persist both Facebook post IDs and timestamps in the canonical feed.
- [x] Add a final Make module to record the receipt only after both Facebook posts succeed.
- [x] Preserve the configured daily time (19:30 Cairo) without changing the schedule.
- [x] Read-only audit of Make state and recent executions completed on 2026-11-08.
- [ ] Resolve why scenario 8438190 reports paused despite `isActive=true`; confirm whether it should resume before changing any state.
- [ ] Verify a complete successful run across both Facebook destinations and the final receipt handler; the latest four-operation run does not establish this.
- [ ] Verify the first real receipt after an explicitly approved complete run.
- [x] Read the deployed Cloudflare publisher Worker and the current Make module mappings without changing production state.
- [x] Confirm the current feed contains Published Days 25–27 and the public KV inventory contains only the expected feed, backup records, and image keys for Days 26–27.
- [ ] Repair the partial-publish failure mode: the current Worker receipt endpoint requires both Facebook IDs in one request, while Make records the receipt only after both Facebook actions. If the first page succeeds and the second fails, the first post can remain unreceipted and the existing-day gate can block a normal retry.
- [ ] Add independently idempotent receipts and recovery for each destination (CEO Notes first, Royal Egypt Properties second); test success/failure permutations in an isolated environment before changing production.
- [ ] Do not treat the previous four-operation success as proof of a complete two-page publish: inspection shows only modules 1–4 ran; modules 5 and 6 did not run in that execution.
- [ ] Resolve the unnumbered historical posts: the 14 July post between Days 8 and 10 may be Day 9, but it is not explicitly labelled; Day 18 and Day 24 remain unconfirmed. The repeated Day 6 must be reviewed before any historical import.
- [ ] Decide whether Days 1–24 should be imported into the website; keep them as Facebook-only history for now, because the website's current series starts at Day 25 and several older entries are unnumbered or ambiguous.

### P1 — Free Radio module <completed 2026-11-08>
- [x] Add a responsive radio directory/player to the blog and serve it through the Pages Worker.
- [x] Use Radio Browser's public-domain station metadata API; play only HTTPS streams directly in the visitor's browser.
- [x] No autoplay, account, cookies, audio hosting, proxying, or recording.
- [x] Show source attribution and explain that stations control availability, rights, and broadcast content.
- [x] Exclude HLS-only streams that are not reliably supported by native browser audio.
- [x] Verify API availability, permissive CORS response, and a sample HTTPS audio stream from a Cloudflare Preview probe.
- [x] Deploy the feature to production.
- [ ] Complete interactive browser playback and real mobile/desktop visual checks when browser-test capacity is available.

### P2 — Editorial experience <completed 2026-11-08>
- [x] Add archive category filters and topic-tag filters alongside full-text search.
- [x] Add editorial category and tag metadata to published posts without changing article text or status.
- [x] Enrich live and cached feeds with local editorial metadata when the upstream feed omits it.
- [x] Include categories and tags in RSS items.
- [x] Add per-article Open Graph and Twitter metadata, including section and image.
- [x] Preserve existing article URLs, feed output, sitemap, and RSS compatibility.
- [x] Add a Worker source-sync script and CI checks for Worker syntax and source consistency.
- [ ] Complete interactive browser, keyboard, and mobile visual checks when browser-test capacity is available.

### P3 — Multilingual publishing <in progress 2026-11-08>
- Arabic remains the public source language; English and Russian are being prepared as reviewed variants.
- [x] Create a separate private Cloudflare KV draft store that is not bound to the public site Worker.
- [x] Prepare English and Russian translation drafts for Days 25–27 with explicit Draft status, reviewRequired=true, and publiclyVisible=false.
- [ ] Editorially review the translations for meaning, tone, and terminology before approval.
- [ ] Add language switching, localized article routes, and language-specific SEO/RSS only after translation approval.
- Never expose draft translations through the public feed or publish them automatically.

### P4 — Markets and useful live information <completed 2026-11-08>
- [x] Keep Frankfurter as the explicit source for daily reference FX and XAU rates.
- [x] Include source date and fetchedAt timestamp in the market response.
- [x] Treat data as fresh for six hours; retain a bounded stale fallback for up to 72 hours.
- [x] Return stale=true, a warning header, and a visibly different UI state when serving cached fallback.
- [x] Return an explicit 503/no-store state when neither fresh nor bounded stale data is available.
- [x] Add CI tests for fresh provider success, stale fallback after simulated provider outage, and no-cache provider failure.
- [x] Verify live API response in CEO Notes Preview and the canonical production domain.
- Never present reference FX or calculated gold values as executable bank/dealer quotes.

### P5 — Independent publishing automation <design documented 2026-11-08>
- [x] Document the Cloudflare-native target flow, local-time scheduling, idempotency, bounded retries, dead-letter handling, receipts, and cutover gates in `notes/PUBLISHER-MIGRATION.md`.
- [ ] Build an isolated Cloudflare-native prototype and test partial failures without publishing to production pages.
- [ ] Verify secure Facebook authorization and required permissions through an approved connection.
- [ ] Require human approval before external social publishing.
- Do not change or resume the current Make publisher until its paused/active state is explained and the partial-publish recovery path is repaired and tested; the observed scenario 8438190 state is paused with isActive=true.

### P6 — Secure editorial dashboard <design documented 2026-11-08>
- [x] Document the private editor, translation review, approval states, server-side authorization, receipts, and audit requirements in `notes/EDITORIAL-DASHBOARD.md`.
- [ ] Verify a supported Cloudflare Access hostname and identity policy; do not expose the editor on the public Pages hostname without verified protection.
- [ ] Implement the private API and editor after the access boundary is proven.
- No direct publishing action without visible confirmation and an audit receipt.

### P7 — Reliability and continuity <in progress 2026-11-08>
- [x] Add daily Cloudflare KV snapshots for the canonical feed and every stored image.
- [x] Schedule backups daily at 02:00 UTC (04:00 Cairo), with 30-day retention.
- [x] Create a baseline snapshot for 2026-11-08 covering Days 25–27 and the two stored image assets.
- [x] Read back the backup feed, manifest, and image assets; SHA-256 checks match the live source values.
- [x] Confirm the publisher Worker health endpoint and live feed remain available after the backup deployment.
- [x] Document backup verification, isolated restore, and production rollback steps in `notes/OPERATIONS.md`.
- [ ] Verify the first scheduled backup run and exercise a restore in an isolated namespace before any live restore.
- [ ] Add automated feed, sitemap, RSS, and article-route health checks.
- [ ] Add duplicate-content, broken-image, and broken-link checks.
- [ ] Maintain deployment previews and rollback notes for every release.

## Release checklist — radio release 2026-11-08
- [x] Verify the radio feature on a non-production Cloudflare Preview deployment.
- [ ] Complete interactive mobile and desktop visual checks.
- [ ] Complete keyboard accessibility and screen-reader checks in a browser.
- [x] Confirm no autoplay and no third-party audio proxy.
- [x] Confirm article feed and /post/{day} routes still work.
- [x] Confirm RSS, sitemap, and robots output remain intact.
- [x] Obtain explicit user authorization before production deployment.
- [x] Deploy production Worker and verify the live domain serves radio assets.
- [ ] Re-test interactive audio playback when TinyFish browser wallet is funded.

## Market data release checklist — 2026-11-08
- [x] Verify USD and XAU reference endpoints.
- [x] Verify fresh response includes source date, fetchedAt, and stale=false.
- [x] Test stale fallback and no-data failure in CI with simulated provider outages.
- [x] Verify CEO Notes Preview before release.
- [x] Deploy only to the independent ceo-notes Pages project and verify the canonical domain.
- [ ] Complete visual browser check of the stale warning state when browser-test capacity is available.

## Editorial release checklist — 2026-11-08
- [x] Category and tag metadata present on the published archive.
- [x] Live feed returns normalized categories and tags.
- [x] RSS emits editorial categories and topic tags.
- [x] Article detail pages expose article section, publication time, and social images.
- [x] Worker bundle synchronization and syntax checks pass.
- [x] Cloudflare Preview validated before production.
- [x] Production deployment verified on the canonical domain.
- [ ] Interactive filter behavior, keyboard navigation, and responsive layout verified in a real browser.

## Current focus
P0/P3/P6/P7 — verify the first publishing receipt and scheduled backup, review the private English/Russian drafts, establish a supported Access hostname, and complete historical archive reconciliation without importing unverified content.

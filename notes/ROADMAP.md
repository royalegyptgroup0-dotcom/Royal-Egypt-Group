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
- Current Make publisher scenario `8438190` remains active on its existing daily schedule. The user explicitly authorized the P0 safety-filter and receipt additions in this work session; do not manually run it or change its schedule.
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
- [x] Preserve the active daily schedule (19:30 Cairo); no manual publishing run was performed.
- [ ] Verify the first real receipt after the next scheduled run.
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

### P5 — Independent publishing automation
- Design a Cloudflare-native workflow to replace Make only after parity tests.
- Use bounded scheduled jobs, idempotency keys, retries, and an audit trail.
- Require human approval before external social publishing.
- Keep the current Make publisher active on its existing schedule until the Cloudflare-native replacement passes parity tests and a separate cutover is approved.

### P6 — Secure editorial dashboard
- Private authenticated editor for drafts, review, scheduling proposals, and archive corrections.
- Server-side authorization only; no secrets in frontend code.
- No direct publishing action without visible confirmation and an audit receipt.

### P7 — Reliability and continuity <in progress 2026-11-08>
- [x] Add daily Cloudflare KV snapshots for the canonical feed and every stored image.
- [x] Schedule backups daily at 02:00 UTC (04:00 Cairo), with 30-day retention.
- [x] Create a baseline snapshot for 2026-11-08 covering Days 25–27 and the two stored image assets.
- [x] Read back the backup feed, manifest, and image assets; SHA-256 checks match the live source values.
- [x] Confirm the publisher Worker health endpoint and live feed remain available after the backup deployment.
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
P0/P3/P7 — verify the first publishing receipt and scheduled backup, review the private English/Russian drafts, and complete historical archive reconciliation without importing unverified content.

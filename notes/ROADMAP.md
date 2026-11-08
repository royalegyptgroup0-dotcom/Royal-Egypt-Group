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
- The existing Make publisher is protected; no run or activation is authorized by this roadmap.
- Radio production deployment: Cloudflare Pages deployment `b8636969`, commit `1460d24a3167341ffd429aadd1d65f9e19772fee`.
- Editorial production deployment: Cloudflare Pages deployment `15621b34`, commit `8993671de94319e26fd56bfe8e54c5286c71fb62`.

## Milestones

### P0 — Content integrity and publishing safety
- Reconcile the blog feed against existing Facebook history without duplicate posts.
- Verify publisher mappings and failure handling with isolated test data only.
- Add duplicate prevention and publication receipts before considering migration.
- Keep the current publisher untouched until an alternative passes end-to-end parity tests.

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

### P3 — Multilingual publishing
- Arabic first, then English and Russian.
- Keep one canonical article record with language variants and explicit publication status.
- Require editorial review before translated content is published.

### P4 — Markets and useful live information
- Keep data sources explicit, timestamped, and clearly marked as reference data.
- Add graceful stale-data and provider-failure states.
- Never present reference FX or calculated gold values as executable bank/dealer quotes.

### P5 — Independent publishing automation
- Design a Cloudflare-native workflow to replace Make only after parity tests.
- Use bounded scheduled jobs, idempotency keys, retries, and an audit trail.
- Require human approval before external social publishing.
- Keep the old scenario inactive until the replacement is proven and separately approved.

### P6 — Secure editorial dashboard
- Private authenticated editor for drafts, review, scheduling proposals, and archive corrections.
- Server-side authorization only; no secrets in frontend code.
- No direct publishing action without visible confirmation and an audit receipt.

### P7 — Reliability and continuity
- Automated backups and restore tests.
- Feed, sitemap, RSS, and route health checks.
- Duplicate-content, broken-image, and broken-link checks.
- Deployment previews and rollback notes for every release.

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
P0 — content integrity and publishing safety, beginning with a read-only reconciliation of the canonical feed and public publishing history.

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

## Milestones

### P0 — Content integrity and publishing safety
- Reconcile the blog feed against existing Facebook history without duplicate posts.
- Verify publisher mappings and failure handling with isolated test data only.
- Add duplicate prevention and publication receipts before considering migration.
- Keep the current publisher untouched until an alternative passes end-to-end parity tests.

### P1 — Free Radio module
- Add a responsive radio directory/player to the blog.
- Use Radio Browser's public-domain station metadata API; play only HTTPS streams directly in the visitor's browser.
- No autoplay, account, cookies, audio hosting, proxying, or recording.
- Show source attribution and explain that stations control availability, rights, and broadcast content.
- Treat HTTP-only streams as unsupported on the HTTPS blog.

### P2 — Editorial experience
- Improve archive navigation, categories, tags, and article search.
- Add stable article metadata and social-preview checks.
- Preserve existing article URLs and RSS compatibility.

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

## Release checklist
- [ ] Verify the radio feature on a non-production preview.
- [ ] Test mobile and desktop layouts.
- [ ] Test keyboard accessibility and screen-reader labels.
- [ ] Confirm no autoplay and no third-party audio proxy.
- [ ] Confirm article feed and /post/{day} routes still work.
- [ ] Confirm RSS, sitemap, and robots output remain intact.
- [ ] Obtain separate approval before production deployment or publisher changes.

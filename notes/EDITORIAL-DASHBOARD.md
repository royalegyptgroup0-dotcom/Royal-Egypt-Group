# CEO Notes — Secure Editorial Dashboard

Status: architecture documented; implementation is gated on a verified private-access hostname and end-to-end authorization tests.

## Purpose

Provide a private workspace for the owner to review articles, compare Arabic/English/Russian variants, approve edits, inspect images, and review publishing receipts without exposing drafts or administrative actions to the public site.

## Access model

- Start with one owner account; add editor/reviewer roles only when needed.
- Use Cloudflare Access with an explicit email allowlist and server-side identity verification.
- Verify that the chosen hostname supports the required Access application and path protection before exposing the dashboard.
- The current CEO Notes Pages project uses a `pages.dev` hostname and has no custom domain configured. Do not assume that the public Pages hostname is sufficient for the required Access policy.
- Do not implement a client-side password, shared secret in JavaScript, or hidden URL as the security boundary.

## Dashboard areas

### Editorial queue
- Draft articles with day, title, category, tags, image, source language, and status.
- Search and filter by day, status, and language.
- Display duplicate-day warnings and missing required fields.

### Translation review
- Show Arabic source and English/Russian drafts side by side.
- Highlight missing fields and materially different phrasing.
- Keep each language status independent: Draft, In Review, Approved, Published.
- Never expose Draft or In Review translations through public feed, RSS, sitemap, or article routes.

### Preview and approval
- Preview the article exactly as it will appear on the public site.
- Record the source content hash, reviewer, timestamp, and approved destinations.
- Approval must be an explicit action with a confirmation summary.
- Editing an approved article invalidates the previous approval.

### Publishing and receipts
- Show website, CEO Facebook, and Royal Egypt Properties status separately.
- Display the post ID, timestamp, and result for each destination.
- Allow a retry only for a destination without a confirmed receipt.
- Require a visible confirmation before any external publishing action.

### Archive maintenance
- Show missing days, repeated day numbers, unnumbered historical posts, and source mismatches.
- Require a source link or verified original text before importing historical Facebook content.
- Preserve the existing published article and its history when corrections are made.

## Server-side API outline

- `GET /editor/api/session` — verify Access identity and role.
- `GET /editor/api/drafts` — list private drafts.
- `GET /editor/api/drafts/:day` — retrieve one draft and its translations.
- `PUT /editor/api/drafts/:day` — save edits with optimistic version checking.
- `POST /editor/api/drafts/:day/approve` — record editorial approval.
- `GET /editor/api/receipts/:day` — inspect publication receipts.
- `POST /editor/api/publish/:day` — separate, confirmed publishing action; disabled until parity and authorization gates pass.

Every write endpoint must verify the Access identity on the server, validate the request, record an audit event, and reject stale versions.

## Data separation

- Keep private translation drafts in the separate editorial-drafts KV namespace.
- Keep public feed records in the existing canonical feed namespace.
- Do not bind the private draft namespace to the public Pages Worker.
- Copy only approved translations into the public feed.
- Back up private drafts and approval records separately from public feed snapshots.

## Security and acceptance tests

- [ ] Unauthenticated requests are denied.
- [ ] Authenticated owner can read drafts and receipts.
- [ ] Public routes cannot read private draft keys.
- [ ] Draft translations never appear in public feed, RSS, sitemap, or article metadata.
- [ ] Every edit invalidates prior approval when content changes.
- [ ] Publishing requires a separate confirmation and records a receipt.
- [ ] Replayed requests cannot create duplicate social posts.
- [ ] Audit records include actor, action, timestamp, and content version.
- [ ] Restore test succeeds in an isolated environment.

## Release gate

Do not expose or deploy the dashboard until the Access hostname and identity policy are verified. The dashboard must remain separate from Royal Egypt Group production and must not silently activate or run the publisher.

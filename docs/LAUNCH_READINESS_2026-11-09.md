# Royal Egypt Group — Launch Readiness Audit

**Verified:** 9 November 2026  
**Repository:** https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group  
**Current production commit:** `dede5f00c5dacb25c04735063b7f67d22b146d41`  
**Current Pages hostname:** https://royalegyptgroup-vy7.pages.dev  
**Status:** Controlled pre-launch — not yet a complete commercial launch.

This document supersedes older infrastructure and handoff snapshots where they conflict. It records only verified configuration and test evidence; it does not authorize production data changes, DNS changes, spending, customer contact, or public listing approval.

## 1. Verified deployment and source state

- Cloudflare Pages project: `royalegyptgroup`; production branch: `main`.
- PR #9 is merged. Its production deployment completed successfully.
- The latest main-branch GitHub checks for Functions/Intake and Jekyll CI completed successfully.
- PR #10 was closed as superseded. Its branch was divergent and conflicted; the current main branch contains a more complete assistant implementation and test coverage.
- PR #47 contains a focused language-control synchronization fix. Functions/Intake CI, Jekyll CI, and its Cloudflare Preview deployment all passed. It is ready for review but has **not** been merged.
- A Preview-only retry deployment completed successfully after adding the missing Workers AI binding. Its D1 binding remained the isolated Preview database.

## 2. Cloudflare bindings and data stores

| Environment | D1 binding | Database | Workers AI |
|---|---|---|---|
| Production | `DB` | `royal-eg-listings` | `AI` configured |
| Preview | `DB` | `royal-eg-listings-preview` | `AI` configured |

- Production and Preview use different D1 database IDs. Keep that separation.
- The Preview database has the same required application tables as Production.
- No R2 bucket or property-image storage binding is configured. Do not assume image upload works.
- No D1 migration was run against Production during this audit.

### Production data health snapshot

Only aggregate counts and table schemas were inspected; customer names, phone numbers, emails, notes, and order details were not read.

- `listings`: 2 rejected, 0 approved.
- `customers`: 0 records.
- `opportunities`: 0 records.
- `orders`: 3 pending records.
- `intake_rate_limits`: present.

The public property catalogue therefore has no approved D1 inventory at this snapshot. Do not publish or approve a listing without owner verification and explicit approval.

## 3. Runtime configuration blockers

The owner-authentication and optional notification configuration are not verified as present in the current Pages settings. Treat these capabilities as unavailable until the owner configures and verifies them.

Treat these capabilities as unavailable until the owner configures and verifies them:

1. **Owner authentication:** both `/api/admin/inbox` and `/api/admin/listings` require `ADMIN_TOKEN`. Without it, the APIs intentionally return 401. The owner inbox cannot be considered operational until an encrypted secret is configured in both environments and a safe authenticated test succeeds.
2. **Owner notifications:** `POST /api/intake` persists accepted requests in D1. The optional Make notification is not configured. This means submissions can be stored without an active notification route. Do not begin public lead collection until the owner can reliably review new records or a notification route is configured and tested.
3. Never put secret values in Git, documentation, browser storage, logs, or chat. The owner should set the encrypted value directly in Cloudflare Pages settings.

## 4. What the current site does

- Group homepage and navigation.
- Real-estate catalogue: public reads are restricted to approved listings; submitted property offers remain pending until moderation.
- Developer directory: informational, with official-source and non-endorsement disclaimers.
- Shared AI assistant: Cloudflare Workers AI model `@cf/meta/llama-3.1-8b-instruct-fast`; answers are grounded in approved public listings and must not invent prices, availability, legal status, or guarantees. It uses a D1-backed hashed-IP rate limiter.
- Website intake: customer, opportunity, and listing requests are validated and stored in D1. Consent is required; public submission does not automatically publish a listing.
- Coffee and Transportation: consent-based **interest registration only**. These pages do not offer confirmed bookings, payments, inventory, or service availability.
- Owner inbox: displays customers, opportunities, listings, and read-only orders after Bearer authentication. It uses one shared credential, not named staff accounts or role-based sessions.

## 5. Known launch limitations

### P0 — must be resolved before collecting live leads

1. Configure and verify the encrypted `ADMIN_TOKEN` in Production and Preview. Do not share the value in chat.
2. Configure and test an owner notification/review path. Until then, D1 persistence alone is not sufficient operational handling for live leads.
3. Add the DNS records required for `royalegyptgroup.com` and `www.royalegyptgroup.com` at the domain's DNS provider. Both custom domains currently report pending verification because the CNAME records are not set. Keep the Pages hostname as fallback.
4. Confirm real property inventory and approve only verified listings. The current Production D1 catalogue has no approved rows.
5. Complete browser-level end-to-end testing of the live Preview flows after authentication and notification settings are configured.

### P1 — scope decisions for a low-cost MVP

1. **Images:** no R2 or image upload pipeline is active. A text-only MVP may direct photo exchange to the owner-approved WhatsApp channel; do not advertise website image uploads.
2. **Staff access:** the shared Bearer credential is a limited owner-only arrangement, not a multi-user staff system. Named accounts, roles, session expiry, and staff audit trails remain future hardening.
3. **Notifications:** add a durable outbox/retry path if notification delivery becomes operationally important.
4. **Operations:** document retention, privacy requests, manual review, and follow-up responsibilities.
5. **Quality:** complete Arabic/English/Russian visual QA on desktop and mobile, including accessibility and performance checks.

### P2 — after the controlled MVP

- Monitoring and alerts for Pages failures, D1 errors, rate-limit failures, and notification delivery.
- Rate-limit retention/cleanup.
- More comprehensive D1-backed and concurrency tests.
- SEO/performance re-check after custom-domain activation.

## 6. Test evidence and limits

Passed:
- GitHub Actions Functions and Intake Tests on current `main`.
- GitHub Actions Jekyll CI on current `main`.
- GitHub Actions Functions and Intake Tests on PR #47.
- GitHub Actions Jekyll CI on PR #47.
- Cloudflare Pages Production deployment for the current main merge.
- Cloudflare Pages Preview deployment for the Preview AI-binding correction.
- Cloudflare Pages Preview deployment for PR #47.
- Read-only D1 schema and aggregate-count inspection in both environments.
- Confirmation that Production and Preview D1 bindings are distinct.

Not yet independently verified:
- Full visual/browser behavior on all public pages and mobile breakpoints.
- A real browser-to-Preview-to-D1 form submission.
- A successful authenticated owner-inbox session.
- Live AI response behavior under the current Preview configuration.
- End-to-end owner notification delivery.

The GitHub synthetic tests use test doubles for D1 and do not replace those live integration tests.

## 7. Cost and safety decisions

- Keep the solution free-first. Do not enable a paid service, add a card, or create a recurring charge without explicit approval.
- Do not provision R2 merely to claim image upload is complete.
- Do not run Production migrations or write synthetic data to Production.
- Keep Preview isolated from Production D1.
- No real customer data was exported or used for this audit.
- No DNS records, Production secrets, Production D1 rows, or public listings were changed.

## 8. Official launch decision

**Current decision: NO-GO for full commercial lead-generation launch.**

A limited informational site can remain publicly accessible on the Pages hostname, with Coffee and Transportation clearly described as interest-only and no claim of live property inventory. Do not advertise active lead capture as operational until owner authentication and notification/review access are verified.

The minimum next release gate is: owner-configured admin secret + working lead review/notification route + verified property inventory decision + custom-domain decision + browser-level Preview acceptance. Production merge/deployment remains a separate approval gate.

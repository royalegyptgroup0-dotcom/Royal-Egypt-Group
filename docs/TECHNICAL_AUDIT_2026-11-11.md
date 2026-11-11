# Royal Egypt Group — Technical Audit

**Verified:** 11 November 2026  
**Repository:** https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group  
**Default branch:** main  
**Current Production hostname:** https://royalegyptgroup-vy7.pages.dev  
**Production commit:** b34dc939ee440ab393e72e43e36084ccb1c3360f  
**Production deployment:** 9b6559e2-1c6c-4b68-82b1-a352efe08a5f — deploy stage successful  
**Decision:** Controlled pre-launch; not ready for unrestricted commercial lead collection.

This audit supersedes the 9 November launch-readiness snapshot where later changes or live checks differ. It records read-only verification performed on 11 November. No Production data, secrets, DNS records, or deployment settings were changed during this review.

## 1. Source control and deployment

- GitHub repository ownership and Admin/Push access are confirmed for royalegyptgroup0-dotcom/Royal-Egypt-Group.
- Cloudflare Pages project royalegyptgroup is connected to that same owner and repository; production branch is main.
- Production deployment for commit b34dc939... completed successfully.
- Pull Request #50 was merged into main. Its final head passed:
  - Functions and Intake Tests — [run 42697491845](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/42697491845)
  - Jekyll site CI — [run 42697491725](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/42697491725)
  - Cloudflare Pages Preview — [successful Preview](https://88b5ea1b.royalegyptgroup-vy7.pages.dev)
- PR #9 is merged. PR #10 was closed without merging. PRs #12, #13 and #14 were closed as superseded; do not reopen or merge them without a fresh review.
- Git/Cloudflare source metadata now points to the new GitHub owner. Automatic deployments are enabled.

## 2. Production and Preview data isolation

| Environment | D1 database | Database ID |
|---|---|---|
| Production | royal-eg-listings | fec37fa6-9406-4bb9-aba1-25f03a7cb2ed |
| Preview | royal-eg-listings-preview | 2d8c26ad-041e-4a51-aa13-ddb2120ce836 |

- The Production and Preview bindings are distinct.
- Read-only schema inspection found the same application tables and compatible definitions in both databases: customers, opportunities, listings, intake_rate_limits, and orders.
- No Production migrations or writes were performed during this audit.

### Aggregate data snapshot

Only counts and schema definitions were queried. Customer names, phone numbers, emails, notes, and order details were not read.

| Production table | Current count |
|---|---:|
| listings — rejected | 2 |
| listings — approved | 0 |
| customers | 0 |
| opportunities | 0 |
| orders — pending | 3 |
| intake_rate_limits | 0 |

Preview currently has 0 listings and 0 orders; the inspected customer, opportunity, and rate-limit tables are also empty.

## 3. Public website and catalogue

- The Production homepage and property page load from the current Pages hostname.
- The Production homepage and property page canonical URLs point to royalegyptgroup-vy7.pages.dev.
- GET /api/listings returned {"listings":[]}.
- The current properties.html source fetches /api/listings; the former three hard-coded property offers are absent from the current homepage and property-page source.
- This is the expected safe state while Production has no approved listings. Do not advertise the old offers as currently available.
- The property submission endpoint keeps new records in pending; image uploads remain disabled and are rejected until a secure storage pipeline exists.

## 4. Authentication and lead handling

### Verified

- Unauthenticated requests to /api/admin/inbox and /api/admin/listings returned HTTP 401.
- Both admin APIs require a server-side Bearer token.
- The owner-inbox page keeps the entered token in page memory and clears it on logout; it does not write the token to browser local or session storage.
- The generic inbox endpoint allows only an allowlist of customer/opportunity statuses and keeps orders read-only.
- Listing moderation allows only approved or rejected transitions from pending.

### Not yet verified — launch blockers

- A successful authenticated owner-inbox session has not been tested.
- The current Pages project configuration response did not expose an ADMIN_TOKEN key; this does not prove whether a secret exists because secret values are not readable. Treat owner authentication as unverified until a safe authenticated test succeeds.
- The optional MAKE_INTAKE_WEBHOOK_URL notification route has not been verified or tested end-to-end. The intake code stores the request in D1 independently of notification delivery and reports delivery_failed when the webhook request fails.
- There is no durable notification retry/outbox queue. D1 persistence alone does not guarantee that an owner will see a new lead promptly.
- Do not start collecting real leads until the owner can reliably access and review them or a notification/review route is proven.

## 5. AI assistant

- Production Pages has a Workers AI binding named AI.
- The main wrangler.toml declares the Preview AI binding; the successful PR #50 Preview deployment also showed an AI binding and the isolated Preview D1 database.
- The assistant queries approved listings only, uses a D1-backed rate limiter, caps request size, filters browser-supplied history to user messages, and labels listing content as untrusted context.
- Synthetic tests verify prompt/context separation and fail-closed rate limiting. They use a fake AI implementation; they do not prove that the live model will resist every prompt-injection attempt.
- A real live AI response test and multilingual browser QA have not been completed. Do not run usage-heavy tests without checking the current Workers AI free allocation and possible overage charges.

## 6. Current functional limitations

- No R2 bucket or property-image storage pipeline is configured. Image uploads are not active.
- Royal Egypt Coffee and Royal Egypt Transportation remain interest-registration pages, not operational shops, transport booking, payment, or availability systems.
- The owner inbox shows orders read-only; this does not make the underlying divisions operational.
- The listing price value is stored as text and bounded by length, not normalized as a numeric amount. Confirm whether free-text pricing is intentional before tightening validation.
- Rate limiting stores SHA-256 IP digests rather than raw IPs. These are pseudonymous identifiers, not guaranteed anonymous data.
- The shared admin Bearer token is an owner-only arrangement, not a multi-user role-based staff system.

## 7. Domain and launch readiness

- royalegyptgroup.com and www.royalegyptgroup.com are attached to Pages but both remain pending because the required CNAME records are not set.
- Keep https://royalegyptgroup-vy7.pages.dev as the active public hostname until DNS and certificate validation complete.
- Full desktop/mobile browser QA, successful authenticated admin access, real Preview-to-D1 submission, live AI behavior, and owner notification delivery remain unverified.

## 8. Required next actions

### P0 — before collecting real leads

1. Configure and safely verify the Production and Preview ADMIN_TOKEN secrets; never place their values in Git or frontend storage.
2. Establish and test the owner review/notification path, including failure handling.
3. Decide whether the custom domain will be activated; if yes, set the required CNAME records at the DNS provider.
4. Confirm genuine property inventory and publish only after owner verification and explicit approval.
5. Complete a controlled end-to-end Preview test with synthetic data only.

### P1 — before broader release

1. Complete Arabic, English and Russian visual/browser QA on desktop and mobile.
2. Test the live AI assistant with a bounded request budget and explicit free-tier/overage review.
3. Decide whether listing prices should remain free text or receive numeric/currency validation.
4. Add retention/cleanup and monitoring for rate-limit and notification failures.
5. Define a documented privacy/retention process and a staff-access model if additional operators are added.

## 9. Safety record

- No Production D1 writes, migrations, listing approvals, customer-data exports, secret changes, DNS changes, or Production deployment changes were made during this audit.
- Production D1 inspection was aggregate-only and read-only.
- No paid service, R2 bucket, or recurring charge was enabled.

**Final assessment:** the repository, GitHub integration, Production deployment, approved-only catalogue, and Production/Preview D1 separation are in good condition. The platform remains a controlled pre-launch site. The outstanding P0 gates are owner authentication, reliable lead review/notification, verified inventory, and browser-level acceptance.

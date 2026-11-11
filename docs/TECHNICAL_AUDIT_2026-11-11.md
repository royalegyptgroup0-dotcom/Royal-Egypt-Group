# Royal Egypt Group — Technical Audit

**Verified:** 11 November 2026, 06:42 Egypt time (UTC+2)  
**Repository:** https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group  
**Default branch:** `main`  
**Production hostname:** https://royalegyptgroup-vy7.pages.dev  
**Production commit:** `03a7a3aa6c10190a00d01866353a5ed12031086e`  
**Production deployment:** `abeaa066-d4f5-421a-83b0-0fe3d1e1b48b` — deploy stage successful  
**Decision:** Controlled pre-launch; not ready for unrestricted commercial lead collection.

This refresh supersedes the earlier 11 November snapshot after the Sophia integration was merged and deployed. Findings below distinguish live configuration, source review, synthetic tests, and items that remain unverified. The review was read-only: no Production D1 writes, secret changes, DNS changes, deployment-setting changes, or production code changes were performed.

## 1. Source control and deployment

- GitHub repository: `royalegyptgroup0-dotcom/Royal-Egypt-Group`.
- Repository owner and Admin/Push permissions were confirmed for the new account.
- Cloudflare Pages project `royalegyptgroup` is connected to the same GitHub owner and repository; production branch is `main`.
- Cloudflare automatic deployments are enabled. The current project configuration points to the new owner, not the former GitHub owner.
- Current Production deployment was triggered by a GitHub push to `main` and completed successfully on commit `03a7a3aa...`.
- PR #50 (release candidate), #55 (technical audit), #56 (bounded intake webhook timeout), #58 (Sophia branding), and #59 (Sophia backend integration) are merged.
- PR #59 checks passed on its final head:
  - Functions and Intake Tests — [run 42957798006](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/42957798006)
  - Jekyll site CI — [run 42957798155](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/42957798155)
  - Cloudflare Pages Preview — [successful Preview](https://7fb2d4ce.royalegyptgroup-vy7.pages.dev)
  - Production deployment after merge — successful, deployment `abeaa066-d4f5-421a-83b0-0fe3d1e1b48b`.
- The merged assistant integration connects the Sophia chat UI to the same-origin `/api/assistant` endpoint. It does not introduce a client-side credential.

## 2. Cloudflare bindings and Production/Preview isolation

Cloudflare's live project configuration and the repository's `wrangler.toml` agree:

| Environment | D1 binding | Database | Database ID | Workers AI |
|---|---|---|---|---|
| Production | `DB` | `royal-eg-listings` | `fec37fa6-9406-4bb9-aba1-25f03a7cb2ed` | `AI` present |
| Preview | `DB` | `royal-eg-listings-preview` | `2d8c26ad-041e-4a51-aa13-ddb2120ce836` | `AI` present |

- The two environments use distinct D1 database IDs.
- A successful current Preview deployment for PR #59 also showed the Preview D1 ID and AI binding.
- GitHub/Cloudflare source ownership and Preview/Production bindings are now consistent.
- The previous Preview isolation and stale Git-owner findings are resolved in the current live configuration.

## 3. D1 schema and aggregate data

Only schema definitions, index definitions, and aggregate counts were queried. No customer names, phone numbers, emails, notes, listing contact details, or order details were read.

### Schema parity

The five application tables exist in both databases:

- `customers`
- `intake_rate_limits`
- `listings`
- `opportunities`
- `orders`

The current read-only comparison found matching application-table columns, types, nullability, defaults, primary-key definitions, and explicit index definitions across Production and Preview. Both databases also contain the Cloudflare-managed `_cf_KV` table. The prior reported schema mismatch is not present in the current comparison.

### Aggregate snapshot

| Production metric | Count |
|---|---:|
| Listings — approved | 0 |
| Listings — rejected | 2 |
| Customers | 0 |
| Opportunities | 0 |
| Orders — pending | 3 |
| Rate-limit rows | 1 |

The Preview aggregate query returned no listing or order status rows and zero customers, opportunities, and rate-limit rows. Counts can change as the application receives traffic.

D1 query metadata confirmed `changed_db=false` and `rows_written=0` for the schema and aggregate inspections.

## 4. Public website and catalogue smoke checks

Read-only checks against the active Production hostname confirmed:

- Homepage loads and presents the three business divisions.
- Property page loads and describes manual review before publication.
- `GET /api/listings` returned `{"listings":[]}`.
- The current property-page source loads the catalogue from `/api/listings`; the former three hard-coded offers are absent.
- The empty catalogue is consistent with the Production D1 snapshot: zero approved listings.
- New property submissions are kept in `pending`; image uploads remain disabled and are rejected until a secure storage pipeline is available.

Unauthenticated access checks returned:

- `GET /api/admin/inbox` — HTTP 401.
- `GET /api/admin/listings` — HTTP 401.

These 401 responses confirm that unauthenticated requests are rejected. They do **not** prove that the owner credential is configured or that a valid owner login succeeds.

## 5. Authentication and lead handling

### Verified from source

- Both admin APIs require `Authorization: Bearer <ADMIN_TOKEN>`.
- The owner inbox page keeps its token in page memory, clears the input after successful login, and clears the token on logout. It does not use browser local/session storage.
- Listing moderation permits only `approved` or `rejected` transitions from `pending`.
- The generic inbox permits an allowlist of customer/opportunity statuses and keeps orders read-only.
- Public intake validates consent, request type, language, field lengths, phone digits, and a bounded request body.
- Intake persistence is D1-first. Optional Make notification failure does not discard the stored request.
- The Make webhook call is bounded to five seconds and reports `delivery_failed` on failure.

### Not yet verified — launch blockers

- A successful authenticated owner-inbox session has not been tested.
- The Pages project API response does not expose a readable `ADMIN_TOKEN` value. Secret values cannot be read back; do not infer that the secret is present or absent from that response. Owner authentication remains unverified until a controlled valid login succeeds.
- The optional `MAKE_INTAKE_WEBHOOK_URL` configuration and end-to-end notification delivery have not been verified.
- There is no durable notification outbox/retry queue. D1 persistence alone does not guarantee prompt owner awareness of a new lead.
- Do not begin unrestricted real-lead collection until owner access and a reliable review/notification path are proven.

## 6. Sophia AI assistant

### Verified from source and synthetic tests

- Production and Preview Pages configurations contain a Workers AI binding named `AI`.
- The backend uses `@cf/meta/llama-3.1-8b-instruct-fast`.
- The endpoint enforces a same-site origin allowlist, JSON content type, a 12 KB body cap, and a D1-backed limit of ten requests per IP per minute.
- IP values are SHA-256 hashed before storage; these are pseudonymous identifiers, not guaranteed anonymous data.
- Only approved listings are queried for assistant context.
- Browser-supplied assistant history is not trusted: the backend rebuilds context from user messages only.
- Listing content is passed separately and explicitly labeled untrusted data, not merged into system instructions.
- Synthetic tests cover approved-listing filtering, prompt/context separation, rate-limit enforcement, fail-closed behavior, malformed history, untrusted origins, and body-size limits.
- PR #59 adds the browser client and synthetic UI/API tests; its CI checks passed and its Production deployment succeeded.

### Still unverified

- No live Workers AI response has been tested after the Production deployment.
- Synthetic fake-AI tests do not prove resistance to every prompt-injection attempt.
- Arabic, English, and Russian behavior has not completed full browser/mobile acceptance.
- Do not run usage-heavy live tests until current free allocation and possible overage charges are checked. The project remains subject to the owner's free-first cost rule.

## 7. Functional scope and limitations

- Royal Egypt Properties is the active business focus, but the Production catalogue currently contains no approved listings.
- No R2 bucket or secure property-image storage pipeline is configured; website image upload is not active.
- Royal Egypt Coffee and Royal Egypt Transportation are interest-registration pages, not operational shops, booking, payment, dispatch, or availability systems.
- The forms for those divisions submit customer-interest requests; they do not confirm an order or reservation.
- The listing `price` field is stored as text and bounded by length, not normalized as a numeric amount. Confirm whether free-text pricing is intentional before changing it.
- The shared Bearer token is an owner-only access model, not a multi-user role-based staff system.
- The current `_headers` file sets X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and X-Frame-Options. A Content-Security-Policy header is not currently defined; adding one safely requires accounting for existing inline scripts and third-party embeds rather than applying a breaking policy blindly.

## 8. Domain status

Cloudflare currently reports:

- `royalegyptgroup.com` — pending; CNAME record not set.
- `www.royalegyptgroup.com` — pending; CNAME record not set.
- Active fallback hostname: https://royalegyptgroup-vy7.pages.dev

Do not treat the custom domain as active until DNS verification and certificate validation complete.

## 9. Required next actions

### P0 — before collecting real leads

1. Verify that the Production and Preview `ADMIN_TOKEN` secrets are configured, then perform a controlled authenticated owner login without exposing the token in Git, logs, or browser storage.
2. Verify the owner review path and the configured notification route end-to-end using synthetic Preview data.
3. Decide whether to activate the custom domain; if yes, set the required CNAME records at the DNS provider.
4. Confirm genuine property inventory, ownership/document status, prices, and availability with the owner; publish only after explicit approval.
5. Complete one controlled Preview intake test and confirm D1 persistence plus the resulting notification status.

### P1 — before broader release

1. Complete Arabic, English, and Russian desktop/mobile browser QA.
2. Test one bounded live AI interaction only after checking free-tier limits and potential charges.
3. Decide whether property prices remain free text or receive numeric/currency validation.
4. Define cleanup/retention for rate-limit records and monitoring for notification failures.
5. Define a privacy/retention process and a staff-access model if additional operators are added.
6. Plan a safe Content-Security-Policy improvement after reviewing inline scripts and third-party resources.

## 10. Safety record

- This review made no Production D1 writes, migrations, listing approvals, customer-data exports, secret changes, DNS changes, or deployment-setting changes.
- D1 inspection was schema-only and aggregate-only; query metadata showed zero rows written.
- Public smoke checks were read-only. Admin checks were unauthenticated and returned 401.
- No live AI prompt was sent, no Make webhook was called, no R2 bucket was enabled, and no paid service or recurring charge was added.

**Final assessment:** GitHub ownership, Cloudflare Git integration, Production deployment, D1 environment isolation, schema parity, approved-only catalogue behavior, and unauthenticated admin rejection are verified. The platform remains controlled pre-launch. The remaining P0 gates are successful owner authentication, reliable lead review/notification, verified property inventory, and browser-level acceptance.

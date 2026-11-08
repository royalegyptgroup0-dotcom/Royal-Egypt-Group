# Royal Egypt Group — Technical Audit
**Audit date:** 2026-11-08  
**Repository:** `royalegyptgroup0-dotcom/Royal-Egypt-Group`  
**Production branch:** `main`  
**Latest verified main commit:** `04a218ea90c0339557aaacd17bff2e0a3067efa9`  
**Latest verified Production deployment:** `03ff7727` — successful

## 1. Executive status

The platform is deployed and its core public intake, listing moderation, multilingual assistant, CRM inbox, and division-interest forms are present. It is **not yet ready for a full commercial launch**.

The primary launch blockers are:
1. No approved property listings are currently available to the public.
2. Property-image upload/storage is not implemented; the public listing endpoint explicitly rejects image uploads until a secure storage pipeline exists.
3. The two custom domains are attached to Pages but remain pending because their DNS CNAME records are not configured.
4. The owner inbox still uses one shared Bearer admin credential rather than named staff identities and sessions.
5. Make notification delivery has no durable retry queue.

## 2. Live Cloudflare configuration — read-only verification

- Pages project: `royalegyptgroup`.
- GitHub source: `royalegyptgroup0-dotcom/Royal-Egypt-Group`.
- Production branch: `main`.
- Active Pages hostname: `royalegyptgroup-vy7.pages.dev`.
- Production D1 binding: `DB` → `royal-eg-listings`.
- Preview D1 binding: `DB` → isolated `royal-ai-business-center-test`.
- Workers AI binding `AI` is configured for Production and Preview.
- The latest Production deployment from commit `04a218e` completed successfully.
- `royalegyptgroup.com` and `www.royalegyptgroup.com` are listed in Pages domain validation but remain pending because the required CNAME records are missing.
- The current Cloudflare account does not contain a managed DNS zone for `royalegyptgroup.com`; DNS must be changed at the domain's current DNS provider.

No Cloudflare DNS, secret, or Production D1 setting was changed during this audit.

## 3. Database status — aggregate queries only

No customer names, phone numbers, email addresses, or order details were read for this audit.

| Database | Table | Aggregate result |
|---|---|---:|
| Production | `listings` | 2 rows, both `rejected` |
| Production | `orders` | 3 rows, all `pending` |
| Production | `customers` | 0 rows |
| Production | `opportunities` | 0 rows |
| Preview | `listings` | 0 rows |
| Preview | `customers` | 0 rows |
| Preview | `opportunities` | 0 rows |
| Preview | `orders` | 0 rows |

Consequences:
- There are currently no approved property listings to display publicly.
- Three legacy pending orders exist in Production. Their records were not opened or modified.
- The owner inbox now has a protected, read-only Orders tab so the owner can review those records. No order status transition is exposed through that tab.
- Migration `0004_orders.sql` is versioned in the repository. The Production orders table already existed; the additive migration was applied only to the isolated Preview D1 database during validation. No Production D1 migration or data write was performed.

## 4. Verified platform functionality

### Real-estate listings
- Public listing reads expose approved listings only.
- New submissions remain pending until a separate owner moderation action.
- Admin moderation is separate from the generic CRM status endpoint.
- Request validation, body-size limits, and D1-backed request throttling are present.
- Secure image upload/gallery storage is not implemented. The current code rejects image uploads rather than pretending they were stored.

### Customer intake and CRM
- Website enquiries are persisted in D1 before optional notification forwarding.
- Request IDs support idempotent submissions.
- The intake endpoint uses consent checks, a honeypot, input validation, body-size limits, and a shared D1-backed rate limit.
- A failed Make webhook is reported as `delivery_failed`; there is no durable retry queue, so the API does not claim a retry is scheduled.

### AI assistant
- Workers AI is configured.
- The assistant uses approved public listings only.
- Listing content is passed as separately labelled untrusted context, not concatenated into system instructions.
- The assistant has bounded message/body limits and D1-backed throttling.
- The assistant must not invent property availability, prices, coffee products, transport routes, or services.

### Coffee and Transportation
- Both divisions remain non-operational.
- Their pages now offer multilingual expressions-of-interest forms.
- These forms create customer-interest enquiries through the existing intake/CRM path and tag the relevant division.
- They do not create orders, bookings, payments, or service commitments.

### Owner inbox
- The noindex owner inbox now displays customers, opportunities, listings, and orders.
- Admin API responses use `no-store` headers and explicit selected columns.
- The UI uses safe text rendering and does not persist the admin credential in localStorage.
- Orders are read-only; the generic PATCH route rejects order mutations.
- Authentication is still based on one shared Bearer credential, not named employee accounts or role-based sessions.

## 5. Security and test evidence

Recent merged changes:
- PR #33 — versioned the additive orders migration.
- PR #34 — aligned SEO/Open Graph/Sitemap URLs with the active Pages hostname.
- PR #37 — allowed only the exact HTTPS apex and www custom-domain origins in listings, intake, and assistant APIs.
- PR #39 — added consent-based Coffee and Transportation interest forms.
- PR #41 — added the read-only Orders tab to the owner inbox.

Validation:
- GitHub Actions Functions and Intake Tests passed for the custom-domain change, division-interest forms, and orders inbox.
- GitHub Actions Jekyll CI passed for those changes.
- Cloudflare Preview deployments succeeded.
- Preview deployments were verified to bind to the isolated Preview D1 database and include the Workers AI binding.
- Preview D1 schema was checked after adding the orders table/index; the Preview orders table remained empty.
- These automated tests use synthetic fixtures/FakeDB for application behavior. They do not replace full browser-to-Cloudflare-to-D1 integration tests.

## 6. Prioritized remaining work

### P0 — required before launch
1. Configure DNS CNAME records for the apex and www domains at the actual DNS provider, then revalidate both domains in Pages.
2. Add and owner-approve real, verified property listings. The current public catalogue has no approved listings.
3. Implement secure property-image storage and upload/gallery handling, then test upload, retrieval, validation, and access control.
4. Run a complete synthetic Preview journey for listing submission, owner moderation, customer intake, AI response, and read-only order review.

### P1 — operational reliability and administration
1. Replace the shared admin credential with named staff identities, sessions, roles, and audit trails.
2. Add a durable notification outbox and retry worker for failed Make/email notifications.
3. Add explicit migration automation or a documented, repeatable D1 migration procedure for both environments.
4. Add D1-backed integration tests and concurrency tests; current FakeDB tests alone cannot prove production-like D1 behavior.
5. Define a reviewed operational workflow before enabling actual Coffee/Transportation orders.

### P2 — hardening and quality
1. Add edge-level bot protection/Turnstile and review rate-limit table retention/cleanup.
2. Complete Arabic/English/Russian QA across every route and mobile layout.
3. Perform accessibility, performance, and SEO checks after custom-domain activation.
4. Add monitoring and alerts for Pages deployment failures, D1 errors, rate-limit failures, and notification delivery failures.

## 7. Change-safety record

- Code changes were made through isolated branches and pull requests.
- Production deployments occurred only after CI and Preview validation.
- No Production D1 data was changed.
- No Production migration was run.
- No DNS records, secrets, Make scenarios, public posts, or customer notifications were changed or activated.
- The Preview D1 received only the additive orders table and index needed to validate the new read-only inbox.

**Overall conclusion:** The platform is materially more complete and safer than the previous snapshot, but it remains a controlled pre-launch system. The next critical milestones are DNS activation, real approved property inventory, secure image storage, and a complete D1-backed end-to-end test.

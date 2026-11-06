# Royal Egypt Group — Verified Project Handoff

Last verified: 2026-11-06
Owner: Royal Egypt Group
Company: شركة رويال ايجبت للتسويق العقاري

## Mission
Build a secure, multilingual Royal Egypt Group platform and a maintainable automation/agent layer while keeping costs as close to zero as reasonably possible. Never promise unlimited free usage. Preserve production and document every change so the owner can operate the system without depending on an external developer.

## Organization
- Royal Egypt Group
- Royal Egypt Properties
- Royal Egypt Coffee
- Royal Egypt Transportation

## Repository and release candidate
- GitHub: https://github.com/yasserabdelaziz83-maker/Royal-Egypt-Group
- Default branch: `main`
- Release candidate branch: `release/royal-eg-release-candidate-2026-11-06`
- Draft PR #9: https://github.com/yasserabdelaziz83-maker/Royal-Egypt-Group/pull/9
- Operations manual: `.github/PROJECT_OPERATIONS.md` (blocked from public Pages paths by middleware)
- Current Pages production hostname: https://royalegyptgroup.pages.dev
- Preferred custom domain: https://royalegyptgroup.com (not currently attached to Pages)

The release candidate combines:
- Multilingual Arabic / English / Russian homepage, hero, division pages, developer directory, and shared assistant UI.
- Main branch SEO metadata, sitemap, robots rules, Google verification, Cloudflare Web Analytics beacon, and security middleware.
- Hardened property listing APIs from Draft PR #2.
- Secure multilingual website intake endpoint and form from Draft PR #7, with additional webhook-host validation.
- Owner operations documentation and automated syntax/intake tests.

Do not merge PR #9 or deploy Production until all Preview gates pass and the owner confirms go-live.

## Verified deployment status
- Cloudflare Pages project: `royalegyptgroup`.
- Production branch remains `main`.
- Release candidate Preview deployment succeeded for commit `0aa07cbb6223b5b801a1ee7405359833ccc235aa`; the latest deployment may advance as new commits are pushed.
- Preview branch alias: https://release-royal-eg-release-can.royalegyptgroup.pages.dev
- Only `royalegyptgroup.pages.dev` is attached as a domain; the custom `.com` domain is not attached.
- GitHub Jekyll CI succeeded on the release-candidate commits inspected.
- Added GitHub workflow `.github/workflows/functions-check.yml`: Node 22 syntax checks all Functions/assets JavaScript and runs synthetic intake tests. The first run completed successfully.
- Production has not been changed by this work. Project policy requires all tests to use the separate test database and prohibits Production writes during testing.

## Cloudflare Pages bindings and secrets
Verified through the authenticated Cloudflare API:
- Production D1 binding `DB` points to `royal-eg-listings` (`23185e4e-d299-41b2-abd7-bc533466e94a`). The release-candidate Wrangler config explicitly maps Preview to test DB `royal-ai-business-center-test` (`6e57492c-717d-4fb6-b122-75e5c14cf161`) and Production to `royal-eg-listings`; the latest Preview deployment succeeded and Cloudflare confirmed Preview DB points to the test database.
- Encrypted secret `ADMIN_TOKEN` exists in Preview and Production. Its value was not read.
- Encrypted secret `MAKE_INTAKE_WEBHOOK_URL` was added to Preview only and verified by key name. It was not added to Production.
- `wrangler.toml` in the release candidate declares `[ai] binding = "AI"` for local/default, Preview, and Production environments. The Preview Worker settings now confirm the `AI` binding. A synthetic assistant response test is still pending.
- R2 binding `PROPERTY_IMAGES` is not verified; image upload is not enabled by the current listing form.
- No Cloudflare edge rate-limiting rule or Turnstile verification has been configured yet.

## Website features and limits
- Arabic-first responsive group homepage with Arabic / English / Russian support.
- Royal Egypt Properties: listing catalogue and moderated listing submission.
- Developer directory: informational, official-source links, explicit non-endorsement disclaimer.
- Coffee and Transportation pages are informational / coming soon; online ordering and transport booking are not active transactional systems.
- Public property listings come from approved records only.
- The admin page `admin-listings.html` uses an in-memory password input and sends `Authorization: Bearer ADMIN_TOKEN`; the server checks the secret before listing moderation. Do not store the token in browser storage or share it.
- Listing image endpoint expects R2 `PROPERTY_IMAGES`, but current public form rejects uploaded files and directs image handoff through WhatsApp.
- Assistant endpoint uses `@cf/google/gemma-4-26b-a4b-it`, replies in the visitor's language, and now queries only approved public listing fields from D1. It does not read customer contact records.
- The assistant has a best-effort in-memory per-isolate request limiter; this is not a substitute for global edge protection.
- The assistant must never invent price, availability, ownership, legal status, permits, developer endorsement, coffee products, or transport schedules.

## Website contact intake — Preview test passed
- Public form posts to `POST /api/intake`.
- The Pages Function validates Origin, JSON size, field limits, request type, language, consent, and a honeypot.
- The outbound webhook host is restricted to `https://hook.eu1.make.com`; the secret value is never committed.
- Listing submissions are tagged `pending_review`; no automatic publication.
- Preview-only Make secret `MAKE_INTAKE_WEBHOOK_URL` is configured.
- One synthetic Preview request returned HTTP 202 (`accepted: true`).
- Make learned these 13 fields: `event`, `reference`, `request_type`, `status`, `name`, `phone`, `email`, `location`, `details`, `language`, `consent`, `source`, `received_at`.
- The synthetic request used placeholder data only. No real customer records were created and no D1 rows were inserted.
- Make scenario 8408747 remains inactive; payload schema learned, no queued deliveries. Do not activate until routing and downstream API permissions are verified.
- The one-shot HTTP test scenario 8414627 is inactive after use.

## D1 databases and schema parity
Production:
- Database: `royal-eg-listings`
- ID: `23185e4e-d299-41b2-abd7-bc533466e94a`

Test:
- Database: `royal-ai-business-center-test`
- ID: `6e57492c-717d-4fb6-b122-75e5c14cf161`

A read-only `sqlite_master` query inspected table definitions only; no customer, lead, deal, revenue, listing, or agent records were read.

Both databases have the same 12 business table names:
`agent_approvals`, `agent_audit_log`, `agent_memory`, `agent_tasks`, `agents`, `costs`, `customers`, `daily_summary`, `deals`, `listings`, `opportunities`, `revenue`.

Important: their schemas are NOT fully identical:
- Production also has `_debug`; test does not. Both have `_cf_KV`.
- Four common tables differ: `listings`, `agent_approvals`, `agent_memory`, and `agent_tasks`.
- Production `listings` includes `contact_name`, `contact_phone`, `area_sqm`, `images`, and `reviewed_at`; test has legacy `image_url` and lacks several production fields.
- Production `agent_approvals` has required task/action fields and a foreign key; test has a looser definition.
- Production `agent_memory` has id/timestamps and unique(category,key); test uses category/key as its primary key.
- Production `agent_tasks` includes `started_at`; test does not.
- The inspected definitions for `customers`, `opportunities`, `agents`, `agent_audit_log`, `costs`, `daily_summary`, `deals`, and `revenue` match.

A non-destructive migration has been applied to the test `listings` table only, adding `contact_name`, `contact_phone`, `area_sqm`, `images`, and `reviewed_at` plus the status/created_at index. The old `image_url` column was preserved and the new columns were verified. The `agent_approvals`, `agent_memory`, and `agent_tasks` schema differences remain untouched pending Worker source inspection. Do not drop/recreate either database.

## Existing Cloudflare Workers discovered
Cloudflare API listed these scripts:
- `d1-get-started`
- `reg-admin-audit`
- `royal-ai-business-center`
- `royal-ai-business-center-test`
- `royal-eg-owner-dashboard`
- `royal-egypt-agent`
- `royalegyptgroup`

The `royal-ai-business-center` Worker settings show:
- `ADMIN_TOKEN` encrypted secret (value not read)
- `DASHBOARD_ORIGIN` plain-text binding
- `DB` D1 binding to production database `royal-eg-listings`

Worker source and endpoint contracts still need inspection. Do not assume the Worker already provides customer/opportunity intake APIs. The Pages project and Worker named `royal-eg-owner-dashboard` are separate resources until proven otherwise.

## Make scenarios
Organization ID: 9505709
Team: My Team (3460199)

- 8408747 — `Royal Egypt – Secure Website Intake`: inactive, webhook payload learned; no routing modules or D1 writes yet.
- 8413166 — `Royal Egypt — Cloudflare Read-Only Audit`: on-demand only and currently inactive after each inspection. Uses existing Cloudflare connection ID 12773194. Never put secrets in its mapper.
- 8414627 — `Royal Egypt — Preview Intake Synthetic Test`: inactive after its one successful test.
- 8413158 — `Royal Egypt — Create Management Folder`: inactive, Google Drive.
- 8413745 — `Royal Egypt — Save Project Audit Report`: inactive, Google Drive.
- 8413630 — `Royal Egypt — Save Project Audit Handover to Drive`: inactive, Google Drive.
- 8333266 — `Daily CEO Notes | Royal Egypt`: separate content workflow; previously error/inactive. Do not merge it into the website intake workflow.
- 8412856 — `Integration OpenAI (ChatGPT, Whisper)`: active scheduled scenario; inspect before any change.

Make management API has intermittent rate limits. Do not burn operations on repeated polling; batch work and keep scenarios inactive unless an explicit test/run is needed.

## Required next steps
1. Inspect source/settings/routes for `royal-ai-business-center`, `royal-ai-business-center-test`, `royal-eg-owner-dashboard`, and `royal-egypt-agent`.
2. Confirm whether existing Workers already expose authenticated customer/opportunity/listing APIs. Prefer existing authenticated APIs over new D1 write paths.
3. Inspect full D1 schema/indexes and compare the four mismatched tables; prepare a non-destructive test migration only after Worker dependencies are known.
4. Add and test Turnstile or equivalent edge-level anti-abuse protection for public intake; keep the endpoint closed to public use until then.
5. Verify the Pages Preview Worker actually has the `AI` binding and test the assistant against approved listings only.
6. Design Make routing for customer, opportunity, and listing submissions using the learned 13-field payload and verified API contracts.
7. Add owner notifications and dashboard status tracking without exposing customer data.
8. Test listing moderation and admin authentication on Preview.
9. Verify all pages/languages and accessibility on Preview.
10. Obtain explicit owner go-live approval before merging PR #9, activating production Make workflows, or deploying Production.

## Security rules
- Never expose secrets, webhook URLs, admin tokens, passwords, or customer data in chat, source code, logs, or public files.
- Store secrets only in encrypted Cloudflare settings or secure Make connections.
- Never read real customer records during audits.
- Never publish a listing automatically.
- No production D1 writes, production automation activation, marketing outreach, DNS changes, paid upgrades, or Production deployment without explicit approval.
- Keep a changelog and rollback path for every release.

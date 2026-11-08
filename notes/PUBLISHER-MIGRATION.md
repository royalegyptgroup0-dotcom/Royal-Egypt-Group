# CEO Notes — Publisher Migration Plan

Status: design only; no cutover is authorized by this document.

## Current production flow

The primary Make publisher is scenario `8438190` (“CEO Notes | AI Editorial + Image + Facebook + Live Feed 19:30”). Repeated read-only checks on 2026-11-08 returned `status=paused` while the separate `isActive` flag was `true`; its configured daily time is 19:30 Africa/Cairo and the listed next execution time (17:30 UTC) had already passed. No run was recorded for 2026-11-08. Its last recorded run was 2026-11-07 21:41:52 UTC, marked success with four operations. Execution inspection shows modules 1–4 ran, including one Facebook module, while the Royal Egypt Properties and final receipt modules did not run. Module input/output drill-down returned no stored records, so the post ID and final receipt cannot be independently confirmed.

The legacy scenario `8419318` (“CEO Notes | Daily Publisher 19:30”) remains paused and inactive (`isActive=false`). Do not activate it.

## Verified production gap — 2026-11-08

A read-only inspection of the deployed Worker and Make module configurations found a partial-publication recovery defect that must be fixed before the scenario is resumed:

- The Make flow writes the article to the canonical feed before the social actions.
- The feed write returns `alreadyPublished=true` for an existing published day, and the Make filter intentionally blocks the social route in that case.
- The deployed Worker’s cold-start fallback URL points to the repository `main` branch rather than the isolated `ceo-notes-site` branch. A read-only comparison on 2026-11-08 found the same Days 25–27 article bodies and titles in both branches, but the `main` copy lacks the category/tag metadata present on `ceo-notes-site`. If the Worker KV feed is ever missing or invalid, fallback seeding can therefore restore an older metadata shape. Correct the fallback source in a tested release before relying on it for recovery.
- The Worker receipt handler currently accepts `receiptOnly` only when both the CEO Page post ID and Royal Egypt Properties post ID are present in the same request.
- Make calls that receipt handler only after both Facebook modules succeed.
- Therefore, if the CEO Page post succeeds but the Royal Egypt Properties post fails, the CEO post can remain without a stored receipt. A normal retry for the same day is then blocked by the existing-day gate, while blindly replaying a Facebook action risks a duplicate.
- The last recorded execution (2026-11-07 21:41:52 UTC) was marked success but its execution inspection shows only modules 1–4 ran; modules 5 and 6 did not run. The four-operation success is not evidence of a completed two-page publication or receipt.

Required repair: persist one receipt immediately after each destination succeeds, keep each destination independently idempotent, and provide a controlled reconciliation path for ambiguous outcomes. Test every partial-failure permutation in an isolated environment before editing the production Worker or Make scenario. Do not manually retry, resume, or republish an uncertain item.

The primary scenario's configured flow is:

1. Generate the next article and image.
2. Save the article to the canonical CEO Notes feed.
3. Publish to the CEO Facebook Page only when the feed confirms that the day is new.
4. Publish to Royal Egypt Properties after the CEO Page post succeeds.
5. Write both Facebook post IDs and timestamps back to the canonical feed as a publishing receipt.

Do not change the current scenario's pause/active state, run it manually, or alter its schedule as part of this migration. The Cloudflare-native replacement must pass parity tests before any separate cutover decision.

## Target Cloudflare-native design

### 1. Draft generation

- Use the existing Cloudflare AI binding to create a draft article and image.
- Assign a unique day number from the canonical feed.
- Store the draft separately from published feed data.
- Validate required fields, title length, article length, image availability, category, tags, and duplicate day.
- Never expose draft records through the public feed.

### 2. Human review

- A private editorial dashboard displays the Arabic source, English and Russian variants, image preview, category, tags, and planned destinations.
- Publishing requires an explicit approval action.
- Approval is recorded with reviewer identity, timestamp, content hash, and approved destinations.

### 3. Idempotent publication

- Use a stable idempotency key for each article day and destination.
- Persist each stage independently: website feed, CEO Facebook, Royal Egypt Properties.
- Before each external post, check whether that destination already has a receipt for the same day.
- After a successful post, persist the returned post ID and timestamp immediately.
- If a later destination fails, retry only the missing destination; never repeat completed stages.
- If an outcome is uncertain, stop and reconcile the destination history before retrying.

### 4. Scheduling and retries

- Cloudflare Cron runs a lightweight scheduler check.
- Evaluate the desired local time using the `Africa/Cairo` timezone rather than hard-coding a UTC offset that changes with daylight saving time.
- Use a bounded retry policy with exponential backoff and a maximum attempt count.
- Move exhausted or ambiguous jobs to a dead-letter queue for human review.
- Use a single-writer lock or Durable Object if concurrent scheduled/manual runs could overlap.

### 5. Security

- Store Facebook authorization only as Cloudflare Worker secrets.
- Never place credentials in source files, browser code, URLs, public KV records, logs, or article data.
- Verify the authenticated owner/reviewer on every approval and publishing endpoint.
- Keep CEO Notes data and routes isolated from Royal Egypt Group production.

## Parity acceptance checklist

- [ ] Same article fields and image quality as the current Make publisher.
- [ ] Website feed is written before either social destination.
- [ ] Duplicate day is blocked before social publishing.
- [ ] Partial failure resumes only missing destinations.
- [ ] Facebook post IDs and timestamps are persisted as receipts.
- [ ] Retries are bounded and observable.
- [ ] Scheduled execution respects 19:30 Africa/Cairo across daylight-saving changes.
- [ ] Human approval is required before any external social post.
- [ ] Rollback to the existing Make publisher is documented and tested.
- [ ] Reconcile the primary scenario's current paused state and confirm whether its 19:30 schedule should resume; do not change it without a separate explicit instruction.
- [ ] Verify both social post IDs and timestamps are written to the canonical feed after a controlled, approved run.
- [ ] Owner explicitly approves the final cutover.

## Cutover rule

Do not deactivate or replace the current Make publisher merely because the Cloudflare implementation exists. Keep Make active until all parity checks pass, then request a separate explicit cutover approval.

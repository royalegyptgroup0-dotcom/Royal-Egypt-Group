# CEO Notes — Publisher Migration Plan

Status: design only; no cutover is authorized by this document.

## Current production flow

The current Make publisher remains active on its existing daily schedule (19:30 Cairo). Its verified sequence is:

1. Generate the next article and image.
2. Save the article to the canonical CEO Notes feed.
3. Publish to the CEO Facebook Page only when the feed confirms that the day is new.
4. Publish to Royal Egypt Properties after the CEO Page post succeeds.
5. Write both Facebook post IDs and timestamps back to the canonical feed as a publishing receipt.

The current Make flow must remain active until the Cloudflare-native replacement passes parity tests and the owner separately approves cutover.

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
- [ ] Owner explicitly approves the final cutover.

## Cutover rule

Do not deactivate or replace the current Make publisher merely because the Cloudflare implementation exists. Keep Make active until all parity checks pass, then request a separate explicit cutover approval.

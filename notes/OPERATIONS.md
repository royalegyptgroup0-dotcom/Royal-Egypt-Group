# CEO Notes — Operations and Recovery

Canonical production site: https://ceo-notes.pages.dev  
Cloudflare Pages project: `ceo-notes` (Primary Cloudflare account)  
Canonical Git branch: `ceo-notes-site`

## Publishing pipeline

Primary Make publisher scenario: `8438190` (“CEO Notes | AI Editorial + Image + Facebook + Live Feed 19:30”).

Latest read-only state check: 2026-11-08 20:50 Africa/Cairo:
- Make status: `paused`; separate `isActive` flag: `true`.
- Configured schedule: daily at 19:30 Africa/Cairo.
- Listed next execution: 2026-11-08 17:30 UTC (already passed at the time of inspection).
- No execution was listed for 2026-11-08.
- Last run: 2026-11-07 21:41:52 UTC, marked success with four operations; Facebook module 3 was invoked successfully, but the final receipt stage was not shown as executed. Do not infer that both Facebook destinations or the feed receipt were completed.
- Legacy scenario `8419318` is paused and inactive (`isActive=false`).

Do not manually run, activate, resume, or reschedule either publisher while investigating. Resolve the paused state and receipt gap before a separately approved cutover or schedule change.

Configured publishing sequence:
1. Generate the article and image.
2. Save the new article to the canonical website feed.
3. Publish to the CEO Facebook Page only if the feed confirms the day is new.
4. Publish to Royal Egypt Properties after the CEO Page post succeeds.
5. Persist both Facebook post IDs and timestamps in the article's `publishingReceipts` field.

Do not manually run the publisher for testing. A duplicate-day response must stop both social publishing modules. If a run is incomplete or its outcome is uncertain, inspect the execution and Facebook page history before retrying.

## Backups

- Cloudflare KV stores the canonical feed and generated image assets.
- A baseline snapshot was created on 2026-11-08.
- Daily Worker Cron snapshot: 02:00 UTC (04:00 Africa/Cairo).
- Retention: 30 daily snapshots.
- Snapshot contents: feed JSON, all stored `image:` values, and a manifest containing SHA-256 hashes and post-day inventory.
- The first baseline read-back verified the feed, manifest, and image assets against their source hashes.

Backup keys use the prefix `backup:YYYY-MM-DD:`:
- `feed` — canonical feed snapshot.
- `image:<day>` — stored image snapshot.
- `manifest` — creation time, post days, and SHA-256 values.

## Recovery procedure

A live restore is a production data change and must be explicitly approved.

1. Select a backup date and read its manifest.
2. Verify the feed and every image snapshot against the manifest SHA-256 values.
3. Inspect the post-day inventory and image-key list.
4. In an isolated namespace, restore the feed and images and verify the restored content and image routes.
5. Only after the isolated restore passes, obtain explicit approval before copying any backup values over live keys.
6. Recheck `/health`, `/feed`, article routes, RSS, sitemap, and image URLs after a live restore.

Never restore a backup over the live feed merely to test recovery.

## Deployment and rollback

- Preview and production are separate Cloudflare Pages environments.
- The canonical CEO Notes project is `ceo-notes`; do not use the Royal Egypt Group Pages project for CEO Notes validation.
- Production deployments are ad hoc and must be verified against the canonical domain.
- Keep the previous successful production deployment available for rollback.
- After each release, verify the homepage, `/feed`, `/rss.xml`, `/sitemap.xml`, `/robots.txt`, at least one `/post/<day>` route, radio assets, and `/markets`.

## Market data

- Source: Frankfurter daily reference FX and XAU rates.
- Freshness target: six hours.
- Bounded stale fallback: up to 72 hours.
- Stale responses are explicitly labelled and must never be presented as live trading or bank/dealer execution quotes.
- If no fresh or bounded stale value is available, the API returns an explicit unavailable response.

## Radio

Radio Browser supplies station metadata; audio streams come directly from broadcasters. CEO Notes does not host, record, proxy, or rebroadcast audio. Only HTTPS streams are offered, and playback requires a visitor action.

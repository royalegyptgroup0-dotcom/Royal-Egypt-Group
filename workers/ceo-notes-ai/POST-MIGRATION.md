# CEO Notes legacy image endpoint migration

**Status:** source change only; no Cloudflare or Make configuration changed.

## Current contract

- Make module 2 currently sends an authenticated GET request with eight query parameters.
- The Production Worker currently accepts that GET form and writes the generated image to CEO_NOTES_KV.
- This is a state-changing GET. It must not be switched to POST until a compatible Worker revision is deployed and verified.

## Target contract

After the Worker revision is deployed and the secure Worker secrets are confirmed:

- Keep the same authenticated HTTP API-key connection in Make.
- Change module 2 to POST with Content-Type: application/json.
- Send a JSON object containing day, title, article, ideaOfTheDay, ceoChallenge, discussionQuestion, hashtags, and imagePrompt.
- Prefer the nested shape { post: { ...article fields... }, imagePrompt: ... }.
- Keep the legacy GET path available for one rollback window. Remove it only after a successful controlled POST verification and a separate release review.

## Required deployment gates

1. Production Worker Secret LEGACY_ROUTE_SUFFIX is now configured with the existing shared suffix; the currently deployed code does not consume it yet. Configure the same secret on the isolated Preview Worker through Cloudflare's secret manager. The value is never included in this repository.
2. Production still has no ADMIN_TOKEN secret. The owner must set it to the exact value already stored in Make's authorized HTTP API-key connection. Do not paste it into chat.
3. Deploy this source only to an isolated Preview first and read back the Worker secret names and bindings.
4. Run a synthetic authenticated POST image test with a stubbed AI binding. Do not consume Workers AI quota or create a public article.
5. Only after the Production effect is explicitly approved, deploy the compatible Worker, update Make module 2, read the module configuration back, and verify that one controlled request produces one image key.
6. Keep the scheduled scenario paused until per-platform publication receipts and recovery are accepted.

No public social post, new article, or Production write is part of this migration.

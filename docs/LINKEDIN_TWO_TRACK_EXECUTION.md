# LinkedIn execution — two independent tracks

## Purpose
Implement the previously agreed LinkedIn plan without merging the CEO Notes identity with Royal Egypt Group. Both tracks are organic-first and target a $0 recurring-cost workflow.

## Track A — CEO Notes / personal member profile

- Publishing identity: the owner's personal LinkedIn member profile (user-provided URL: https://www.linkedin.com/in/yasser-abdelaziz-a0440550/; not independently verified in this implementation).
- Editorial source: approved articles in `notes/posts.json`.
- Canonical destination: `https://ceo-notes.pages.dev/post/{day}`.
- Adapt each article into a LinkedIn-native post: strong opening, one central management insight, practical takeaway, one discussion question, a short hashtag set, and a link to the full article.
- Preserve the original CEO Notes voice and meaning. Do not claim personal experience, employment, customers, or results not present in the source.
- Never publish CEO Notes content from the Royal Egypt Group company page.

## Track B — Royal Egypt Group / company page

- Publishing identity: the separate Royal Egypt Group LinkedIn Company Page. The owner reported that the Page was created; its canonical public URL, organization URN, and admin role have not yet been independently verified.
- Editorial source: approved Royal Egypt Group website information and owner-approved business facts only.
- Positioning: an Egypt-focused business group developing a digital presence for property information and inquiries. Keep current operational limits explicit.
- Do not advertise unapproved property inventory, availability, prices, developer relationships, coffee/transport services, customer outcomes, or guarantees. The production README records that the catalogue has no approved D1 listings and that Coffee/Transportation are interest-only pages, not operational commerce/booking services.
- Never publish CEO Notes articles or personal leadership commentary from this company Page.

## LinkedIn technical requirements (verified against official documentation)

1. Use LinkedIn's 3-legged OAuth authorization-code flow. Configure an HTTPS redirect URL, validate a cryptographically random `state` value, exchange the code server-side, and keep Client Secret/access tokens out of source control, browser code, logs, and chat.
2. Personal publishing requires `w_member_social`. LinkedIn lists this under its self-service "Share on LinkedIn" open permission.
3. Company publishing requires `w_organization_social` and the authorizing member must hold an eligible Page role (Administrator, Direct Sponsored Content Poster, or Content Admin). Organization access is not assumed merely because a Page exists; the app may need LinkedIn program approval.
4. Use the current REST Posts API, not the retired UGC Posts endpoint. Requests require `Linkedin-Version: YYYYMM` and `X-Restli-Protocol-Version: 2.0.0`. A text-only organic post is supported. Image posts require uploading the media asset first and using the returned image URN.
5. Save the returned LinkedIn post URN and publication time as a receipt. Use a durable outbox with per-track/per-article idempotency keys. If a network timeout leaves publication ambiguous, do not blindly retry; reconcile the post before retrying.

Official references:
- OAuth overview: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication
- Authorization-code flow: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- API access and permissions: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- Organic posts: https://learn.microsoft.com/en-us/linkedin/marketing/usecases/page-management/organic-posts-usecase

## Free-first implementation sequence

### Phase 1 — identity and access
- Confirm the exact personal profile and the public Company Page URL.
- Create/select a LinkedIn Developer application owned by the account holder.
- Enable the self-service Share on LinkedIn product and request only `w_member_social` for Track A.
- Request Community Management access for Track B only if LinkedIn offers/approves the required `w_organization_social` permission.
- Register the HTTPS callback URL before OAuth.

### Phase 2 — isolated connectors
- Keep CEO Notes OAuth state, encrypted token storage, outbox, post receipts, and publishing configuration in the CEO Notes Worker/KV boundary.
- Keep Royal Egypt credentials, Page URN, outbox, receipts, and publishing configuration in the Royal Egypt platform boundary. Do not share feed content or stored tokens between projects.
- Store credentials only as Cloudflare secrets. Encrypt OAuth tokens before durable KV storage with a dedicated encryption secret; never return tokens to the browser.
- Implement draft/preview first. The publish endpoint must require the existing admin authorization and a separate explicit per-post approval record.

### Phase 3 — validation and controlled launch
- Test OAuth state mismatch, expired state, denied consent, missing scopes, expired/revoked token, wrong Page role, API 401/403/429, timeout-after-create, and duplicate attempts.
- Validate text-only publishing before adding media uploads.
- Publish one user-approved test post on the personal profile. Do not test with an unapproved public post.
- Keep the Company Page track disabled until its permission and Page role are confirmed.
- Do not enable scheduled or unattended publishing until manual approval, receipts, idempotency, and failure recovery have passed end-to-end tests.

## Current blockers — no secrets or publishing access have been assumed

- No LinkedIn Developer App Client ID/Client Secret or OAuth grant is recorded in project configuration.
- No verified organization URN or public Company Page URL is recorded in project configuration.
- No approved `w_organization_social` permission has been evidenced.
- The existing CEO Notes Worker currently generates content/images and updates its own feed; it does not call LinkedIn. Its current Cron is backup-only.
- No LinkedIn post has been published by this integration. This document and the accompanying post drafts are preparation, not publication receipts.

## Approval boundary
The owner previously approved development of the two independent tracks. That does not authorize access to a LinkedIn account or public publication. Keep the integration in draft/preview mode until the owner completes LinkedIn's consent flow and explicitly approves the first post on each publishing identity.

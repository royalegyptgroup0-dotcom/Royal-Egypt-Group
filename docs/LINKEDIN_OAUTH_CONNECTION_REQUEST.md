# LinkedIn OAuth Connection Request

**Status:** PREPARED, NOT SENT. Both LinkedIn tracks remain paused. No credentials or OAuth consent have been received.

## Identity separation

### Track A: CEO Notes personal member profile

- Destination: the owner's personal LinkedIn member profile recorded in PR #54. The URL is owner-provided but has not been independently verified.
- Content: an approved CEO Notes article adapted for the member profile. Preserve the CEO Notes editorial voice and source facts.
- Required scope: `w_member_social`.
- Author identity must resolve to the exact `urn:li:person:{id}` returned by the official OAuth identity flow.
- Never publish this content from the Royal Egypt Group Company Page.

### Track B: Royal Egypt Group Company Page

- Destination: the separate Royal Egypt Group LinkedIn Company Page.
- Exact public Page URL and `urn:li:organization:{id}` are not yet verified.
- Content: corporate copy only, based on verified Royal Egypt Group facts. Do not publish CEO Notes articles or personal leadership commentary on this Page.
- Required scope: `w_organization_social`.
- The authenticated member must have an approved eligible Page role. Verify the actual role through the official Organization Access Control API before any post.

Do not add another LinkedIn Page or substitute a similarly named entity.

## Owner connection request

Please complete these account-side steps in the official LinkedIn Developer Portal:

1. Create or select the Developer App that will own the OAuth integration.
2. For the personal-member track, add the **Share on LinkedIn** product and authorize `w_member_social`.
3. For the Company Page track, request the required **Community Management API** access and `w_organization_social` permission. LinkedIn restricts organization publishing to eligible Page roles.
4. Confirm the exact personal profile URL in PR #54.
5. Provide the canonical public URL for the Royal Egypt Group Company Page and confirm its organization URN. Confirm that the account used for OAuth has an approved eligible role on that exact Page.
6. Do not create or share an access token in chat. Complete OAuth through the eventual secure callback only.

### OAuth callback is not ready to register

The current PR #82 Worker does not implement a LinkedIn OAuth authorization or callback route, and the Production runtime decision has not been accepted. Therefore there is no verified redirect URI to register yet. Do not guess a callback URL or register a placeholder. Once the owner accepts the runtime and the OAuth handler is implemented, the implementation will provide the exact redirect URI and state/PKCE requirements before consent is requested.

No LinkedIn connection request can be completed in Make today: the available Make search did not surface an official LinkedIn publishing module. Scraping or unofficial browser-publishing connectors are prohibited.

## Verified API contract

Official documentation checked on 2026-11-15:

- Current Marketing API version: `202610` (October 2026), active until 2027-10-15.
- Version `202511` sunsets on 2026-11-16. Do not build against that expiring version.
- Create organic posts with `POST https://api.linkedin.com/rest/posts`.
- Required headers:
  - `Authorization: Bearer <token>`
  - `Linkedin-Version: 202610`
  - `X-Restli-Protocol-Version: 2.0.0`
  - `Content-Type: application/json`
- Personal member posting requires `w_member_social`.
- Company Page posting requires `w_organization_social` and an eligible approved Page role.
- A successful create returns HTTP 201 and the `x-restli-id` response header containing the post URN.
- Image posts require a separate image upload first to obtain an `urn:li:image:{id}`; then reference that image URN in the Posts API request.
- Read the created post back with `GET /rest/posts/{encodedPostUrn}`. Verify `lifecycleState=PUBLISHED`, `visibility=PUBLIC`, and that `author` exactly matches the intended member or organization URN. Obtain the public permalink from the authoritative profile/Page post listing before recording success.

The Posts API permissions page lists organization roles `ADMINISTRATOR`, `DIRECT_SPONSORED_CONTENT_POSTER` and `CONTENT_ADMIN`; the Organization Access Control role catalogue labels the content role `CONTENT_ADMINISTRATOR`. Treat the actual approved ACL response for the exact organization as authoritative and do not infer eligibility from a display label.

## Independent outbox and receipt requirements

The two tracks must never share:
- OAuth credentials or refresh tokens.
- Author URNs.
- Content records or content hashes.
- Outbox reservations and retry state.
- Publication receipts.

A receipt is complete only after the authoritative read-back confirms the exact author URN and published state and a public permalink is recorded. Store the post URN, author URN, permalink, publication timestamp, content hash and status. If a create request times out, reconcile the author feed before retrying. Never blindly repeat a potentially successful post.

## Official references

- Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-10
- API migrations and active versions: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/migrations?view=li-lms-2026-10
- Organization Access Control by Role: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role?view=li-lms-2026-10
- Share on LinkedIn and `w_member_social`: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin

**Release decision:** keep both LinkedIn tracks blocked until the app, OAuth consent, exact identity, permissions, role and callback are verified. Facebook and Instagram gates remain independent and must not wait for LinkedIn authorization.
# CEO Notes Cloudflare Access Setup

**Purpose:** Enable the private Arabic editorial dashboard without putting a bearer token in the browser.

## Why this is a required gate

The Worker serves the dashboard at `/admin` only when `ctx.access.getIdentity()` returns an authenticated identity. Protected API requests also accept that Access identity. A missing Access identity and missing Bearer credential are rejected.

The Cloudflare account currently reports that Access is not enabled. The Worker is intentionally fail-closed until the account owner enables Zero Trust and the policies below are created.

## 1. Enable Cloudflare Access

1. Open the Cloudflare dashboard for the account that contains the `ceo-notes-ai` Worker.
2. Open **Workers & Pages** and choose the Zero Trust / Cloudflare Access setup flow.
3. Enable Zero Trust / Access for the account.
4. Add or enable the **Cloudflare** identity provider. The account-member policy below requires this identity provider.
5. Do not choose an Everyone policy, a public bypass, or a broad email-domain rule.

Official setup guide: https://developers.cloudflare.com/workers/configuration/cloudflare-access/

## 2. Create two Preview path applications

Create two **Self-hosted** Access applications. Use hostname/path destinations, not Worker-level protection, because public feed, health and image delivery must remain public.

Application A:
- Name: `CEO Notes Preview Admin`
- Destination URI: `https://ceo-notes-ai-preview.yasser-abdelaziz83.workers.dev/admin*`
- Type: `public` destination inside a `self_hosted` application.

Application B:
- Name: `CEO Notes Preview API`
- Destination URI: `https://ceo-notes-ai-preview.yasser-abdelaziz83.workers.dev/api/*`
- Type: `public` destination inside a `self_hosted` application.

For each application, create one Allow policy:
- Include: **Cloudflare account member**, scoped to the account containing this Worker.
- Do not add Everyone, public, email-domain or service-token bypass rules.
- Use a 24-hour session or shorter.
- Select the Cloudflare identity provider only.

Cloudflare documents that self-hosted Access applications can protect a specific hostname or path, including a `workers.dev` hostname, and that the application domain may contain a path:
https://developers.cloudflare.com/workers/configuration/cloudflare-access/
https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/

## 3. Verify Preview

After the two applications exist:

1. Open `https://ceo-notes-ai-preview.yasser-abdelaziz83.workers.dev/admin`.
2. Confirm Cloudflare redirects to its login flow, then the Arabic CEO Notes dashboard loads after account-member authentication.
3. Confirm `/health`, `/feed`, `/notes/posts.json` and `/image/*` remain public and read-only.
4. Confirm a direct unauthenticated POST to `/api/social/publish` is denied.
5. Confirm the dashboard can call `/api/draft/status` through the Access session.

Do not configure a Preview Meta token or run a social publish until a non-public test destination and credentials are independently authorized.

## 4. Production is a later, separate step

Do not create Production Access applications yet. First complete Preview acceptance. After a separate Production deployment approval, create equivalent path applications on the Production Worker hostname:
- `https://ceo-notes-ai.yasser-abdelaziz83.workers.dev/admin*`
- `https://ceo-notes-ai.yasser-abdelaziz83.workers.dev/api/*`

Do not protect the entire Worker because its public read-only feed and image routes must remain accessible.

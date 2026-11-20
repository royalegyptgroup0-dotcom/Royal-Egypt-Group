# CEO Notes Meta App and Credentials Setup

**Status:** Owner authorization required. No Meta token or App Secret is currently configured in Preview or Production.

## 1. Confirm the exact assets first

The Worker pins these identities:
- Facebook CEO Page: `115226621594988`
- Instagram CEO Notes professional account: `17841402949410977`

The Instagram account must be connected to the CEO Facebook Page for the Facebook Login Instagram Graph API flow used by this Worker. If the Page does not report that exact Instagram account under `instagram_business_account`, stop. Do not substitute a different Page or Instagram account. The Instagram Login API is a different integration and is not implemented here.

The current v2 Worker supports only the CEO Facebook Page and the CEO Notes Instagram account. The separate Royal Egypt Properties Facebook Page (`101823889330644`) is also required by the current operations scope, but is not implemented in this Worker yet. It must use a separately pinned destination, independently approved property-audience copy, its own outbox state and authoritative Page read-back. Do not reuse the CEO caption or assume the CEO Page token is authorized for Royal Egypt Properties. Recover the prior Make module-5 wording and mapping before implementing that route.

## 2. Create or select a Meta app

1. Use the Meta developer account that owns or administers the CEO Page and Instagram professional account.
2. Create/select a Business app and configure the Facebook Login / Instagram Graph API products needed for server-side publishing.
3. Complete Business Verification and App Review / Advanced Access if Meta requires them for the permissions below.
4. Enable Meta's **Require App Secret** protection so Graph API calls must include `appsecret_proof`.
5. Keep the App ID and App Secret private; never paste the App Secret or any access token into ChatGPT, GitHub, Make or source code.

Official references:
- https://developers.facebook.com/docs/graph-api/
- https://developers.facebook.com/docs/instagram-platform/content-publishing/
- https://developers.facebook.com/docs/graph-api/reference/page/
- https://developers.facebook.com/docs/graph-api/reference/photo/

## 3. Required credentials and permissions

Configure the following only after Preview Access is enabled:

| Name | Type | Requirement |
|---|---|---|
| `META_APP_ID` | Worker variable | App ID belonging to the Meta app |
| `META_APP_SECRET` | Worker Secret | App Secret for HMAC-SHA256 appsecret_proof |
| `META_FACEBOOK_PAGE_ACCESS_TOKEN` | Worker Secret | Page access token for Page 115226621594988; `pages_manage_posts`, `pages_read_engagement` |
| `META_INSTAGRAM_ACCESS_TOKEN` | Worker Secret | Token authorized for IG account 17841402949410977; `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` |

The Facebook token must be a Page token. The Instagram token may be a user or Page token, but must have the listed permissions. The Worker separately checks the Page token's Page type and the Page-to-Instagram account linkage.

Use a long-lived, server-to-server token strategy where Meta supports it. Avoid short-lived Graph API Explorer tokens for a daily publisher. Review token expiry and data-access expiry; the Worker rejects tokens with less than 24 hours remaining.

## 4. Configure Worker settings securely

For Preview only, after Cloudflare Access is enabled:
- Set `META_APP_ID` as a non-secret Worker variable.
- Set `META_APP_SECRET`, `META_FACEBOOK_PAGE_ACCESS_TOKEN` and `META_INSTAGRAM_ACCESS_TOKEN` as Worker Secrets.
- Never reuse a Production credential in Preview.
- Do not put these values in KV, D1, Git, Make, the browser, or the dashboard.

For Production, do not configure any Meta credential until Preview acceptance and the separate Production deployment approval are complete.

Cloudflare Worker Secrets guide:
https://developers.cloudflare.com/workers/configuration/secrets/

## 5. Verify without publishing

1. Sign in to the Access-protected Preview dashboard.
2. Select **فحص اتصال وصلاحيات Meta**.
3. The Worker calls Meta's debug-token endpoint and checks app ID, token validity, permissions and expiry.
4. It checks the exact Facebook Page ID and the exact Instagram professional account ID, including their linkage.
5. Confirm that the response reports both channels as valid and contains no token values.

This check is read-only. It does not create a post, media container, draft, or outbox reservation.

## 6. Public launch remains separately gated

Do not publish a test post to the real CEO Page or Instagram account. After Preview credentials and read-only checks pass:
1. Review the exact article, image, caption and destination identities.
2. Approve the exact content hash for Facebook and Instagram separately.
3. Publish the first real post only after explicit owner authorization.
4. Read the post/media back from Meta and verify both outbox receipts.
5. Request separate approval before enabling the 19:30 Africa/Cairo Cron schedule.

If a token is rejected, expires, lacks permissions or resolves to a different Page/account, stop. Never fall back to Make, another account, or a different publishing identity automatically.

# CEO Notes — standalone editorial site

This folder is the source of truth for the standalone CEO Notes site at https://ceo-notes.pages.dev/.

## Free-first architecture
- Static editorial UI: `index.html`.
- Public fallback content: `posts.json`.
- Cloudflare Pages Worker source: `_worker.js`.
- The Worker serves the site, proxies the live feed, caches the last successful feed for up to 24 hours, and falls back to the static published-post snapshot if both the live feed and cache are unavailable.
- World clocks use the browser's built-in `Intl.DateTimeFormat` timezone database. They require no external API, key, or subscription.
- No paid analytics, stock-data, translation, image, or automation API is required by the site itself.

## Editorial and publishing flow
The approved sequence is strictly serial:
1. Generate the article and its image.
2. Save/publish the approved article to the CEO Notes website feed first.
3. Publish the same article to the CEO Notes Facebook Page.
4. Only after that succeeds, republish it to Royal Egypt Properties.

The currently active scheduled workflow executes the site-feed step before the two Facebook Page steps, and the second Facebook step follows the first. The workflow must not run the two Facebook publications in parallel.

## Public content rules
- Only approved/published posts may be included in the public feed or fallback snapshot.
- Never expose drafts, reserved posts, private notes, credentials, or customer data.
- Keep the original article and image on CEO Notes; social posts link back to the website.
- If a later social publication fails, retain the website article and record/retry only the failed social step. Do not duplicate a successful post.

## Deployment
- The standalone Pages project is `ceo-notes`, using the `ceo-notes-site` branch.
- Keep the main Royal Egypt Group production branch untouched while developing.
- Deploy the Worker and the HTML/feed snapshot together. Verify the deployment status before calling it live.
- All changes should remain compatible with free Cloudflare Pages/Workers limits. Do not enable paid services or incur usage charges without explicit approval.

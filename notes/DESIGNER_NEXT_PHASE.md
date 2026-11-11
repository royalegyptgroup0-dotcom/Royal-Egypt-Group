# CEO Notes — Designer Next Phase Handoff

**Role:** OpenCode Designer / Senior UX Engineer  
**Project:** CEO Notes standalone editorial site  
**Target:** https://ceo-notes.pages.dev/  
**Base branch:** `ceo-notes-site`  
**Working branch:** `design/ceo-notes-next-phase-2026-11-11`  
**Budget:** $0 recurring and $0 one-time. No paid APIs, libraries, fonts, themes, assets, or hosting.

## Mission

Continue the already-merged editorial redesign. Do not redo the completed redesign. Implement only the missing next-phase experience improvements, with a minimal diff and complete regression protection.

## Verified baseline to preserve

The current `ceo-notes-site` baseline contains:
- 27 published posts (DAY 1–27) in `notes/posts.json`.
- Editorial-first homepage redesign, responsive layout, featured latest post, archive, search, category filters, topic-tag filters, share controls, and About section.
- Stable article URLs at `/post/:day`; the Pages Worker supplies article-specific title, description, canonical URL, Open Graph and Twitter metadata.
- Public `/feed`, `/posts.json`, `/rss.xml`, `/sitemap.xml`, and `/robots.txt` endpoints.
- Market reference data with stale-data labeling and fallback, five world clocks, and the existing radio experience.
- `notes/validate.mjs` checks the published feed, homepage markers, scripts, Worker routes, and radio safety.
- The Worker embeds a copy of the homepage HTML. Keep this copy synchronized with `notes/index.html` whenever HTML changes.

## Protected work — do not regress or rewrite

1. Never edit, reorder, delete, translate in place, or change the status/date/title/body/metadata of any existing record in `notes/posts.json`. All 27 published posts must remain byte-for-byte unchanged.
2. Do not change the publishing sequence, Facebook publishing, Make scenarios, Google Sheets, Worker KV data, backup schedule, account settings, secrets, or credentials.
3. Do not change `notes/radio.js` or `notes/radio.css` unless a demonstrated compatibility issue requires a minimal fix. No autoplay; preserve HTTPS-only playback and user-initiated controls.
4. Preserve all existing URLs and contracts: `/`, `/post/:day`, `/feed`, `/posts.json`, `/markets`, `/rss.xml`, `/sitemap.xml`, `/robots.txt`, `/radio.js`, and `/radio.css`.
5. CEO Notes is a standalone editorial identity. Do not add Royal Egypt Group branding, content, links, credentials, or integrations.
6. Do not publish, merge, deploy to production, change Cloudflare settings, or modify the production feed. Preview-only work.

## Remaining enhancements to implement

### A. Complete language-ready interface
- Add a clear Arabic / English language switch in the header and footer.
- Arabic remains the default and must retain correct RTL layout; English UI must use LTR without mirroring mistakes.
- Preserve the current article URL, selected article, search query, archive filters, and scroll destination when switching languages where practical.
- Translate interface labels, navigation, empty/error/loading states, accessibility labels, and editorial About copy only.
- Do not machine-translate or replace published article text. If no reviewed English translation exists for an article, keep its Arabic original visible and clearly label it as the original Arabic edition.
- Do not add an automatic translation API or external dependency.

### B. Dedicated article reading experience
- Make `/post/:day` a genuine focused reading page, not merely the homepage shell with the archive hidden.
- Render the selected published article's actual content server-side in the Pages Worker response, with safe HTML escaping.
- Include title, category, publication date, reading-time estimate, article text, optional verified image, idea of the day, CEO challenge, discussion question, topic tags, share link, and previous/next article navigation when available.
- Keep the canonical article URL stable and ensure unknown/unpublished days return 404.
- Keep the homepage archive behavior unchanged.

### C. Structured data and sharing
- Add valid JSON-LD `BlogPosting` (or `Article`) structured data for article pages using only actual feed values.
- Include canonical URL, headline, description, datePublished when valid, articleSection when available, and image only when a valid HTTPS image URL exists.
- Keep Open Graph/Twitter metadata accurate and consistent with the rendered article.
- Add breadcrumb structured data only if the visible breadcrumb is implemented.

### D. Archive usability
- Add accessible pagination or progressive “Load more” behavior if the archive is long; preserve search, category, and tag filtering.
- Do not hide older posts from search results or break direct article links.
- Show clear result counts and empty states; keyboard and screen-reader users must be able to operate the controls.
- Keep the featured latest issue and editorial hierarchy.

### E. Accessibility and responsive QA
- Check keyboard navigation, visible focus, landmarks, heading order, link purpose, contrast, form labels, reduced-motion preferences, and screen-reader announcements.
- Test at 360, 390, 768, 1024, and 1440 CSS pixels.
- Prevent horizontal overflow and ensure the language switch, archive controls, and article navigation work on small screens.
- Avoid external assets and JavaScript dependencies.

## Engineering rules

- Read the current files and tests before editing.
- Keep changes restricted to `notes/` and the smallest necessary test/documentation changes.
- Update both `notes/index.html` and the embedded HTML in `notes/_worker.js` consistently; do not accidentally change Worker feed/market/radio routes.
- Add regression tests for each new behavior. Extend `notes/validate.mjs` or add focused tests without weakening existing assertions.
- Verify all 27 feed records remain unchanged by comparing the baseline feed SHA/content or a canonical JSON digest before and after.
- Run the complete available test suite and syntax checks. Do not claim browser/device visual QA unless actually performed.
- Use semantic HTML, progressive enhancement, safe DOM APIs, and safe HTML escaping. Never interpolate article text into HTML without escaping.
- No package/dependency additions unless essential and explicitly justified.

## Acceptance criteria

- All 27 existing published posts are unchanged and still served.
- Every existing endpoint and article URL still works.
- Arabic remains the default; the language switch changes UI direction and labels without corrupting article content or URL state.
- Article pages contain the actual article body in the server response and valid article metadata/JSON-LD.
- Archive pagination/load-more composes correctly with search/category/tag filters.
- Homepage and Worker embedded HTML remain synchronized.
- All existing tests pass; new tests cover the new behavior.
- No production data, secrets, publishing automation, Facebook posts, Royal Egypt assets, or production deployment are touched.

## Deliverables

1. Minimal implementation on this branch only.
2. Tests and a concise verification report with commands and exact outcomes.
3. A file-by-file change summary and any remaining blockers.
4. A draft PR targeting `ceo-notes-site` only after tests pass. Keep it Draft. Do not merge or deploy production.

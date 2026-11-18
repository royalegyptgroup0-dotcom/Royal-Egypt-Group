# CEO Notes Publishing Acceptance Matrix

**Snapshot:** 2026-11-18, after the 19:30 Africa/Cairo publishing window  
**Overall status:** PARTIALLY WORKING / NOT READY FOR PUBLICATION  
**Production runtime:** Make scenario `8438190`, paused. PR #82 is an isolated Preview implementation proposal, not an approved Production runtime replacement.  
**Current staged implementation:** [Draft PR #82](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/pull/82), base `ceo-notes-site`. No merge or Production deployment.

## Target identities and content boundaries

| Sequence | Target | Identity | Allowed content | Current status |
|---:|---|---|---|---|
| 1 | Facebook CEO Page | `115226621594988` | CEO Notes editorial copy | BLOCKED: no verified new post ID/permalink or receipt; Production Worker has no `ADMIN_TOKEN` or Meta credentials |
| 2 | Facebook Royal Egypt Properties Page | `101823889330644` | Separate property-audience adaptation only; never a verbatim CEO Notes cross-post | BLOCKED: current Make blueprint has no publisher module; prior module-5 copy/mapping was not recoverable from available execution history; PR82 has no adapter |
| 3 | Instagram CEO Notes | `@kiritoon` / `17841402949410977` | CEO Notes editorial copy | BLOCKED: Make connection is authorized, but current scenario has no Instagram module and Production Worker has no Meta credentials |
| 4 | LinkedIn personal profile | Exact member URL not independently verified | CEO Notes-native adaptation | BLOCKED: no official Developer App/OAuth consent or `w_member_social` grant |
| 5 | LinkedIn Company Page | Royal Egypt Group; exact public URL/URN not verified | Corporate content from verified company facts only; never CEO Notes articles | BLOCKED: no exact Page URL/URN, `w_organization_social` grant or verified eligible Page role |

No other Facebook Page, Instagram account or LinkedIn Page is authorized by this matrix. Do not send CEO Notes content to the Royal Egypt Group LinkedIn Company Page or the Royal Egypt Properties Instagram account.

## End-to-end acceptance

| Acceptance area | Status | Evidence and limitation |
|---|---|---|
| Editorial generation, uniqueness and quality | NOT RUN live | No new AI article was generated. No DAY 28 draft was created. Isolated Worker tests pass, but Preview intentionally has no AI binding and Production generation was not called. |
| Image generation | NOT RUN live | No new image was generated. Existing media DAY 26 and DAY 27 returned HTTP 200 with JPEG content type in Site Checks run [44381797618](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/44381797618). |
| Canonical feed save and website visibility | VERIFIED for the existing feed only | Live Production KV contains 27 Published posts, DAY 1–27, with unique days. The normalized feed SHA-256 is `d1765993cfa74f9e806103e0c9f1cdd022ab27ec0d482d6e2e73a9d2ef4546db`, matching the 2026-11-18 backup manifest and backup feed. A fresh field-level comparison against the GitHub fallback returned no differences. A prior 2026-11-17 read reported content differences; the discrepancy is not present in this snapshot and its cause is unknown. No feed write was made. |
| SEO article route, RSS, sitemap, canonical and social metadata | PARTIALLY VERIFIED | Site Checks run [44381797618](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/44381797618) passed live HTTP checks for `/`, `/feed`, `/posts.json`, `/rss.xml`, `/sitemap.xml`, `/robots.txt`, `/markets`, `/post/27`, and JPEG media `/image/26` and `/image/27`. The article HTML assertions include canonical, `og:title` and `og:image`. This is route/HTML smoke evidence, not a full visual browser test. Production Pages still serves deployment `deae9a2e-5333-49ed-8fde-2df3ff1e989a` from 2026-11-10 commit `50d9c9f8a7002cf16bbdf85bca4f1b6915852cef`; later branch fixes are not confirmed deployed. |
| Facebook CEO Page publication | BLOCKED | No new platform post ID, public permalink or durable receipt. Facebook connection `12773774` is healthy, and Make HTTP API-key connection `12949158` is authorized, but Production Worker secret inventory is empty and no protected route was called. |
| Facebook Royal Egypt Properties publication | BLOCKED | The current Make blueprint contains no Royal Egypt Properties module or independent receipt. Available history does not contain the old module-5 audience copy/mapping. Do not reconstruct the wording from guesswork. |
| Instagram `@kiritoon` publication | BLOCKED | Make connection `12948176` is authorized and the account identity was resolved, but no Instagram module exists in the current Make scenario. Production Worker has no Meta credentials and no public post/receipt was verified. |
| LinkedIn personal profile publication | BLOCKED | No official OAuth consent, verified member identity or `w_member_social` grant. Use LinkedIn's official OAuth and Posts API only. |
| LinkedIn Company Page publication | BLOCKED | No verified Company Page URL/URN, `w_organization_social` grant or eligible Page role. Keep this corporate track separate from CEO Notes. |
| Receipts, idempotency and partial-failure recovery | VERIFIED in isolated tests only | PR82 Worker Tests run [44381840904](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/44381840904) passed **49/49** tests, including approval-schedule bypass rejection, full KV pagination and restore-target pagination. The latest PR source is deployed to isolated Preview version 9. No Production outbox or receipts exist; authenticated live Preview restore/Meta tests remain NOT RUN because Preview has no Access policy or secrets. |
| Backups and recovery | VERIFIED for current backup integrity; restore rehearsal PARTIALLY VERIFIED | Production backup manifest `backup:2026-11-18:manifest` was created at `2026-11-18T02:00:12.797Z`, version 1. Its feed hash matches the normalized live KV feed. Actual image values `image:26` and `image:27` match the manifest and backup copies by length and SHA-256. Preview restore behavior is covered by isolated tests; an authenticated live Preview restore rehearsal has not been run. |
| Schedule, monitoring and cost | BLOCKED for publishing; backup monitoring VERIFIED | Make scenario `8438190` remains paused with its daily 19:30 schedule configured and no next run while paused. Production Worker Cron remains backup-only at `0 2 * * *` (02:00 UTC); Preview has no Cron. Make usage reads 11 credits for the current period, with no new execution this run. No AI call, social publication, paid connector, R2 or billing change occurred. Workers AI token/quota counters were not exposed by the available read. |

## Current system facts

### Make

- Scenario `8438190` is paused and has four modules in its current blueprint: article generation (HTTP POST), image generation (HTTP GET with eight query parameters), feed save/publish (HTTP POST), and Facebook CEO Page publication.
- Modules 1, 2 and 4 use authorized HTTP API-key connection `12949158`; the Facebook module uses healthy connection `12773774`.
- The current blueprint has no Royal Egypt Properties publisher, Instagram publisher or independent receipt module. The Facebook module targets only the CEO Page.
- Execution history contains no run after 2026-11-07. The last success was `84418ff10ab842c4a8a6093afa5f859b` (4 operations, 4 credits); it does not establish a public post ID/permalink or full two-page receipt.
- The old module-5 audience copy could not be recovered from available Make execution history. No scenario run was started during this review.

### Cloudflare

- Production Worker `ceo-notes-ai`: only AI and Production KV bindings; secret inventory empty, including no `ADMIN_TOKEN`; Cron remains backup-only. No Production Worker deployment was made.
- Isolated Preview Worker `ceo-notes-ai-preview`: version 9 `290d02de-8b60-42a3-809f-d37005c7b9fe`, deployment `6b30a443-c4ee-4c5a-9593-c70ce4db6426`, 100% traffic, source commit `196dcb60bd4efdf2c5e95dd24c57921fb36c486b`. The existing isolated KV and SQLite Durable Object namespaces were preserved. `PUBLIC_BASE` matches `wrangler.preview.jsonc`; Preview has `PREVIEW_MODE=true`, no secrets, no AI binding and no Cron.
- Cloudflare Access is not enabled/configured for the account. Preview authenticated dashboard, restore and Meta checks remain blocked.
- Canonical Pages project `ceo-notes` remains on production branch `ceo-notes-site`. Latest production deployment is `deae9a2e-5333-49ed-8fde-2df3ff1e989a`, commit `50d9c9f8a7002cf16bbdf85bca4f1b6915852cef`, 2026-11-10. No Pages deployment was made.

### GitHub and CI

- PR #82 remains Draft and unmerged, base `ceo-notes-site`. The latest Worker source commit is `196dcb60bd4efdf2c5e95dd24c57921fb36c486b`; later changes on the same isolated branch are test/documentation hardening only.
- Worker Tests run [44381840904](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/44381840904): **49/49 passed**; live Preview `/health` returned HTTP 200, KV and Durable Object were ready, AI remained absent, and unauthenticated API/dashboard gates failed closed as expected against Preview version 9.
- Site Checks run [44381797618](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/44381797618): passed, including Worker tests 49/49, live Production route/media smoke checks, generated Worker synchronization, metadata assertions and offline archive-importer tests (5/5).
- Date-sensitive scheduling fixtures were changed to derive future Cairo dates and UTC offsets dynamically, preventing daily test failures after the 19:30 window.
- PR #54 remains a planning Draft, not a LinkedIn integration or publication.

## Required owner actions

1. **Production authentication:** securely set/confirm the Production Worker `ADMIN_TOKEN` to match the value already stored in Make API-key connection `12949158`. Use Cloudflare/Make secret managers only; never paste the value into chat. Until read-back confirms both sides, do not call protected endpoints or activate Make.
2. **Royal Egypt Properties copy:** recover or provide the exact approved module-5 audience-specific wording and mapping. The current execution history does not contain it.
3. **First controlled publication:** approve the exact new article/content hash and target list before generating or publishing a new item. No DAY 28 was created or published.
4. **LinkedIn:** confirm the exact personal member URL and Royal Egypt Group Company Page URL/URN, then complete separate official OAuth grants and verify the Company Page role.

No public social post, Production deployment, merge, schedule activation, Make retirement or historical-feed rewrite was performed in this snapshot.

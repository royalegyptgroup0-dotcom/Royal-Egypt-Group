# CEO Notes Publishing Acceptance Matrix

**Snapshot:** 2026-11-27, after the 19:30 Africa/Cairo window  
**Overall:** PARTIALLY WORKING / NOT READY FOR PUBLICATION  
**Production runtime:** Make scenario `8438190`, paused. No Production runtime switch, first public post, or publishing schedule activation is approved.  
**Repository boundary:** `ceo-notes-site` only. Never merge CEO Notes work into `main`. PR #82 (Cloudflare-native) and PR #83 (legacy Make/Worker hardening) are alternative Production paths; do not deploy both.

## 1. Authorized identities and content boundaries

| Target | Identity | Allowed content | Current status |
|---|---|---|---|
| Facebook CEO Page | `115226621594988` | CEO Notes editorial copy | **BLOCKED**: healthy Make connection, but no current verified post ID, public permalink, or durable receipt |
| Facebook Royal Egypt Properties | `101823889330644` | Separate property-audience adaptation only; never a verbatim CEO Notes cross-post | **BLOCKED**: no publisher in the current blueprint; prior copy/mapping is not recoverable |
| Instagram CEO Notes | `@kiritoon` / `17841402949410977` | CEO Notes editorial copy | **BLOCKED**: Make connection `12948176` is authorized, but no module in scenario `8438190` and no Production Meta credentials |
| Instagram Royal Egypt Properties | `@royalegyptrep` / `17841459689466633` | Separate approved real-estate/corporate content only | **NOT A CEO NOTES DESTINATION**; do not cross-post CEO Notes editorial content |
| LinkedIn personal profile | Exact member identity/URN still unverified | Approved CEO Notes adaptation | **BLOCKED**: no official OAuth consent, verified member URN, or `w_member_social` grant |
| LinkedIn Company Page | Royal Egypt Group; exact Page URL/organization URN still unverified | Corporate content based only on verified company facts | **BLOCKED**: no exact URL/URN, `w_organization_social` grant, or verified eligible Page role |

PR #54 remains planning material, not an integration or publication record. Do not infer a LinkedIn identity from a display name or guessed URL.

## 2. End-to-end acceptance matrix

| Area | Status | Evidence and exact limitation |
|---|---|---|
| Editorial generation, uniqueness, quality | **NOT RUN live** | No new AI article or DAY 28 draft was generated. PR #82 tests use a stubbed AI binding; they do not prove a live generation call. |
| New image generation | **NOT RUN live** | No new image was generated. Existing DAY 26/27 images are present in Production KV and returned HTTP 200 with JPEG content type in Site Checks run [45684076693](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/45684076693). PR #83 synthetic image POST/legacy GET tests passed 7/7; no live AI call occurred. |
| Canonical feed and existing website visibility | **VERIFIED for existing content only** | Production KV contains 27 posts, DAY 1–27, with no missing or duplicate day numbers. Latest `publishedAt` is `2026-11-07T21:42:03.981Z`. There are zero social receipts. DAY 18 has no `publishedAt`; DAY 25 has a date-only value. Imported DAY 1–24 lack `ideaOfTheDay`, `ceoChallenge`, and `discussionQuestion`; historical posts were not rewritten. |
| Article route, RSS, sitemap, canonical and social metadata | **VERIFIED by CI HTTP/HTML smoke; visual browser NOT RUN** | Site Checks run [45684076693](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/45684076693) returned HTTP 200 for `/`, `/feed`, `/posts.json`, `/rss.xml`, `/sitemap.xml`, `/robots.txt`, `/markets`, `/post/27`, `/image/26`, and `/image/27`. Canonical, `og:title`, and `og:image` assertions passed. This is not a full visual browser test. Production Pages is still deployment `deae9a2e-5333-49ed-8fde-2df3ff1e989a`, commit `50d9c9f8a7002cf16bbdf85bca4f1b6915852cef`, from 10 Nov. PR #62 is merged to `ceo-notes-site`, but its merged fix is not in that Production deployment. |
| Facebook CEO Page publication | **BLOCKED** | Facebook connection `12773774` is healthy. Last Make success is `84418ff10ab842c4a8a6093afa5f859b` (7 Nov, 4 operations); stored module outputs are unavailable, so no post ID, permalink, or receipt can be verified. |
| Facebook Royal Egypt Properties publication | **BLOCKED** | Current Make blueprint has no publisher module. The former module-5 copy/mapping is not recoverable. A separate property-audience caption/template and content hash must be approved; do not reconstruct it from CEO Notes text. |
| Instagram `@kiritoon` publication | **BLOCKED** | Connection `12948176` is authorized with `instagram_content_publish`, and the account identity was resolved. Scenario `8438190` has no Instagram module; Production has no Meta publishing credentials. PR #82 has synthetic support for this pinned CEO account only. |
| LinkedIn personal profile publication | **BLOCKED** | No Developer App/OAuth consent, verified member URN, callback implementation, or `w_member_social` grant. PR #54 is planning only. |
| LinkedIn Company Page publication | **BLOCKED** | No exact Company Page URL/URN, `w_organization_social` grant, or eligible Page role. Keep this corporate track's credentials, outbox, and receipts separate from the personal profile. |
| Receipts, idempotency, partial-failure recovery and duplicate prevention | **BLOCKED in Production; VERIFIED in synthetic tests** | Production has no Durable Object outbox and the live feed has zero social receipts. PR #82 Worker Tests run [45684076923](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/45684076923) passed **51/51**. Tests cover per-target state, ambiguous-outcome blocking, concurrency, backup/restore, pagination, and fail-closed restore behavior. Preview health and unauthenticated access gates passed; authenticated restore was not run. |
| Backups and recovery | **VERIFIED for backup creation/integrity; authenticated restore NOT RUN** | Production manifest `backup:2026-11-27:manifest` was created at `2026-11-27T02:00:12.000Z`. The backup feed SHA-256 `d1765993cfa74f9e806103e0c9f1cdd022ab27ec0d482d6e2e73a9d2ef4546db` matches the manifest; parsed backup JSON equals the live feed. DAY 26/27 image lengths and SHA-256 values match their backup copies and manifest. Production backup Cron is `0 2 * * *` UTC. No authenticated restore was attempted. |
| Schedule, automation health and cost | **BLOCKED for publishing; backup Cron VERIFIED** | Make scenario `8438190` is paused with daily 19:30 configured and no next scheduled execution. Make organization `9505709` is Free and account-paused: 525/1,000 operations used, 475 remaining, 7.6 MB transferred, unused centicredits `-255`, automatic purchasing disabled, next reset 2 Dec 2026. Production Worker has backup Cron only; no publishing Cron. No AI generation or paid service was called. |

## 3. Current Production facts

### Make

- Scenario `8438190` is paused, last edited `2026-11-14T20:18:00.041Z`. Trigger remains daily at 19:30; no next scheduled execution exists while paused.
- Current blueprint contains only four modules: 1 Generate (HTTP POST), 2 Image (HTTP GET with eight query parameters), 4 Save feed (HTTP POST JSON), and 3 Facebook CEO Page. Modules 5 and 6 are absent; no Royal Egypt Properties publisher or independent receipt exists.
- HTTP API-key connection request `25d6a623-e684-4ee2-aa85-740fe4a9a1a5` is now **authorized** as connection `12949158`, and that connection is selected in modules 1, 2, and 4. Facebook connection `12773774` reports healthy. This does not solve the missing Production Worker `ADMIN_TOKEN`.
- Module 2 remains a state-changing GET. PR #83 adds authenticated POST JSON support in source while retaining GET compatibility, but that source is not deployed. Do not change module 2 before a dedicated legacy Preview test and separate Production approval.
- No Make execution occurred after 7 Nov. The last success used four operations and has no retrievable post receipt. The two earlier failures are not publication evidence.
- Instagram connection `12948176` is authorized, but it is not used by scenario `8438190`.

### Cloudflare Workers

- Production Worker `ceo-notes-ai` latest deployment is `5c1e0751-2183-492a-8685-31a29396bd83`, created 21 Nov; version `ea0b469e-0517-4c17-85f2-4004ba6f464a`.
- Production bindings are Workers AI and the Production feed KV. The only secret name returned is `LEGACY_ROUTE_SUFFIX`; **`ADMIN_TOKEN` is absent**. The deployed source checks Bearer `ADMIN_TOKEN` and does not consume the newly staged `LEGACY_ROUTE_SUFFIX` secret. Secret values were not read or exposed.
- Production Cron remains backup-only at `0 2 * * *` UTC. No publishing Cron or Production Durable Object outbox is configured.
- Isolated Preview Worker `ceo-notes-ai-preview` is version 12, `b52705fb-4496-4a53-a9de-5ad3d8ba641f`, deployment `4f59947a-28e6-4e69-aefb-e233aff7e72a`, 100% traffic. Its deployed `worker-v2.js` and test file match the current PR #82 branch by blob SHA. It has a dedicated KV namespace and SQLite Durable Object namespace, but no AI binding, no secrets, and no Cron. Preview health and unauthenticated access gates passed in run [45684076923](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/45684076923). Authenticated restore remains NOT RUN.
- Cloudflare Access is still not enabled; the Access API returned `access.api.error.not_enabled`. Do not enable a paid feature or broaden an Access policy without approval.

### Cloudflare Pages

- Canonical project `ceo-notes` is in the legacy account and uses production branch `ceo-notes-site`.
- Latest Production deployment remains `deae9a2e-5333-49ed-8fde-2df3ff1e989a`, commit `50d9c9f8a7002cf16bbdf85bca4f1b6915852cef`, created 10 Nov.
- Canonical Pages Preview history has no PR #82 branch deployment. The Cloudflare Pages branch-preview comment attached to PR #82 points to the separate `royalegyptgroup` project/account, not the canonical `ceo-notes` project; do not count it as CEO Notes Preview validation.

## 4. GitHub engineering state

- [PR #82](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/pull/82) remains open/Draft, targets `ceo-notes-site`, current head `0cc7f955ed18da56013612659bd5e234f6ea1f53`. Worker Tests run #188 ([45684076923](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/45684076923)) passed 51/51; Site Checks run #268 ([45684076693](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/45684076693)) passed. The Preview Worker source currently deployed is commit `1a1899dfa47f8733e191cbccf4f7e01681f4be63`, and its Worker source/test blobs match the current PR branch. PR #82 supports Facebook CEO Page and Instagram CEO only; it does not implement Facebook Royal Egypt Properties or either LinkedIn track.
- [PR #83](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/pull/83) remains open/Draft, head `b1c6a69b55fa9a055a3ffb9eea91025d874765d2`. CI run #252 ([44940965081](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/44940965081)) passed 7/7 legacy Worker tests and 5/5 archive-importer tests. It is source-only and has no dedicated legacy Preview Worker. Do not merge/deploy until its isolated authenticated POST path is tested.
- [PR #84](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/pull/84) remains Draft and removes an unverified personal LinkedIn follow link from both HTML copies; no Production deployment occurred.
- [PR #54](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/pull/54) remains planning material only.
- [PR #62](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/pull/62) is merged to `ceo-notes-site` at merge commit `35dddfb706dcd5b25fde2cc251bc4369ccdfea9c`; the Production Pages deployment has not advanced to it.

## 5. Owner-only gates

1. **Choose the Production runtime path:** retain Make + the legacy Worker (PR #83 path), or separately approve the Cloudflare-native PR #82 path. They are alternatives, not simultaneous Production deployments.
2. **Authentication:** before any protected legacy route is called, configure `ADMIN_TOKEN` securely on a dedicated isolated legacy Preview Worker to match the authorized Make keychain. Production `ADMIN_TOKEN` and any Production deployment require separate approval. Never paste the value into chat.
3. **Make account pause:** resolve the account-level Free-plan pause through Make account controls. Do not upgrade, top up, or enable automatic purchasing.
4. **Royal Egypt Properties Facebook:** approve a distinct property-audience adaptation/template and exact content hash. The old module mapping is not recoverable.
5. **LinkedIn:** configure the official Developer App/OAuth, verify the personal member identity and Company Page URL/organization URN, grant the required scopes, and verify the eligible Page role. Do not guess a callback URL.
6. **First controlled publication:** approve the exact new article/content hash and destination list before any public post. No DAY 28 was created or published.

No Production Worker/Pages deployment, merge, Make activation, schedule activation, protected Production route call, AI generation, new image, historical feed rewrite, public social post, credential rotation, or billing change occurred in this snapshot.

**Public post URLs:** none verified.  
**Durable social receipts:** none.

# CEO Notes Publishing Acceptance Matrix

**Snapshot:** 2026-11-15, after the 19:30 Africa/Cairo publishing window  
**Overall status:** PARTIALLY WORKING / NOT READY FOR PUBLICATION  
**Current staged implementation:** [Draft PR #82](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/pull/82), base `ceo-notes-site`. No merge or Production deployment.

## Target identities and content boundaries

| Sequence | Target | Identity | Allowed content | Current status |
|---:|---|---|---|---|
| 1 | Facebook CEO Page | `115226621594988` | CEO Notes editorial copy | BLOCKED: no Worker Meta credentials, no Production outbox or verified receipt |
| 2 | Facebook Royal Egypt Properties Page | `101823889330644` | Separate property-audience adaptation only; never a verbatim CEO Notes cross-post | BLOCKED: publisher module and exact prior wording/mapping are missing; PR82 has no adapter |
| 3 | Instagram CEO Notes | `@kiritoon` / `17841402949410977` | CEO Notes editorial copy | BLOCKED: Make connection authorized, but Worker Meta credentials and Production outbox are absent |
| 4 | LinkedIn personal profile | URL recorded in PR #54; not independently verified | CEO Notes-native adaptation | BLOCKED: no Developer App, OAuth consent or `w_member_social` grant |
| 5 | LinkedIn Company Page | Royal Egypt Group; exact public URL/URN not verified | Corporate content from verified company facts only; never CEO Notes articles | BLOCKED: no exact Page URL/URN, OAuth grant, `w_organization_social` or verified Page role |

No other Facebook Page, Instagram account or LinkedIn Page is authorized by this matrix. In particular, do not send CEO Notes content to the Royal Egypt Group LinkedIn Company Page or the Royal Egypt Properties Instagram account.

## End-to-end acceptance

| Acceptance area | Status | Evidence and limitation |
|---|---|---|
| Editorial generation, uniqueness and quality | NOT RUN live | PR82 isolated tests pass; no live AI generation this run. Preview intentionally has no AI binding and Production remains on the older Worker. |
| Image generation | NOT RUN live | Unit tests pass. Existing production JPEGs DAY 26 and DAY 27 were HTTP 200 in the live-site smoke run. No new image was generated. |
| Canonical feed save and website visibility | VERIFIED for existing feed | Production KV has 27 Published posts, DAY 1-27, unique days. No new feed write was attempted. |
| SEO route, RSS, sitemap, canonical and social metadata | VERIFIED for tested subset | Live-site CI run [43750692856](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/43750692856) passed route and HTML metadata assertions. This is HTTP/HTML smoke evidence, not a full visual browser test. |
| Facebook CEO Page publication | BLOCKED | No new post ID, permalink or durable receipt. Worker Meta token absent. |
| Facebook Royal Egypt Properties publication | BLOCKED | Current Make scenario has no REP module; exact former module-5 audience copy and mapping were not preserved. PR82 does not support this identity. |
| Instagram @kiritoon publication | BLOCKED | Account/Make connection was previously authorized, but no Worker token, controlled publication or receipt exists. |
| LinkedIn personal publication | BLOCKED | No official OAuth grant or Developer App. Use only LinkedIn's official OAuth and Posts API. |
| LinkedIn Company Page publication | BLOCKED | No verified Company Page URL/URN, approved organization permission or Page role. Keep corporate copy separate from CEO Notes. |
| Receipts, idempotency, partial-failure recovery | VERIFIED in isolated tests only | PR82 tests cover the SQLite Durable Object outbox, server-side Meta read-back and unknown-outcome blocking. Production has no v2 Durable Object binding or receipts. |
| Backup and recovery | PARTIALLY VERIFIED | Production backup manifest v1 (2026-11-15 02:00:12 UTC): feed SHA-256 and image:26/image:27 checksums match; backup feed is structurally identical to live feed. It does not include image metadata, drafts or outbox. Live Preview restore rehearsal NOT RUN. |
| Schedule and monitoring | BLOCKED for publishing | Make scenario 8438190 remains paused at daily 19:30 Africa/Cairo. Production Worker Cron is backup-only at 02:00 UTC. Preview has no Cron. |
| Cost and quota | VERIFIED no new paid activity | No AI generation, social publish, paid connector, R2 or billing change was performed. Remaining platform quota counters were not exposed by the available reads. |

## Current system facts

- Make scenario `8438190` is paused. Modules 1 and 4 are POST but still target legacy routes; module 2 is GET with eight query parameters and must become POST JSON. Modules 1, 2 and 4 use authorized HTTP API-key connection `12949158`, but the Production Worker has no matching `ADMIN_TOKEN` secret. No protected route was called.
- Current scenario module 3 publishes only to the CEO Facebook Page. The former Royal Egypt Properties module 5 and combined receipt module 6 are absent. Do not reconstruct their copy or mapping from guesswork.
- Facebook connection `12773774` is healthy; Instagram for Business connection `12948176` is authorized. Connection health is not publication evidence.
- Production Worker `ceo-notes-ai`: AI + Production KV, backup Cron `0 2 * * *`, no Durable Object binding and no Worker Secrets.
- Preview Worker `ceo-notes-ai-preview`: isolated KV and SQLite Durable Object, `PREVIEW_MODE=true`, no AI, no Cron and no secrets. Preview deployment: `d3a788c2-d213-499f-a239-5812bcdf0052`.
- Cloudflare Access is not enabled/configured for Preview. Protected API and dashboard access remain fail-closed.
- Worker CI run [43750692781](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/43750692781) passed; PR #82 records 46/46 isolated tests plus live Preview health/auth smoke.
- Live site run [43750692856](https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/actions/runs/43750692856) passed. Canonical Pages production deployment remains commit `50d9c9f8a7002cf16bbdf85bca4f1b6915852cef`, deployment `deae9a2e-5333-49ed-8fde-2df3ff1e989a`.

## Required owner actions

See [the prepared LinkedIn OAuth connection request](./LINKEDIN_OAUTH_CONNECTION_REQUEST.md) for the exact two-track Developer App, scope, identity, callback and receipt requirements.

1. Enable Cloudflare Zero Trust/Access and create owner-only policies for Preview `/admin*` and `/api/*`. Do not use Everyone or a broad domain policy.
2. After Access is ready, configure the Preview Meta app ID, App Secret and CEO Page/Instagram credentials as Worker variables/secrets, then run the read-only Meta verification. Never paste credentials into chat.
3. Recover the original Royal Egypt Properties Make module-5 audience wording and mapping from Make history or provide the exact approved adaptation. It must become an independent target with its own outbox and receipt.
4. For LinkedIn personal: create/select the Developer App, enable Share on LinkedIn, grant `w_member_social` through official OAuth and verify the member identity.
5. For LinkedIn Company Page: provide/verify the exact public Page URL and organization URN, obtain `w_organization_social`, and verify an approved Page role through `/rest/organizationAcls`.

No public publication, Production deployment, merge, schedule activation or Make retirement is authorized by this matrix alone.
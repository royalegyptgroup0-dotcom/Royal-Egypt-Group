# Royal Egypt Group — Persistent Project Context

Last reviewed: 2026-11-15
Purpose: provide OpenCode (including its Mobile client when connected to this repository's Windows OpenCode workspace) with stable project facts so tasks do not restart with repetitive project-intake questions.

## 1. Identity and boundaries

- Parent project: Royal Egypt Group.
- Business structure: Royal Egypt Group → Royal Egypt Properties + Royal Egypt Coffee + Royal Egypt Transportation.
- Formal Arabic real-estate company name previously used: شركة رويال ايجبت للتسويق العقاري.
- GitHub repository used for current work: `royalegyptgroup0-dotcom/Royal-Egypt-Group`.
- Production website: `https://royalegyptgroup.pages.dev`.
- Historical local Windows checkout recorded by the owner: `C:\Users\yasse\Desktop\royalegyptgroup.pages.dev`.
- Intended custom domain `royalegyptgroup.com` has not been confirmed as active; do not assume it is configured.
- Keep this group project separate from OCTOPUSA, RoyalMediaPlayer, Painty Creator, and the standalone CEO Notes editorial/social project. Similar branding or shared hosting does not authorize mixing code, credentials, audiences, or automations.

## 2. Business functionality and truthfulness

- Royal Egypt Properties is the real-estate platform branch and is the first monetization priority.
- The property catalogue is not a live inventory feed. Treat each listing as an enquiry lead until availability, price, legal status, boundaries, permitted use, and payment terms are independently confirmed.
- Known catalogue examples in project notes: Hurghada / Al Ahyaa 4,000 m² land; Stella di Mare / Zafarana-Ain Sokhna furnished 110 m² villa; Suez / Nasser Street administrative space and garage. Do not expose or infer private lead/customer details.
- Coffee and Transportation pages are introductory information pages, not active e-commerce or booking systems unless code and operational evidence prove otherwise.
- Existing website enquiry flows must not be described as automatic customer messaging. A prefilled WhatsApp draft requires the visitor to review and send it.

## 3. Architecture and infrastructure

- Cloudflare Pages hosts the static group website.
- Historical Pages project name: `royalegyptgroup`; production branch is `main`; framework preset None; build command empty; output directory repository root.
- Cloudflare D1 production binding previously recorded as `DB` → `royal-eg-listings`. This is production data: do not query, migrate, seed, or mutate it without exact explicit authorization.
- Historical secret name `ADMIN_TOKEN` exists in Worker/Pages contexts. Never reveal or request its value. Verify presence only when authorized.
- Workers AI binding `AI` was previously reported enabled, but re-check live configuration before relying on it.
- R2 was intentionally not enabled because it would require paid/card setup. Do not enable it without approval.
- Use the repository's current config and live platform evidence over historical notes whenever they differ.

## 4. Separate CEO Notes worker and publishing constraints

CEO Notes is a separate editorial/social project, even though worker source may live in this repository. Never conflate CEO Notes identity with Royal Egypt Group's property customers or business pages.

Known Worker area: `workers/ceo-notes-ai/`.
- `worker-v2.js` is staged Outbox implementation.
- `worker-v2.test.mjs` contains Node tests.
- `wrangler.preview.jsonc` is intended as isolated preview config with a dedicated preview KV namespace, `PREVIEW_MODE=true`, no AI binding, and no cron.
- `OUTBOX_COORDINATOR` is a SQLite-backed Durable Object binding required by staged v2.
- Preview must use only its dedicated KV namespace and a separate preview-only `ADMIN_TOKEN`; never reuse production token or production KV.
- Worker protected API routes require Bearer auth. Public feed/image reads are separate.
- A receipt is not proof of publication. Final verification requires authoritative platform lookup and a matching attestation; Make must perform the platform read-back before calling verify.
- Supported CEO Notes identities noted in Worker docs are Facebook `ceo-page` and Instagram `ceo-notes`. Corporate Royal Egypt Properties identities must be rejected.
- No Facebook publishing cron should be enabled until the end-to-end publishing, idempotency, receipt verification, recovery, and backup/restore gates pass.
- Do not activate Make publishing scenarios, publish posts, generate billable content, or send messages unless explicitly authorized.

## 5. Known Make automation state (snapshot, 2026-11-15)

These are last-known observations, not a guarantee of current live state. Re-fetch scenario details before any edit.

- Team ID: `3460199`.
- `8423033` — CEO Notes | Concurrency Lab — Webhook Probe. Status Error. Last known validation failure: one configuration problem before modules execute. Google Sheets connection showed OK. No confirmed exact invalid field has been isolated. Do not guess a full module mapping or activate it. A no-op name operation did not change its state or last-edit timestamp.
- `8333266` — Daily CEO Notes | Royal Egypt. Status Error. Last known failure involved exhausted OpenAI API credits / API authorization. Do not buy credits, alter billing, or change secrets.
- `8438190` — CEO Notes | AI Editorial + Image + Facebook + Live Feed. Last known Paused.
- `8419318` — CEO Notes | Daily Publisher 19:30. Last known Paused.
- `8413166` — Royal Egypt Cloudflare Read-Only Audit. Last known Paused.
- `8413745` — Royal Egypt Save Project Audit Report. Last known Paused.
- Publishing must remain stopped unless the owner explicitly changes this instruction. Never send customer messages or publish externally during repair/testing.

## 6. Current GitHub work (snapshot, 2026-11-15)

- PR #77 is a Draft Outbox Coordinator feature PR. It has incomplete gates, including separate preview secret/config verification, complete Make POST integration, authoritative receipt verification, idempotency, backup/restore, and preview live health. Do not merge.
- PR #78 is a Draft CI gate PR: `https://github.com/royalegyptgroup0-dotcom/Royal-Egypt-Group/pull/78`. It adds `.github/workflows/ceo-notes-worker-tests.yml`, using Node.js 22, `node --check`, and `node --test`, with `contents: read` and checkout credentials not persisted.
- Commit `b4ae36a523a058d950cae2652092841686fe8baf` had a successful GitHub Actions run (run ID `43702473109`) and Cloudflare Pages Preview deployment. Preview URL: `https://49bead42.royalegyptgroup-vy7.pages.dev`.
- CI success and Pages static Preview success do not prove Worker deployment, Make integration, Facebook publishing, production readiness, or customer-flow correctness.
- No PR has been merged and no production Worker deployment is authorized by the current repair scope.

## 7. OpenCode Mobile: why it may ask for project details

OpenCode Mobile is a client UI; it does not automatically inherit every fact from unrelated chats, repositories, or another Windows workspace. Its effective context depends on the OpenCode server session, the selected working directory/repository, and instruction/context files visible to that session.

For every task in this repository:
1. Confirm the mobile client is connected to the intended Windows OpenCode server.
2. Confirm the workspace/working directory is this Royal Egypt Group checkout, not the OCTOPUSA directory.
3. Ensure the repository is on the intended branch and has no unexplained dirty files.
4. Read `AGENTS.md` and this document before asking the owner for project background.
5. Ask only for missing decisions or approvals, not for the project's identity, architecture, or known safety rules.

If Mobile is connected to an OCTOPUSA workspace, it should remain there for OCTOPUSA tasks. Do not silently switch workspaces or copy Royal Egypt secrets/files into OCTOPUSA. Keep one repository and project context per task.

## 8. Required task workflow

- Start read-only: inspect git status, branch, recent commits, project instructions, relevant code, tests, and deployment target.
- State a concise plan with scope and risk before significant edits.
- Prefer synthetic fixtures, preview environments, and test databases.
- Make focused changes on a separate branch; never overwrite unrelated user work.
- Run focused tests, then relevant broader tests. Capture actual output and commit SHA.
- For cloud operations, verify exact account, project, environment, bindings, and least-privilege access. If permissions cannot be proven safe, stop before mutation.
- Do not merge, publish, activate automation, access customer records, alter billing, or deploy production without explicit authorization.
- Finish with evidence: changed files, commit/PR, test results, preview URL if any, and unresolved blockers.

## 9. Additional live findings (2026-11-15)

- Make scenario `8423033` (Concurrency Lab) was revalidated by Make's activation check successfully, then immediately deactivated. It is now paused, has zero incomplete executions, zero queued webhook deliveries, and no executions were started during the check. This proves configuration validation can pass; it does not prove a synthetic row-reservation test has run.
- Make scenario `8333266` (legacy Daily CEO Notes | Royal Egypt) is not active. Its trigger is daily 19:30 and its modules still use OpenAI text generation, OpenAI image generation, and direct Facebook publishing. It must remain inactive; do not reactivate or use it as the new architecture.
- Make scenario `8438190` remains paused. Its three HTTP modules still point to legacy path-token routes on the production Worker: `/generate-<token>`, `/image-<token>` (GET), and `/publish-<token>`. The staged v2 Worker expects authenticated POST requests to `/api/generate`, `/api/image`, and `/api/publish`, followed by independent outbox reservation/start/receipt/read-back/verify actions. Do not change the Make URLs to v2 until the matching Worker version and required bindings/secrets are deployed and verified in the correct environment.
- The existing Make HTTP API-key connection is referenced by ID in module configuration. Never retrieve or print its secret. Its existence alone does not prove that the production Worker has the required Bearer authorization configuration.
- Both connected Cloudflare integrations (the personal and Royal Egypt Group profiles) returned HTTP 401 `Invalid API Token` from the read-only `GET /user/tokens/verify` endpoint. Reauthorization is required before Cloudflare API reads or writes can be trusted. Do not attempt production Worker deployment, secret changes, binding changes, or migrations through those invalid connections.
- PR #79 adds this project context and the OpenCode Mobile guide. Its Pages Preview deployment succeeded at `https://8c229f2a.royalegyptgroup-vy7.pages.dev`. The PR remains Draft and unmerged.

### Make publishing safety confirmation (2026-11-15)

- Confirmed via scenario search that the publishing scenarios `8438083`, `8438104`, `8438190`, and `8419318` are all `paused` with `isActive=false`.
- Legacy `8333266` remains `error` and `isActive=false`; it has a daily 19:30 trigger and direct Facebook module configured, so it must never be reactivated.
- `8423033` is `paused` and `isActive=false`. Its activation validation passed, then it was immediately deactivated. No webhook delivery or execution was triggered.
- `8443695` is the only matching scenario found with `isActive=true`; it is an on-demand, read-only Facebook archive export, not a publishing scenario. Do not mistake it for a publisher.
- Scenario descriptions were updated to record these safety gates and the Worker v2 migration blocker.


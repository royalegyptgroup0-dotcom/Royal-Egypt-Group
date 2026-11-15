# OpenCode Instructions — Royal Egypt Group

These instructions apply only to this repository. Do not mix this project with OCTOPUSA, CEO Notes as a separate editorial/social project, RoyalMediaPlayer, Painty Creator, or any other repository. CEO Notes Worker source may exist under this repository, but its publishing identity and workflows remain separate from Royal Egypt Group's property, coffee, and transportation businesses.

## Mandatory startup procedure

Before acting on any task:

1. Read this file and `docs/PROJECT_CONTEXT.md`.
2. Run `git status --short --branch`, `git branch --show-current`, and inspect the latest commits. Never overwrite or discard pre-existing user changes.
3. Identify the exact project area, environment (local/test/preview/production), and permitted scope from the user's latest instruction.
4. Inspect the relevant source, tests, deployment configuration, and current behavior before editing. Search the repository for existing implementations before creating new ones.
5. Make the smallest safe change. Add or update tests and run them. Report commands, results, commit/branch, and any unverified items.
6. If required project facts are absent from this repository, inspect available project docs and history first. Ask only for a genuinely missing decision or permission, not for details already documented here.

## Project boundaries

- Parent: Royal Egypt Group.
- Business divisions: Royal Egypt Properties, Royal Egypt Coffee, and Royal Egypt Transportation.
- CEO Notes is a separate editorial/social project. Do not merge its content, audience, credentials, publishing identity, or automation with Royal Egypt business operations.
- Do not invent active services: Coffee and Transportation are informational landing pages unless implementation and operational readiness are proven.
- Property catalogue entries are enquiries, not verified live inventory. Confirm price, availability, legal status, boundaries, permitted use, and payment terms before presenting them as confirmed.

## Security and approval rules

- Never print, commit, log, echo, or ask the user to paste secrets, tokens, passwords, private keys, customer data, or personal lead details.
- Never read or export customer/lead records unless the user explicitly authorizes that exact data access. Prefer synthetic fixtures and test databases.
- Never place admin credentials in frontend code or repository files. Use platform secret stores.
- Never send messages, publish listings/posts, initiate payments, purchase credits, or contact customers without explicit approval for that action.
- Never activate or resume Make publishing scenarios unless the user explicitly authorizes activation. A request to fix a scenario is not permission to publish or message.
- Never point preview/test services at production D1, KV, R2, or other production data stores.
- Do not add paid services, subscriptions, paid APIs, or billing commitments without explicit approval. Prefer free-tier-compatible designs, while verifying current quotas.
- Never weaken authentication, authorization, rate limits, audit trails, idempotency, or approval gates to make tests pass.

## Git and deployment rules

- Work on a dedicated feature/fix/docs branch. Do not commit directly to `main`.
- Do not merge pull requests or alter branch protection unless explicitly authorized.
- Preview deployment is allowed only when the user authorizes it and the target is isolated. Production deployment requires explicit authorization and verified least-privilege credentials.
- Before deployment, verify bindings, secrets by presence only (never values), migrations, environment target, rollback path, and tests.
- Do not claim a deployment or test passed without reading the corresponding result.

## Required completion report

Return:
- what changed and why;
- exact branch, commit, and PR;
- tests run and pass/fail evidence;
- environment affected (local/test/preview/production);
- security and data-access boundaries observed;
- remaining blockers, owners, and next concrete action.

Use Arabic for user-facing reports unless the user requests another language. Do not ask the user to repeat facts already recorded in project documentation.

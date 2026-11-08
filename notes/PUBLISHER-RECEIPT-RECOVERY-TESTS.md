# CEO Notes — Isolated Publisher Receipt Recovery Tests

Status: test specification only. No production Worker, Make scenario, KV feed, or Facebook page is changed by this document.

## Safety boundary

- Run only against an isolated Worker environment and isolated KV namespace.
- Use fake Facebook adapters / deterministic fake post IDs. Never call the real Facebook Pages API in these tests.
- Keep production scenario `8438190` paused and unchanged until the test matrix passes and a separate cutover decision is made.
- Do not treat a transport timeout as proof that a Facebook post failed. Mark it `unknown` and reconcile before retrying.

## Required record model

For each article day, persist a publication record keyed by a stable article identifier (for example `ceo-notes:day:28`) and a content hash. Track each destination independently:

- `website`: `pending | complete`, with feed version/hash and timestamp.
- `ceoNotes`: `pending | in_flight | complete | unknown | failed`, with page ID, post ID, attempt ID, timestamp, and response fingerprint where available.
- `royalEgyptProperties`: the same independent state fields.
- `approval`: reviewer, approved timestamp, approved content hash, and exact destination set.

The state transition and receipt write must be atomic in the isolated persistence layer. A destination marked `complete` must never be posted again by an ordinary retry. A content hash mismatch invalidates approval and blocks publication.

## Deterministic test matrix

| Case | Website | CEO Notes | Royal Egypt Properties | Expected result |
|---|---|---|---|---|
| 1. Happy path | succeeds | succeeds | succeeds | Three independent receipts; all complete |
| 2. CEO failure | succeeds | definite failure | not attempted | CEO failed; Royal remains pending; retry only CEO |
| 3. Royal failure | succeeds | succeeds + receipt saved | definite failure | CEO complete; Royal failed; retry only Royal |
| 4. CEO timeout, post outcome unknown | succeeds | timeout after fake remote acceptance | not attempted | CEO unknown; stop; no automatic repost; reconciliation required |
| 5. Royal timeout, post outcome unknown | succeeds | complete | timeout after fake remote acceptance | CEO complete; Royal unknown; reconcile Royal only |
| 6. Duplicate scheduler delivery | succeeds once | complete | complete | Second delivery is a no-op; no duplicate adapter calls |
| 7. Duplicate receipt callback | succeeds | complete | complete | Same receipt is idempotent; conflicting post ID is rejected and audited |
| 8. Content edited after approval | succeeds or pending | not attempted | not attempted | Hash mismatch blocks all social actions; approval required again |
| 9. Wrong destination page ID | succeeds | blocked | blocked | Configuration mismatch blocks publication before any external action |
| 10. Feed already contains day | already complete | not attempted | not attempted | Duplicate day gate; no social calls |
| 11. Missing website receipt | ambiguous | not attempted | not attempted | Halt and reconcile website state before social publication |
| 12. Concurrent scheduler/manual trigger | one writer | one call max | one call max | Lock/idempotency prevents overlapping publication |

## Required assertions

1. The public feed contains no draft and no item marked Published before the website write is confirmed.
2. Approval must match the exact content hash and destination list.
3. The CEO Notes post receipt is persisted immediately after the adapter confirms success, before attempting Royal Egypt Properties.
4. The Royal Egypt Properties receipt is persisted immediately after its independent success.
5. Retry logic selects only destinations in a definite retryable state (`pending` or `failed`); it never retries `complete` or `unknown`.
6. `unknown` requires an explicit read-only history reconciliation or a human decision; it cannot be converted to `failed` merely because a request timed out.
7. Replaying an identical receipt is a no-op. A different post ID for an already completed destination raises a conflict and writes an audit event.
8. The lock has an owner and expiry; expired locks can be recovered without deleting the publication record.
9. Every transition emits an audit event with article day, content hash, destination, prior state, next state, attempt ID, and timestamp. Do not log credentials or full private request bodies.
10. All tests use fake adapters and isolated storage; assert that no production endpoints or namespaces were contacted.

## Release gate

Do not resume Make, run a manual production execution, alter the live feed, or publish DAY 28 until:
- all cases above pass in isolation;
- the deployed Worker fallback points to the canonical `ceo-notes-site` source and recovery is tested using isolated storage;
- a read-only duplicate check has been completed for each intended Facebook destination;
- the user has approved the final article text, image, and destinations;
- a controlled release and rollback plan is reviewed separately.

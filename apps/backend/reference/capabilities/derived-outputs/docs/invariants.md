# Derived Outputs invariants, guarantees, and limits

## Preconditions → guaranteed outcomes

| Preconditions | Current guaranteed outcome | Boundary |
|---|---|---|
| Declaration store insert/claim succeeds | A 32-hex prompt output exists at definition revision 1/head 0 | Service/store |
| Refresh starts on an existing output | Definition/head/Knowledge generation and input Context digest are frozen in an attempt | Service/store |
| Scope resolution succeeds | Every planned/tool retrieval uses one immutable manifest object | Knowledge/service closure |
| Knowledge returns a region | Its source must have a manifest descriptor before it becomes grounding/candidate | `candidateForRegion` |
| Synthesis status is `ok` | Text is nonblank and at least one exact trusted evidence item exists | `validateSynthesis` |
| Candidate and all three settlement fences still match | Exactly head+1 revision is inserted and output atomically advances to current | Immediate SQLite transaction |
| Any settlement fence changed | Candidate is not inserted; attempt is discarded and result is skipped | Same transaction |
| A failure still owns all fences | Output becomes failed with generic diagnostic; no revision is inserted | Failure transaction |
| A failure lost a fence | Newer output/freshness is not overwritten | Failure transaction |
| Successful non-skipped Knowledge mutation event is handled | Generation increments and every output becomes stale atomically in Derived SQLite | Invalidation transaction |
| Logical delete succeeds | Final aggregate snapshot and terminal revision are retained; current Output and operational claims/attempts are removed | Delete transaction and current-row foreign keys |
| Purge targets a terminally deleted Output | Lifecycle history, stable root, and retained answer revisions are physically removed | Purge guard plus transaction/root cascade |

## Identity and revision rules

- Output IDs are random 16-byte/32-hex identities.
- Resource revision starts at 1 and increments for every accepted current-state mutation;
  logical deletion is terminal resource revision `N + 1`.
- Definition revision starts at 1 and increments only on accepted complete definition update.
- Head starts at 0; accepted revisions are 1-based and exactly previous head +1.
- Immutable revisions are never overwritten or reused while the output exists.
- Concurrent candidates can propose the same next number, but only one can insert/publish because settlement is immediate and head-guarded.
- Logical deletion removes declaration idempotency claims with the current row; it retains
  answer and lifecycle history until purge.
- Refresh attempt IDs are random 32-hex values; losing/failed attempts remain operational
  state only while the Output is current.

## Scope and retrieval guarantees

- Empty definition Context means “freeze all current Knowledge sources,” not “retrieve nothing.”
- Non-empty Context is recursively resolved once through the resource registry.
- Source membership, public resource identities, and known resource revisions are immutable for the refresh.
- Initial retrieval, synthesis retrieval, resource listing, direct read, and evidence listing all use that manifest/candidate lineage.
- Knowledge filters retrieved windows to `resolvedSourceIds` before region assembly.
- Direct read also rechecks active resource identity/kind/revision and fails closed on change.
- Knowledge generation is project-wide; any observed source mutation during compute prevents publication even if outside the selected scope.

This is retrieval containment, not end-user authentication. Authorization must be enforced before or inside the resource provider/registry.

## Evidence/provenance guarantees

- Character spans are nonnegative safe integers with `end > start`; semantics are UTF-16 `[start,end)`.
- Line spans use safe integers with `startLine ≥1` and `endLine ≥ startLine`.
- Accepted evidence exactly matches an observed resource kind/ID/span plus trusted revision/source ID.
- One candidate cannot be cited twice.
- Ranks are positive integers in nondecreasing array order; ties are allowed and contiguous ranks are not required.
- Contribution must be nonblank after trimming; sentence count is not deterministically enforced.
- `ok` requires evidence. `insufficient` and `contradiction` may use empty evidence.
- Legacy `kind:"bytes"` persisted spans are normalized to `characters` on read.

Evidence says what candidate the model selected. It does not prove that the model's prose is logically entailed by that evidence; grounding instructions and exact provenance validation reduce but do not eliminate semantic model error.

## Concurrency and atomicity

The store uses WAL, 5-second busy timeout, and immediate transactions for claims and settlement. Atomic guarantees are confined to Derived SQLite:

- definition replacement/freshness change is one transaction;
- publish revision/head/freshness/attempt/keyed result is one transaction;
- failure ownership/freshness/attempt/keyed result is one transaction;
- generation increment/stale-all is one transaction;
- logical delete is one history/current transaction;
- purge is one history/root transaction after its current/terminal guards.

Intelligence, Knowledge, external resource reads, and Derived SQLite do not share a transaction. Correctness is freeze → concurrent compute → compare-and-publish. Token/provider work can be wasted by a lost race, but a loser cannot roll back the winner.

Knowledge mutation listeners run synchronously after Knowledge has committed its own mutation. If Derived invalidation throws, Knowledge logs and rethrows after its source change already happened; cross-store atomic rollback is not guaranteed.

## Idempotency guarantees and boundaries

- Keys must be nonblank and ≤512 UTF-8 bytes at service boundary.
- Key namespace is project/table-wide, so caller namespaces should be included in the string.
- Reusing a completed key with identical digest returns its persisted canonical result after restart.
- Reusing with divergent input/output throws a typed conflict.
- Definition and refresh results, including skipped results, are persisted for exact replay.
- HTTP endpoints currently do not expose keys.
- A key claim is not a durable queued job and not strict single-flight: an incomplete same-key caller may recompute. Final CAS and canonical result completion prevent divergent publication, but do not guarantee only one provider call.

## Freshness semantics

- Declare initializes `refreshing`.
- Successful owned publication sets `current`, clears stale/failure metadata, and records last check.
- Definition update marks `stale` and sets `staleSince`.
- Every Knowledge event marks all outputs stale, preserving the first existing `staleSince`.
- Owned pipeline failure sets `failed` and clears stale timestamp.
- A late/lost failure changes only its attempt, not current output state.
- Refresh of an existing output does not first persist `refreshing`; callers cannot use freshness as an in-flight lock.
- Freshness is conservative cached metadata, not proof that the answer is factually current.

## Limits and validation

| Limit | Default | Current effect |
|---|---:|---|
| `maxPlanQueries` | 8 | Trimmed/deduplicated plan is sliced to this count; planning schema itself has max 8 |
| `maxToolRounds` | 8 | Intelligence tool-using synthesis round limit |
| idempotency key | 512 UTF-8 bytes | Optional service paths |

There is no capability-specific maximum prompt, stabilization text, answer text, Context-entry count, evidence count, contribution length, or line range. Underlying Intelligence, Knowledge, transport, General File, and Connector limits may apply. Planned retrieval calls execute sequentially.

## Failure and status behavior

- Empty retrieval is a successful published `insufficient` revision after planning/retrieval costs.
- Invalid planning/synthesis/tool/evidence data becomes a refresh failure result, not untrusted persisted content.
- Failed diagnostics disclose stage but not provider exception message.
- Usage aggregates planning, every Knowledge retrieval, tool retrievals, and synthesis. Attempt rows persist four token counts, not cost USD; cost may be logged.
- Output deletion racing settlement yields skipped fallback result; no revision can reappear.
- Endpoint declaration can return HTTP 201 containing a failed refresh result because `refresh` catches owned pipeline errors.

## Resource support boundaries

- General File text and active Connector prose sources have list/read implementations.
- Connector directory items are separate readable resource IDs; file connector is one resource.
- Plain Document sources can be retrieved/cited from Knowledge but have no direct ResourceRegistry read implementation today.
- Opaque General Files/Connector items are not Knowledge sources and do not enter the manifest.
- Pending/failed Connector source unions are intentionally excluded.

## Regression coverage

[`derived-outputs.test.ts`](../../../../test/capabilities/derived-outputs.test.ts) currently covers no-evidence publication/telemetry; persisted keyed refresh replay, skipped replay, mismatch, and unkeyed repetition; keyed definition replay/mismatch and unkeyed CAS; transactional definition stale marking; current/history logical deletion and purge; Knowledge invalidation/generation fencing; one frozen manifest across all tools; real General File/Connector registry mapping/read containment; concurrent refresh winner; old-definition and late-failure races; and untrusted evidence rejection with complete usage accounting.

## Non-goals

Current non-goals include auto-refresh scheduling, a second jobs-runtime graph, durable resumable provider stages, fine-grained source→output invalidation, semantic entailment proof, output diffing, rich-text/value/matrix output kinds, automatic adoption by resources, history-to-current replay, Document direct-read registration, end-user authorization, and distributed transactions across Knowledge/Intelligence/resource stores.

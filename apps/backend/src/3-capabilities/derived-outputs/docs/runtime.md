# Derived Outputs runtime

## Construction and composition

[`createDerivedOutputServiceInstance`](../../../1-init/create/derived-outputs.ts) creates a project-bound SQLite store and passes it with Knowledge, Intelligence, ResourceReader, `config.derivedOutputs`, and Logger to [`createDerivedOutputService`](../derived-outputs.ts).

Composition order in [`startBackend.ts`](../../../1-init/startBackend.ts) matters:

1. create Context and an initially empty runtime resource registry;
2. inject that registry as Knowledge's resolver;
3. create General Files and Connector with Knowledge;
4. late-register those concrete services in the registry;
5. create Derived Outputs with Knowledge/Intelligence/registry;
6. subscribe `recordKnowledgeSourceMutation` to Knowledge.

This breaks the construction cycle without a general service locator.

## Public service methods

### `declare(request, options?)`

Builds a random 32-hex prompt output at definition revision 1, head 0, and `refreshing` freshness. With options it validates a ≤512-byte nonblank key, claims key+request digest transactionally, replays the existing matching output, or throws on digest mismatch. Without options it inserts directly. It logs prompt length, identity, creation/replay flag, and duration. It does not validate that prompt is nonblank or bounded.

The service does not automatically refresh. The HTTP declare job explicitly calls `refresh` immediately after `declare`.

### `get` and `getRevision`

Thin synchronous-store reads wrapped in promises with debug found metadata. `getRevision` reads one immutable numbered revision, not necessarily the current head.

### `updateDefinition(id, request, options?)`

Optionally claims and replays an idempotent result. Then `updateOutputDefinition` runs an immediate SQLite transaction: verify output/revision, replace the complete definition, increment definition revision, mark stale, clear failure diagnostics, and optionally complete the idempotency claim with canonical JSON. The service maps not-found/stale states and logs success/replay.

### `refresh(id, options?)`

Loads the output, checks the empty-scope precondition, then optionally claims/replays a keyed result, freezes state, inserts an attempt, executes the pipeline, and settles through one of two store transactions. The method catches pipeline failures and normally returns `failRefresh(...).result`; it does not rethrow the provider/model error.

#### Empty-scope precondition

Before the idempotency claim and before the attempt insert, `refresh` rejects an output whose `definition.contextEntries` is empty: it logs `derived-outputs.refresh.empty-scope` with the output ID and definition revision at error level and throws `DerivedOutputEmptyScopeError`. Nothing is written, so a refused refresh costs no attempt row, no usage, and no failed revision, and `Knowledge.resolveScope` is never reached with an empty array. Together with `DerivedOutputNotFoundError`, this is one of only two errors that leave `refresh` as a rejection instead of a `DerivedRefreshResult`.

`declare` still accepts a missing `contextEntries` and stores `[]`, so a declaration without a scope succeeds and its immediate refresh is what fails.

#### Frozen values

- output and definition revision;
- current head revision;
- current persisted Knowledge generation;
- canonical sorted input Context digest;
- later, one resolved `KnowledgeScopeManifest` and its scope digest.

#### Planning

Calls `Intelligence.reasonStructured` with medium strength/high speed and a JSON schema. `validateQueries` requires an array of strings, trims/deduplicates, slices to configured maximum, and rejects an empty usable plan. Query text is not logged.

#### Retrieval

Executes planned queries sequentially with the exact manifest, aggregates regions and embedding usage, maps every region's source to a manifest descriptor, and records candidates. Knowledge returning an out-of-manifest source is a pipeline error.

#### No-evidence path

When all regions are empty, skips synthesis and proposes the exact content `Found no evidence to support a response.`, empty evidence, and status `insufficient`, then uses the same atomic settlement path as synthesis.

#### Synthesis path

Creates four tools over the frozen manifest/candidate array, then calls `reasonWithToolsStructured` with high strength/medium speed and configured tool-round limit. It aggregates tool retrieval plus synthesis usage and validates the structured result before proposing head+1.

#### Settlement/failure

`settleRefresh` compares definition/head/Knowledge generation and output existence in one immediate transaction. A match inserts revision, updates head/current freshness and initial stabilization text, settles attempt, and persists keyed result. A mismatch records a discard and returns current/fallback output with `skipped: true`.

`failRefresh` performs the same fences. Only an owned failure marks output `failed` with generic code/message; a late failure is discarded rather than overwriting a newer definition/head/stale generation.

### `recordKnowledgeSourceMutation(mutation)`

Synchronously increments project generation and marks every output stale in one immediate transaction, then logs operation/generation/count. It intentionally ignores source-level dependency precision. Knowledge invokes listeners only after a non-skipped add/remove fully succeeds.

### `delete(id)`

Calls transactional logical deletion and throws not-found if no current row exists. The
store archives the final aggregate, appends terminal resource revision `N + 1`, and
deletes current state. Current-owned claims and attempts cascade away; the stable root,
immutable answer revisions, and lifecycle history remain. External `DerivedOutputRef`
owners are not updated.

### `purge(id)`, `pruneHistory(cutoff)`, and `purgeExpired(cutoff)`

`purge` requires no current Output and a terminal deletion record, then removes lifecycle
history and the stable root so retained answer revisions cascade. `pruneHistory` removes
old lifecycle snapshots only for still-current Outputs. `purgeExpired` finds terminal
deletions older than the cutoff and applies the same guarded purge. These methods are
called by the direct purge endpoint and backend-wide retention runner; purge emits no
Activity transaction.

## Orphan reaper

[`createDerivedOutputReaper`](../../../1-init/create/derivedOutputReaper.ts) builds a
second `ResourceRetentionTarget`, registered as `derived-outputs-orphans` after both the
`document` and `derived-outputs` ports. It is composition-layer code, not part of the
service, and needs only `delete` from Derived Outputs.

| Member | Behavior |
|---|---|
| `pruneHistory(cutoff)` | Returns 0. The reaper owns no history; its deletions are pruned by the `derived-outputs` port |
| `purgeExpired(cutoff)` | Asks each `DerivedOutputClaimant` for `listDetachedOutputs(cutoff)`, calls `delete` on each, then `releaseDetachedOutput`, and returns how many it reaped |

`DerivedOutputClaimant` is `{ kind, listDetachedOutputs(cutoff), releaseDetachedOutput(outputId) }`.
`kind` names the owner in logs so a reaped Output traces back to whose it was. Document is
the only claimant wired today.

Error handling is per-claimant and per-Output. A claimant whose listing throws is logged as
`derived-outputs.reap.list-failed` and skipped without stopping the rest. A delete that
fails with anything but `DerivedOutputNotFoundError` logs
`derived-outputs.reap.delete-failed` and leaves the ownership row alone, because that row
is the only record that the Output still needs reaping. A not-found delete falls through to
release the row it left behind. Successful reaps log `derived-outputs.reap.found` at warn
per claimant and `derived-outputs.reap.deleted` per Output.

## Validation/helper groups

| Group | Functions and responsibility |
|---|---|
| Request identity | declaration/refresh/definition digests; idempotency key byte validation |
| Planning | inline prompts/schema and `validateQueries` |
| Candidate identity | `spanKey`, `candidateKey`, deduplicating `addCandidate`, `candidateForRegion` |
| Grounding | `regionToGroundingText` emits trusted identity/source/span plus verbatim region |
| Evidence | `parseEvidenceSpan`, exact `validateEvidence`, `validateSynthesis` |
| Usage | zero value and additive token/cost aggregation |
| Tool construction | `buildToolSet` and four private tool builders |
| Time | ISO `now` |

Evidence candidate deduplication key is resource kind + ID + span. Validation additionally requires exact trusted revision and source ID.

## Tool runtime

| Tool | Validation and side effects |
|---|---|
| `retrieve(query)` | Nonblank string; scoped Knowledge retrieve; adds candidates; records usage/logs |
| `read(id,kind,startLine,endLine)` | Safe positive range; require exact descriptor before reader; reader rechecks revision; adds line candidate |
| `list_resources()` | Reader list must be a subset exactly matching manifest descriptors |
| `list_evidence()` | Returns copies of candidates observed so far |

The tool set is mutable only in its growing per-refresh candidate list and usage accumulator. Scope identity never changes.

## Store runtime and transactions

`SQLiteDerivedOutputStore` uses immediate transactions for every claim, definition
update, logical delete, physical purge, Knowledge invalidation, successful settlement,
and failure settlement. Each mutation archives the prior aggregate and advances its
resource revision in the same transaction. Claim acquisition and the long provider
computation are intentionally not one transaction.

The `_outputs` table is current-only. `_resources` is a stable FK root, `_history` stores
superseded aggregate snapshots and terminal deletion records, and immutable answer
`_revisions` attach to the root. Claims and attempts attach to current Output state, so
logical deletion removes operational state without losing retained answers.

Completed keyed results are persisted as JSON and replay after process restart. An incomplete claim does not provide durable work resumption or single-flight waiting; another caller with the same pending key can recompute, while final CAS and canonical claim completion prevent divergent publication/results.

`close()` exists on the store for tests/lifecycle owners but is not exposed through the service interface.

## Logging and redaction

Logs cover declare/read/update, stage counts, tool calls, scope digest, settlement outcome, freshness invalidation, token/cost usage, and durations. Refresh failure logs stage, outcome, and error class only. The persisted/user-facing diagnostic is generic (`Refresh failed during <stage>.`), so provider response bodies and prompt text are not echoed through this capability's error logs.

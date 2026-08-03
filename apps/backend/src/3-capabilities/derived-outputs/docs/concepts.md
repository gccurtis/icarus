# Derived Outputs concepts

## Purpose and outcomes

A Derived Output is a saved, refreshable question. The mutable output records what to ask and which resources may ground it. Each accepted refresh creates one immutable answer revision with trusted evidence. Other capabilities store an `outputId` plus an applied revision and choose when to adopt a newer head; Derived Outputs does not push text into them.

## Vocabulary

| Term | Current meaning |
|---|---|
| Output | Mutable identity, definition, head pointer, and cached freshness |
| Resource revision | Monotone version of the live Output aggregate; distinct from definition and answer revision |
| Definition | Prompt, Context entries, stabilisation text, optimistic revision |
| Head revision | Latest published immutable answer number; 0 before first publication |
| Revision | Frozen answer text/status/evidence produced from one definition revision |
| Refresh attempt | Operational record of frozen input digest, candidate, usage, and settlement/discard |
| Stabilisation text | Prior/reference prose supplied to both planner and synthesizer to preserve answer shape |
| Frozen scope manifest | One immutable Context/resource/source snapshot reused by every retrieval and tool in a refresh |
| Project scope sentinel | `{ id: "*", kind: "project" }`, the explicit spelling of whole-project scope, expanded to live membership when the scope is resolved |
| Empty scope | A definition whose `contextEntries` is `[]`; it names nothing, and refresh refuses it |
| Released output | An output an owning capability detached from every block and reports to the orphan sweep |
| Knowledge generation | Project-wide counter incremented on every successful, non-skipped source add/remove event |
| Evidence candidate | Trusted identity/span observed from Knowledge or a successful scoped read |
| Evidence | Model-selected candidate plus rank and contribution, accepted only by exact validation |
| Settlement fence | Definition revision + head revision + Knowledge generation checked in one SQLite transaction |
| Skipped refresh | Computation lost a fence or its output was deleted; no revision was published |
| Idempotency claim | Optional service-level key/digest/result record for declaration, definition update, or refresh replay |
| Logical deletion | Archive the final live aggregate plus a terminal revision, then remove current and operational state |
| Purge | Irreversibly remove the stable root, retained answer revisions, and resource history |

## Ownership and architecture

```mermaid
flowchart LR
  HTTP["Derived Output endpoints"] --> JOB["inline jobs"]
  JOB --> SVC["DerivedOutputService"]
  SVC --> STORE["SQLiteDerivedOutputStore"]
  SVC --> INTEL["Intelligence"]
  SVC --> KNOW["Knowledge"]
  KNOW --> REG["RuntimeResourceRegistry"]
  REG --> CTX["Context"]
  REG --> GF["General Files"]
  REG --> CONN["Connector"]
  SVC --> REG
  KNOW -->|"successful source mutation"| INVALIDATE["project generation + stale all outputs"]
  INVALIDATE --> STORE
  SVC --> LOG["shared Logger"]
```

Knowledge retrieves but never synthesizes. Intelligence reasons but owns no output history. Resource capabilities expose current source identity/content but do not own answer generation. Derived Outputs orchestrates those ports and owns durable results.

## Output and revision lifecycle

```mermaid
stateDiagram-v2
  [*] --> RefreshingNoHead: declare (head 0)
  RefreshingNoHead --> Current: first refresh publishes
  RefreshingNoHead --> Failed: owned first refresh fails
  Current --> Stale: definition update or Knowledge mutation
  Stale --> Current: refresh publishes
  Current --> Current: explicit refresh publishes next revision
  Current --> Failed: owned refresh fails
  Stale --> Failed: owned refresh fails
  Failed --> Current: later refresh publishes
  Current --> [*]: logical delete
  Stale --> [*]: logical delete
  Failed --> [*]: logical delete
```

The service does not change an existing output to `refreshing` at refresh start. That state is assigned at declaration and persists until the first owned settlement. Definition update marks stale atomically. Every successful Knowledge mutation conservatively marks every output stale.

The typed Output table is the current projection and contains live aggregates only. Each
accepted definition update, refresh settlement, owned failure, or Knowledge invalidation
archives the previous aggregate snapshot and advances its resource revision. Logical
deletion archives the last live snapshot, appends terminal revision `N + 1`, and removes
the current row. Current-owned declaration claims, refresh claims, definition-update
claims, and refresh attempts cascade away; the stable internal root keeps immutable
answer revisions and lifecycle history available.

Physical purge is a separate irreversible operation allowed only after terminal deletion.
It removes lifecycle history and the stable root, cascading retained answer revisions.
The backend-wide retention policy prunes old snapshots for live Outputs and purges
terminal deletions after the configured cutoff.

Logical deletion also arrives unattended, from the `derived-outputs-orphans` retention
port. An owning capability that has detached an Output from every block reports it as
released; the sweep logically deletes exactly those and leaves the history for the
ordinary `derived-outputs` port to purge. It never enumerates Outputs, so an Output
declared standing alone through the API is never a candidate. See
[Flows](flows.md#orphan-reaping) for the sweep and [Invariants](invariants.md) for the
safety property it rests on.

## Definition and stabilization

Definition revision begins at 1. A complete definition update replaces prompt, Context entries, and stabilisation text under expected-revision CAS and marks freshness stale.

On successful refresh settlement, SQLite fills `stabilisationText` from the new content only when it is currently empty. Once non-empty, later refreshes preserve it until an explicit definition update. The model prompt instructs minimal factual changes around that text, but model adherence is not a deterministic guarantee.

## Empty scope precondition

A definition whose `contextEntries` is `[]` names nothing, and `refresh` throws
[`DerivedOutputEmptyScopeError`](../domain/model.ts) before it inserts an attempt. The
check is a precondition on the definition, not a pipeline failure: there is no attempt
row, no usage, no failed revision, and no freshness change. HTTP maps it to
`400 empty_scope`.

An empty array is what an unbound Context Variable and an omitted request field produce.
It used to mean “the whole project,” so those mistakes grounded on the entire corpus and
published a confident answer. To scope to everything, a definition names the project
explicitly with `{ id: "*", kind: "project" }`.

`declare` still accepts an empty scope. A Document copied from a template carries Prompt
Blocks whose Context Variables are unbound, and declaring their Outputs is how the copy is
made; refusing there would make that impossible. The refusal belongs at `refresh`, the
moment an answer would otherwise be produced from nothing.

## Frozen scope model

A refresh that passes the precondition calls `Knowledge.resolveScope` exactly once with a
non-empty entry array:

- entries are recursively resolved through Context and the runtime resource registry;
- `{ id: "*", kind: "project" }` names the whole project and expands to its live membership when the scope is resolved, so it is a rule rather than a snapshot taken at declaration;
- manifest fields include canonical input/leaves, sorted source IDs, public resource descriptors/revisions, two digests, and timestamp;
- the object and contained arrays/records are frozen;
- initial queries and all four synthesis tools close over the same object.

```mermaid
flowchart TD
  DEF["definition.contextEntries"] --> GATE{"names anything?"}
  GATE -->|no| REFUSE["DerivedOutputEmptyScopeError"]
  GATE -->|yes| RESOLVE["Knowledge.resolveScope once"]
  RESOLVE --> MAN["frozen manifest"]
  MAN --> PLANRET["all planned retrieves"]
  MAN --> TOOLRET["retrieve tool"]
  MAN --> TOOLREAD["read tool"]
  MAN --> LISTRES["list_resources"]
  MAN --> LISTEV["evidence candidate set"]
  PLANRET --> CANDS["trusted candidates"]
  TOOLRET --> CANDS
  TOOLREAD --> CANDS
  CANDS --> VALIDATE["exact evidence validation"]
```

The manifest freezes membership and resource revision identity, not source bytes inside an external system. Resource reads recheck current revision; a changed resource fails closed. The Knowledge generation fence prevents publication after any observed Knowledge source mutation during computation.

## Refresh pipeline

1. Refuse an output whose definition names no context, before any state is written.
2. Freeze definition/head/Knowledge generation and insert an attempt.
3. Resolve one scope manifest.
4. Ask Intelligence for bounded retrieval queries.
5. Run those Knowledge retrievals sequentially with the manifest.
6. Convert every region into an evidence candidate using a manifest descriptor.
7. If no regions exist, produce a deterministic `insufficient` answer without synthesis.
8. Otherwise run high-strength tool-using structured synthesis.
9. Validate status, text, evidence identity/revision/source/span/rank.
10. Atomically compare-and-publish, or discard when a fence changed.
11. On computation error, atomically mark failed only when the same fences still belong to this attempt; otherwise skip without overwriting newer state.

Step 1 is the only one that throws out of `refresh`. Everything from step 2 onward is
caught and converted into a failed or skipped result.

Expensive work may run concurrently. Correctness comes from atomic final settlement, not a serial→concurrent→serial orchestration object.

## Evidence semantics

Knowledge regions use JavaScript UTF-16 code-unit offsets (`characters`, inclusive/exclusive). Direct reads use one-based inclusive line ranges. Legacy persisted spans labeled `bytes` are normalized to `characters` when read because they always contained JavaScript string offsets.

The model cannot create new provenance. An accepted item must exactly match a candidate produced by initial retrieval, the retrieve tool, or the read tool. `status: "ok"` requires at least one accepted evidence item; insufficient/contradiction may have none.

---
title: "Execute Ω-003 — Close Knowledge capacity, bounded-read, and refusal safety"
packet_id: "Ω-003"
status: "ready-for-execution"
wave: "Wave 0 — Stabilize current truth"
depends_on: "Ω-001"
source_mirror: "docs/current-docs/notion/work-packets/omega-003-close-knowledge-capacity-bounded-read-and-refusal-safety.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-003 — Close Knowledge capacity, bounded-read, and refusal safety

## Mission

make Knowledge ingestion byte-bounded, artifact-bounded, concurrency-safe, and honest at every refusal boundary.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001**.

Source dependency statement: Ω-001

No later-packet integration gate was detected in the source dependency statement.

Start only after every hard predecessor is present on `main`. If a predecessor is intentionally being developed in parallel, do not guess across its contract: stop until it lands on `main` or request an agreed interface.

## Authority order

When sources disagree, use this order:

1. The latest explicit product decision from the user.
2. The current Primary documents under `docs/current-docs/notion/primary/`.
3. This execution directive and the packet-specific implementation specification below.
4. Current code, tests, migrations, and as-built architecture records on the actual starting `main`.
5. Supporting documents and frozen historical links.

`AGENTS.md` remains authoritative for repository workflow. The SHA in this file is the planning baseline, not an instruction to reset: always begin from the latest approved `main` that contains the required predecessors, and record the actual starting SHA.

## Required reading before editing

- `AGENTS.md` — repository rules; this is authoritative for workflow, validation, and documentation records.
- `docs/current-docs/README.md` — authority model and corpus layout.
- `docs/current-docs/notion/work-packets/omega-003-close-knowledge-capacity-bounded-read-and-refusal-safety.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/knowledge/artifact_limit.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/knowledge/knowledge.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/architecture/issues-and-gaps.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

Follow links inside the embedded specification when they resolve to additional local mirrors. Search the current repository for every type, route, table, tool, and invariant named below; do not rely on an old path or assume absence without checking.

## Preflight

Before changing code:

1. Record the starting `main` HEAD SHA, merged predecessor packets, and relevant existing records.
2. Reproduce or characterize the current gap with a focused test, probe, route inventory, or schema inspection.
3. Compare the packet against current code. Preserve correct partial implementations and delete or migrate only what the specification makes obsolete.
4. Identify the capability owner, its inbound ports, outbound ports, adapters, durable state, authorization point, transaction boundary, and observability boundary.
5. Confirm every proposed third-party dependency is free/open-source, pinned, and compatible with product distribution. Prefer the standard library or existing dependencies.
6. Write the smallest ordered implementation plan that can land without leaving accepted-but-unusable intermediate states.

If the gap is already fully closed, do not manufacture changes. Prove it with the required tests/evidence, reconcile stale documentation, and produce the normal change record and a verified commit on `main`.

## Execution contract

- Stay inside this packet's scope and explicit prerequisites. Do not opportunistically implement later packets.
- Preserve the modular-monolith, ports-and-adapters boundary. User Cells and per-user Project Subcells are logical runtime scopes; durable database state, revisions, CAS/idempotency, jobs, and outbox/change streams are correctness authorities.
- Enforce authorization at the owning application service/store boundary, not only in HTTP handlers. Reads, listings, search, events, history, jobs, and model/tool hydration must be caller-aware.
- Make durable mutations atomic at the stated aggregate boundary. Couple canonical state and required outbox/audit/idempotency writes in one transaction where the specification requires it.
- Keep retries, pagination, resource limits, concurrency, shutdown, and failure behavior explicit and bounded. No correctness may depend on sticky routing or one in-memory cell.
- Add or update typed errors and stable wire mappings without leaking hidden resource existence or secrets.
- Prefer focused tests first, then implementation, then broader integration, race, recovery, and load evidence required by the specification.
- Do not add placeholder handlers, no-op adapters, unbounded defaults, silent fallbacks, or TODO-only completion.
- Do not create companion `.go.md` files; that convention is retired. Add the numbered change record required by `AGENTS.md`.

## Decision authority

You may decide internal naming, package decomposition, private helper design, migration mechanics, indexes, test fixtures, and the exact FOSS library when the packet leaves those open. Choose the smallest production-grade option consistent with existing conventions. Record every material choice and rejected alternative in the change record.

Stop and ask for direction before proceeding if any choice would:

- contradict a settled Product/Primary architecture decision or another merged packet;
- weaken tenant, user, organization, project, or resource privacy boundaries;
- introduce destructive or irreversible migration without a tested rollback/restore path;
- add a non-FOSS, source-available-only, or materially costly external dependency/service;
- change a public contract outside this packet or make a later packet impossible;
- require guessing an unmerged predecessor's interface; or
- make an acceptance criterion impossible or only cosmetically satisfied.

## Validation and evidence

Run the narrowest relevant tests while iterating. Before commit, run the repository gates from `AGENTS.md`:

```bash
./scripts/check-format.sh
go build ./...
go test ./...
```

Also run every packet-specific test, race test, integration test, migration test, recovery test, load test, or live-provider certification required below. Live-provider tests may be skipped only when the required credential is unavailable; report the skip, fixture coverage, token/cost estimate where applicable, and the exact command for a credentialed rerun. Never claim a skipped gate passed.

Review the final diff for secret leakage, hidden-resource inference, unsafe logs, accidental broad scope, stale generated files, and unclassified dependencies.

## Required deliverables

1. Production implementation and migrations/adapters required by the specification.
2. Focused and broad automated tests proving the acceptance criteria.
3. API/schema/error/operations documentation actually changed by the implementation.
4. One new numbered `docs/records/NNNN-<slug>.md` record describing baseline, decisions, files, tests, operational effects, and remaining risks.
5. A commit scoped to this packet, pushed directly to `origin/main`.

The change record and completion handoff must state:

- actual baseline SHA and prerequisite packet status;
- outcome and user-visible/operational behavior;
- architecture and data-model decisions;
- migrations, compatibility, rollback, and rollout notes;
- security/privacy analysis;
- tests and exact commands/results, including skips;
- observability and operator impact;
- unresolved risks or follow-up packets; and
- a checklist mapping every acceptance criterion below to code/tests/evidence.

## Completion response

Return a concise handoff containing: commit SHA, changed areas, test results, migration/rollout notes, record path, and any explicit residual risk. Do not report this packet complete while an acceptance criterion is unproven or a required gate is failing.

---

## Embedded implementation specification

Source mirror: `docs/current-docs/notion/work-packets/omega-003-close-knowledge-capacity-bounded-read-and-refusal-safety.md`

> **Status:** Queued
> **Wave:** 0 — Stabilize current truth
> **Outcome:** make Knowledge ingestion byte-bounded, artifact-bounded, concurrency-safe, and honest at every refusal boundary.
<callout icon="🛡️" color="red_bg">
	**This packet closes frozen-head P1 safety gaps ING-1 and ING-2 and P2 transport gap ING-4.** A successful sync must never make a later lattice rebuild exceed its configured memory envelope, and an unknown or dishonest provider size must never disable byte or artifact enforcement.
</callout>
## Frozen baseline
Reviewed at [`50efd18413cc47935033889e51d58e9c828733e2`](https://github.com/gccurtis/taurus-omega/commit/50efd18413cc47935033889e51d58e9c828733e2).
The current sliced/resumable ingest and content-derived IDs are valuable and remain. The unresolved defects are recorded in [`docs/architecture/issues-and-gaps.md`](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/docs/architecture/issues-and-gaps.md):
- **ING-1:** preflight projects windows while the persisted/rebuilt lattice contains windows plus nodes. The recorded fixture projected 284 artifacts but produced 723—about 2.5× the projection.
- **ING-2:** provider `Size == 0` is legal, projects zero windows, and the content reader continues to EOF without an actual-byte cap.
- **ING-4:** typed `project_artifact_limit` errors are flattened by `embedErr` into a generic 502/500-class response.
Preflight estimates can save work, but they cannot be the correctness authority.
## Scope
- Enforce an actual decoded-byte cap while each source is streamed.
- Enforce an actual persisted-artifact budget using windows **and** nodes after source-local construction.
- Make admission transactional or reservation-backed under concurrent ingests.
- Preserve slice checkpoints and idempotent content-derived identity.
- Ensure no committed slice can make Project artifact totals exceed the configured ceiling.
- Surface typed, actionable limit errors consistently through Document, Connector, upload, job, and dev-handler paths.
- Make rebuild memory bounded and validate that configured artifact ceilings correspond to measured memory usage.
- Publish partial-progress semantics when earlier slices committed before a later source is refused.
- Preserve paid embedding usage when a later micro-batch fails, and expose a provider-neutral optional offline batch port for large durable runs.
## Non-goals
- Do not eliminate preflight estimation; make it advisory.
- Do not silently truncate a source and claim it was fully indexed.
- Do not retry deterministic size/artifact refusals automatically.
- Do not load an entire source merely to learn its size.
- Do not weaken limits when provider metadata is absent.
- Do not use an in-process mutex as the correctness authority.
## Governing invariants
1. Provider `Size`, hash, MIME type, and extension are untrusted metadata.
2. Every origin stream is counted while read. `Size == 0`, missing size, too-small size, and growth during read remain safely bounded.
3. The authoritative artifact count is the exact count that would be persisted and rebuilt: Text windows plus lattice nodes for the target generation.
4. A Project-level budget check and the corresponding artifact publication occur in one database transaction or through a durable reservation consumed atomically by commit.
5. Concurrent ingests cannot each observe spare capacity and jointly exceed the ceiling.
6. Replacement admission uses the exact old artifact count for that source/generation and the exact new count. It never subtracts artifacts owned by another source or generation.
7. A refused source leaves the last complete accepted source version authoritative. No half-source projection becomes current.
8. Earlier complete slices may remain committed only when the run reports explicit partial progress and outstanding sources; retrieval never reports the connector/run as fully current.
9. Typed limits retain stable code, limit, actual, subject, retryability, and remediation through every adapter.
10. A corpus rebuild must stay within a separately measured working-memory budget at the maximum accepted artifact count.
11. Paid provider work is accounted even when a multi-chunk embedding call fails after one or more successful chunks.
## Target interfaces
```go
type SourceReadLimits struct {
    MaxEncodedBytes int64
    MaxDecodedBytes int64
    MaxRunBytes     int64
}

type CountedSource struct {
    Reader      io.ReadCloser
    Expected    *int64
    EncodedRead int64
    DecodedRead int64
}

type ArtifactDelta struct {
    ProjectID     string
    Lattice       LatticeKind
    Generation    int64
    SourceID      string
    ReplacesCount int
    AddsWindows   int
    AddsNodes     int
}

type ArtifactBudget interface {
    AdmitAndPublish(
        context.Context,
        ProjectScope,
        ArtifactDelta,
        func(UnitOfWork) error,
    ) (ArtifactCounts, error)
}
```
Provider batching remains outside Knowledge:
```go
type BatchEmbedder interface {
    Submit(context.Context, EmbeddingSpace, []EmbeddingInput) (BatchReceipt, error)
    Status(context.Context, BatchReceipt) (BatchStatus, error)
    Results(context.Context, BatchReceipt, PageCursor) (EmbeddingPage, Usage, error)
    Cancel(context.Context, BatchReceipt) error
}

type PartialEmbeddingError struct {
    CompletedInputs int
    Usage           Usage
    Cause           error
}
```
Synchronous micro-batching remains the fallback. Offline/provider Batch APIs are selected only by durable-job policy and reconcile results by stable custom input ID.
The preflight estimator is explicitly advisory:
```go
type AdmissionEstimate struct {
    EstimatedBytes     int64
    EstimatedWindows   int
    Confidence         string // exact | provider_claim | unknown
}
```
## Refusal contract
```json
{
  "error": {
    "code": "knowledge.project_artifact_limit",
    "message": "This Project cannot hold the indexed artifacts this source produced.",
    "retryable": false,
    "details": {
      "limit": 200000,
      "actual": 200713,
      "subject": "project-id",
      "sourceId": "source-id",
      "artifactClass": "windows_and_nodes",
      "remediation": "Remove indexed content or ask an administrator to raise the Project limit."
    }
  }
}
```
Byte refusals use `knowledge.source_bytes_limit` or `knowledge.run_bytes_limit`. Transport status is chosen once under Ω-010—normally 413 for hard byte limits and 422 or 409 for Project artifact policy—then remains identical across entry points.
## Ordered implementation
1. Reproduce ING-1/2/4 at the frozen SHA and pin fixtures/measurements in the packet evidence.
2. Add actual-byte counting readers around every Document, upload/File, Connector, and future router origin. Apply encoded/decoded/run limits and cancellation.
3. Refactor source-local ingest so it can construct or count the exact candidate windows/nodes before publishing the source version as current. Bound the temporary work by the existing commit-window budget.
4. Add a storage-backed artifact budget transaction/reservation. Compute `current - exact_replaced + exact_added` under write serialization/CAS.
5. Commit candidate artifacts, source version, checkpoint, exact counts, usage, Activity/outbox, and budget consumption atomically per complete source/slice policy.
6. Keep preflight estimates to reject obvious oversize runs before provider/model spend. Unknown estimates never skip authoritative checks.
7. Make corpus rebuild streaming/bounded where possible; otherwise derive a lower hard artifact ceiling from measured peak bytes per artifact plus safety factor.
8. Map `limit.From(err)` before generic embedding/provider error branches in every handler and job projection.
9. Make Intelligence return completed-input count and usage when chunk `N` fails after paid chunks `1..N-1`; persist that usage before retry/refusal.
10. Add an optional `BatchEmbedder` adapter for large durable ingests, with threshold, receipt, cancellation, partial-result reconciliation, rate limits, and cost accounting. Knowledge depends only on the narrow port.
11. Mark deterministic limit failures `retryable=false`; retain explicit run receipt, completed sources, failed source, bytes/artifacts, and safe remediation.
12. Update configuration reference, route/error schema, operational dashboards, baseline matrix, issues register, companions, and change record.
## Failure and concurrency behavior
```plain text
read source
  → counting/decoded-byte guard
  → window + source-local node construction in bounded slices
  → exact ArtifactDelta
  → DB transaction:
       lock/read Project+lattice generation budget
       verify replacement identity and expected source version
       verify new total <= limit
       publish complete candidate slice/source state
       write exact counts/checkpoint/receipt/outbox
  → acknowledge
```
If the final source-local tree cannot be known without processing all windows, retain temporary candidate rows keyed by run/generation and promote them only after exact count admission. Garbage-collect abandoned candidates by durable run state, not wall-clock guessing.
## Security and observability
- Limits are resolved from trusted deployment/entitlement policy, never request fields.
- Errors and metrics contain IDs/counts only; no raw content, prompts, connector URLs, or credentials.
- Metrics: claimed/actual bytes ratio, actual windows/nodes, estimate error, budget contention, refusal code, partial-run count, candidate cleanup, rebuild peak RSS, and limit headroom.
- Alert on provider streams whose actual bytes materially exceed claims and on repeated deterministic refusals.
## Verification
- Exact reproduction fixture: projection 284 vs actual 723 is refused or safely admitted using 723, never 284.
- Unknown `Size == 0`, omitted size, negative/invalid size, too-small claim, growing file, compressed expansion, oversized single line, and never-ending stream tests.
- Two concurrent ingests with individually admissible deltas cannot jointly exceed the Project ceiling.
- Replacement tests subtract only the exact previous source generation.
- Crash at every boundary leaves either old complete source or new complete source, never a current half-source.
- Later-slice refusal leaves explicit partial run state and retrieval/currentness status.
- All HTTP/job/tool entry points preserve stable typed limit fields and never return generic embedding failure for a recognized limit.
- A later synchronous embedding-chunk failure reports and records prior successful-chunk usage; retry does not repay already committed slices.
- Offline batch results reconcile by stable input ID and accurately report missing/failed items and usage.
- Rebuild at configured maximum completes within measured memory budget plus documented safety margin; one over maximum is refused before publication.
- Fuzz/race tests cover counters, arithmetic overflow, cursors/checkpoints, and concurrent replacement.
## Completion evidence
- ING-1, ING-2, and ING-4 are closed in the repository issue register with tests and measurements.
- No origin path can read unbounded bytes.
- No successful commit can place a Project over the actual windows+nodes ceiling.
- Operators and callers receive the same actionable typed refusal everywhere.
## Dependencies and unlocks
Depends on Ω-001. Blocks automatic publication Ω-016, the ingestion router Ω-028, structured/media ingestion Ω-029–Ω-030, and production connector completion Ω-032.
## Sources
- [Frozen issues and gaps](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/docs/architecture/issues-and-gaps.md)
- [Current artifact-limit implementation](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/core/capability/knowledge/artifact_limit.go)
- [Current Knowledge handler error mapping](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/core/handlers/knowledge/knowledge.go)


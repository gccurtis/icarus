---
title: "Work Packet — Ω-003 — Close Knowledge capacity, bounded-read, and refusal safety"
notion_page_id: "3acb6410e50281189f27db1c10eb228d"
notion_url: "https://app.notion.com/3acb6410e50281189f27db1c10eb228d"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:48:42Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-003 — Close Knowledge capacity, bounded-read, and refusal safety

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


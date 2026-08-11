---
title: "Execute Ω-005 — Establish Knowledge embedding-space lifecycle and certification"
packet_id: "Ω-005"
status: "ready-for-execution"
wave: "Wave 0 — Stabilize current truth"
depends_on: "Ω-001, Ω-003, Ω-004"
source_mirror: "docs/current-docs/notion/work-packets/omega-005-establish-knowledge-embedding-space-lifecycle-and-certification.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-005 — Establish Knowledge embedding-space lifecycle and certification

## Mission

make embedding identity and lattice generation explicit Project state, then provide an operator-controlled, durable, atomic re-embed path.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-003, Ω-004**.

Source dependency statement: Ω-001, Ω-003, and Ω-004

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
- `docs/current-docs/notion/work-packets/omega-005-establish-knowledge-embedding-space-lifecycle-and-certification.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
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

Source mirror: `docs/current-docs/notion/work-packets/omega-005-establish-knowledge-embedding-space-lifecycle-and-certification.md`

> **Status:** Queued
> **Wave:** 0 — Stabilize current truth
> **Outcome:** make embedding identity and lattice generation explicit Project state, then provide an operator-controlled, durable, atomic re-embed path.
<callout icon="🧬" color="orange_bg">
	**This packet closes ING-5 and ING-6 and certifies the frozen Text-lattice implementation.** Changing model/provider/vector identity must never create a mixed Project that later makes every retrieval fail. A model change is a planned generation migration, not a side effect of touching one source.
</callout>
## Frozen baseline
Reviewed at [`50efd18413cc47935033889e51d58e9c828733e2`](https://github.com/gccurtis/taurus-omega/commit/50efd18413cc47935033889e51d58e9c828733e2).
The resilient-ingest sequence has already delivered self-contained windows, sliced commits, content-derived artifact IDs, retry-bounded reconciliation, and source/corpus behavior that older Ω-002–Ω-005 drafts were written to implement. Those drafts are obsolete.
The remaining issue register records:
- **ING-5:** content-derived IDs are deterministic only after random Project and Connector IDs; scale/reproducibility fixtures must pin those identities.
- **ING-6:** an untouched source can retain the old embedding identity while a changed source is added under a new identity. Retrieval then detects the mixed space and refuses the whole Project. Repair must be a deliberate full-Project re-embed.
## Scope
- Define canonical embedding-space identity and Project lattice generation state.
- Pin all writes and queries to one active identity/generation.
- Reject implicit identity changes during ordinary source reconciliation.
- Add preview/start/status/pause/resume/cancel/promote/rollback operations for a full Project re-embed.
- Build a shadow generation from current authorized source snapshots, validate it, and atomically promote it.
- Preserve the previous generation for a bounded rollback period.
- Make jobs retryable/idempotent with per-source checkpoints and complete usage/cost accounting.
- Add deterministic scale/regression fixtures with pinned Project, Connector, source, and configuration IDs.
- Review and certify Knowledge retrieval correctness, evidence provenance, deletion/replacement, generation, and recovery.
- Make ranked-candidate hydration generation-consistent and fail closed on missing/corrupt evidence.
- Replace timestamp-only change detection with a durable add/update/remove source-generation cursor.
## Non-goals
- No silent re-embed during ordinary sync.
- No mixed vector identity within one active lattice generation.
- No destructive in-place rewrite of the active generation.
- No claim of cross-model score comparability.
- No automatic promotion based only on job completion.
- No re-embed without explicit authorization, cost/size preview, and audit trail.
- No change to the separate Text, Structured Data, and Media lattice rule.
## Governing invariants
1. Every lattice generation has one immutable embedding identity: provider, model, dimensions, normalization, vector format, and schema/algorithm version.
2. A Project has exactly one active generation per lattice kind.
3. Ordinary ingest embeds with the active generation's identity. Deployment configuration drift does not silently change it.
4. Queries embed with and read only from the active generation.
5. A new identity requires a new shadow generation containing all eligible current sources.
6. Promotion is one atomic pointer/CAS change after completeness and validation gates pass.
7. Failed/cancelled jobs leave the active generation untouched.
8. Source content/version is snapshotted or revision-bound per checkpoint. Changes during migration are replayed/caught up before promotion.
9. Deletion/revocation during migration retracts the source from both active/currentness tracking and the shadow before promotion.
10. Usage, cost, source failures, skipped/unsupported items, validation measurements, actor, and policy are durable and auditable.
11. A retrieval hydrates candidates, sources, windows, and literal evidence from one immutable generation/snapshot or retries/fails with `knowledge.evidence_changed`.
12. Every cited region carries indexed source revision/hash, generation, and contributing window IDs; a current Resource read has separate direct-origin provenance.
13. Add, replace, remove, and withdraw all advance a durable monotonically increasing source-generation cursor.
## Core model
```go
type EmbeddingSpace struct {
    Provider      string
    Model         string
    Dimensions    int
    Normalization string
    VectorFormat  string
    SchemaVersion int
    Algorithm     string
}

func (s EmbeddingSpace) Identity() string {
    // canonical JSON + SHA-256
}

type LatticeGeneration struct {
    ID             string
    ProjectID      string
    Kind           LatticeKind
    SpaceIdentity  string
    State          string // building | validating | ready | active | retired | failed
    SourceWatermark int64
    ArtifactCount  int
    CreatedBy      string
    CreatedAt      time.Time
    PromotedAt     *time.Time
}

type ProjectLatticeState struct {
    ProjectID          string
    Kind               LatticeKind
    ActiveGenerationID string
    Revision           int64
}
```
```go
type ReembedPreview struct {
    ProjectID       string
    Kind            LatticeKind
    FromSpace       EmbeddingSpace
    ToSpace         EmbeddingSpace
    Sources         int
    EstimatedBytes  int64
    EstimatedVectors int
    EstimatedUsage  UsageEstimate
    Unsupported     []SourceSummary
}

type ReembedCommand struct {
    PreviewID      string
    IdempotencyKey string
    ExpectedStateRevision int64
}
```
## Migration flow
```plain text
preview
  → authorize Project administration + model entitlement
  → freeze target EmbeddingSpace identity
  → create shadow generation
  → enumerate current source manifest at watermark
  → source-by-source bounded read/embed/persist/checkpoint
  → catch up source changes after watermark
  → validate completeness, identity, counts, retrieval probes, budgets
  → atomic compare-and-swap promote
  → publish generation-changed outbox event
  → retain previous generation for rollback TTL
  → garbage-collect only after recovery gate
```
Ordinary ingest:
```go
func (k *Knowledge) Add(ctx context.Context, scope ProjectScope, in AddInput) error {
    active, err := k.generations.Active(scope.ProjectID, LatticeText)
    if err != nil { return err }
    embedder, err := k.embedders.ForIdentity(active.SpaceIdentity)
    if err != nil { return ErrEmbeddingSpaceUnavailable }
    return k.ingest.AddToGeneration(ctx, scope, active.ID, embedder, in)
}
```
## Typed failures
```plain text
knowledge.embedding_space_unavailable
knowledge.embedding_space_change_required
knowledge.generation_conflict
knowledge.reembed_preview_stale
knowledge.reembed_incomplete
knowledge.reembed_validation_failed
knowledge.reembed_source_changed
knowledge.reembed_cancelled
knowledge.rollback_expired
knowledge.evidence_changed
knowledge.evidence_corrupt
```
A retrieval identity mismatch in active state is an internal integrity incident, not a caller instruction to “remove and re-add sources.”
## Validation gates
Before promotion:
- every eligible source in the final catch-up manifest is present exactly once;
- no artifact has a different embedding identity/dimension;
- exact source/window/node counts reconcile;
- active access/revocation/deletion policy is applied;
- artifact and byte limits from Ω-003 hold;
- deterministic retrieval probes return grounded evidence from the shadow;
- no cursor/checkpoint points at an absent candidate;
- current source-change cursor has been caught up or promotion CAS fails;
- usage/cost and failure receipts are complete.
## Ordered implementation
1. Reproduce ING-6 and pin the failure as a regression test.
2. Add embedding-space and generation tables/ports. Backfill the existing corpus as generation 1 only after verifying one identity; otherwise mark Project `reembed_required`.
3. Change ordinary ingestion/query to resolve the active generation and its embedder by identity.
4. Reject configured identity drift with a typed administrative status and preserve current retrieval.
5. Implement preview and durable re-embed job state with source manifest/watermark, checkpoints, usage, and idempotency.
6. Build shadow artifacts using Ω-003 bounded admission and content-derived identity scoped to generation.
7. Implement change catch-up, validation, atomic promotion, Project outbox publication, and cache invalidation.
8. Implement bounded rollback to the previous complete generation and safe deferred garbage collection.
9. Make retrieval capture a generation/read token, hydrate every ranked window/source under it, verify `len(text) == end-start`, block/range validity, and source/window presence, then retry once or return a typed integrity error when the token changes.
10. Add immutable evidence provenance and a durable source-generation cursor that advances on removal as well as addition/update.
11. Pin Project/Connector/source IDs and configuration in reproducibility/scale fixtures; record seeds and expected hashes.
12. Run the complete Knowledge certification matrix, close ING-5/6, update operations/runbooks, companions, and change record.
## Security, privacy, and operations
- Preview/start/promote/rollback require explicit Project administration and current admission; workers reauthorize at start and promotion.
- Re-embed reads only caller-/policy-eligible sources and never logs content.
- Provider credentials and model secrets remain infrastructure references.
- Cost preview is advisory; hard token/request/monetary budgets are enforced during the job.
- Rate limits use bounded retry with `Retry-After`; deterministic source/identity failures do not retry forever.
- Metrics: generation state/age, sources completed/remaining, bytes/vectors, validation failures, cost/usage, catch-up lag, promotion/rollback, active-space availability, and integrity incidents.
## Verification
- Untouched old-identity source plus changed source cannot create an active mixed space.
- Configuration/model drift leaves the old generation queryable and reports `embedding_space_change_required`.
- Crash/restart at each source checkpoint, validation, pre-promotion, post-pointer/pre-outbox, and cleanup boundary.
- Concurrent ordinary ingest during re-embed is caught up or makes promotion CAS fail; no change is lost.
- Revocation/delete during re-embed cannot survive into the promoted generation.
- Failed/cancelled/over-budget jobs never change the active pointer.
- Rollback restores the prior complete generation within TTL.
- Every active artifact has exactly the active identity and dimension.
- Pinned scale fixtures reproduce identical source/window/node IDs and lattice hashes across databases.
- Knowledge search quality/evidence tests cover add, replace, delete, connector partial failures, generation switch, cursor staleness, and caller-aware retrieval.
- Concurrent replacement between ranking and hydration never produces empty, shortened, or wrong cited evidence.
- Missing source/window content, invalid overlap arithmetic, invalid block spans, or length mismatch returns `knowledge.evidence_corrupt`; it never emits a partial citation.
- Removal advances the source-generation cursor and invalidates dependent prompt/cache state.
## Completion evidence
- ING-5 and ING-6 are closed with deterministic fixtures and a demonstrated full re-embed.
- No ordinary sync can change a Project's active embedding space.
- Promotion and rollback are atomic and recoverable.
- Knowledge's frozen-head ingest/retrieval behaviors pass one documented certification suite.
## Dependencies and unlocks
Depends on Ω-001, Ω-003, and Ω-004. Blocks production automatic publication, multi-lattice coordination, provider rollout, and release certification.
## Sources
- [Frozen issues and gaps](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/docs/architecture/issues-and-gaps.md)
- [Frozen Knowledge capability](https://github.com/gccurtis/taurus-omega/tree/50efd18413cc47935033889e51d58e9c828733e2/core/capability/knowledge)
- [Frozen resilient-ingest record](https://github.com/gccurtis/taurus-omega/tree/50efd18413cc47935033889e51d58e9c828733e2/docs/superpowers/specs)


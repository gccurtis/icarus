---
title: "Execute Ω-010 — Define redaction, pagination, Activity, and History wire contracts"
packet_id: "Ω-010"
status: "ready-for-execution"
wave: "Wave 0 — Stabilize current truth"
depends_on: "Ω-009"
source_mirror: "docs/current-docs/notion/work-packets/omega-010-define-redaction-pagination-activity-and-history-wire-contracts.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-010 — Define redaction, pagination, Activity, and History wire contracts

## Mission

Publish and implement one stable wire vocabulary for inaccessible resources, bounded lists, Activity provenance, and before/after History details. Alpha and future clients will never infer “restricted” from missing fields, reconstruct change provenance from timestamps, or receive a cursor that becomes invalid because authorization filtering happened after pagination.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-009**.

Source dependency statement: Ω-009

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
- `docs/current-docs/notion/work-packets/omega-010-define-redaction-pagination-activity-and-history-wire-contracts.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/supporting/implementation-workspace-backend--3acb6410e502.md`
- `core/capability/activity/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/document/service_history.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/reference/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/endpoint/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/activity/activity.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/document/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/sqlite_activity.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/backend-guide.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-010-define-redaction-pagination-activity-and-history-wire-contracts.md`

<callout icon="📐" color="blue_bg">
	**Frozen-baseline addendum.** Standardize `limit.From` mapping before generic provider/embedding branches, including `knowledge.project_artifact_limit`, source/run byte limits, partial embedding usage, `knowledge.evidence_changed`, and `resource.version_changed`. Resource list/read cursors bind caller, Project, kind, stable ID, projection, immutable version, line position, and policy version; they remain usable beyond the current uncursored 200-source ceiling.
</callout>
## Outcome
Publish and implement one stable wire vocabulary for inaccessible resources,
bounded lists, Activity provenance, and before/after History details. Alpha and
future clients will never infer “restricted” from missing fields, reconstruct
change provenance from timestamps, or receive a cursor that becomes invalid
because authorization filtering happened after pagination.
## As-built evidence
Current endpoints use several implicit behaviors. Direct document denial returns
`403`; collection filtering often drops rows; Alpha prefers an explicit
`redacted` representation in relationship/activity surfaces. Activity persists
`source_kind` and `source_id`, including a uniqueness constraint, but its public
JSON omits them. Document forward operations expose new values, while inverse
operations containing prior text are private persistence state. Alpha currently
matches Activity to change sets by timestamp and walks up to 12 earlier changes
to reconstruct prior text.
Ω-009 makes the internal read decisions authoritative. This packet defines how
those decisions appear on the wire without leaking identity.
## Scope
- Define by-id denial semantics.
- Define omission versus redacted-sentinel rules per collection type.
- Make pagination authorization-safe and bounded.
- Serialize Activity source provenance when visible.
- Add a public History effect projection with safe before/after values.
- Version and document cursor, error, redaction, Activity, and History schemas.
- Update backend guide and transport contract tests.
## Non-goals
- No new Activity event categories for workspace navigation.
- No general audit-log product.
- No exposure of raw `InverseOps`.
- No unbounded “all history” endpoint.
- No frontend lens implementation.
## Wire decisions
Use three distinct cases:
1. **Direct by-id read:** inaccessible is `404 resource.not_found`, preventing
	identifier probing. A write may use the same response.
2. **Primary catalogs/search:** omit inaccessible rows. Fill the requested page
	from the underlying ordered scan before returning; cursor advancement follows
	the scanned boundary, not the visible count.
3. Relationship or semantic history streams where an event/edge exists
	independently of the hidden identity: retain position using an explicit
	sentinel:
```json
{
  "redacted": true,
  "resource": null
}
```
Do not return a stable hidden id, kind, name, access rule, or metadata. Whether
even the event's existence is safe is endpoint-specific; default to dropping it
when the relationship itself is sensitive.
## Representative contracts
```json
{
  "events": [
    {
      "id": "evt_visible",
      "action": "edited",
      "target": {"id":"doc_1","kind":"document","name":"Plan"},
      "source": {"kind":"document.change_set","id":"cs_12"},
      "occurredAt": "2026-07-29T22:38:02Z"
    },
    {
      "id": "evt_opaque",
      "action": "edited",
      "target": {"redacted": true},
      "source": null,
      "occurredAt": "2026-07-29T22:39:02Z"
    }
  ],
  "nextCursor": "opaque"
}
```
```json
{
  "id": "cs_12",
  "effects": [
    {
      "kind": "text_changed",
      "address": {"rowId":"r1","blockId":"b1","atomId":"a1"},
      "before": "Draft",
      "after": "Quarterly outline",
      "beforeAvailable": true
    }
  ]
}
```
History effects are derived public data. When history pruning prevents recovery,
return `beforeAvailable:false` and omit `before`; never use an empty string to
mean “unknown.”
## Likely paths
- `core/endpoint/`
- `core/handlers/activity/activity.go`
- `core/capability/activity/`
- `core/capability/document/service_history.go`
- `core/handlers/document/`
- `core/capability/reference/`
- `core/capability/resource/`
- `core/platform/storage/sqlite/sqlite_activity.go`
- `docs/backend-guide.md`
## Ordered implementation
1. Write a wire-contract document and golden JSON fixtures before code changes.
2. Add a shared public error code and redacted-resource envelope. Keep domain
	authorization results separate from HTTP representation.
3. Convert by-id access denial to non-enumerating `404` consistently.
4. Implement authorization-aware cursor fill loops with a bounded scan multiplier
	and forward progress even when an entire segment is denied.
5. Serialize Activity `sourceKind`/`sourceID` only when the source is visible;
	preserve the existing one-event-per-change-set invariant.
6. Add a History projector that derives semantic effects from forward/inverse
	operations inside the Document capability. Do not serialize private inverse
	operations wholesale.
7. Apply sentinel/drop policy to Activity, references/backlinks, resolved
	Contexts, sessions/presence, notifications, and overview projections.
8. Update Alpha-facing backend guide, contract fixtures, completion matrix,
	companions, and record.
## Security, concurrency, persistence, and observability
Opaque cursors must be signed or store-independent encoded values that cannot be
edited into another Project/query. Bind a cursor to Project, caller-access
revision or conservative scan boundary, endpoint, filter, sort, and limit.
Redaction must happen before request logging and serialization. History
before/after computation uses one coherent document revision snapshot.
Track scan-to-visible ratios and redaction counts to detect pathological pages,
but never label metrics with resource ids or names.
## Tests and gates
- Golden wire fixtures and backward-compatibility assertions.
- Pages containing 0%, 50%, and 100% denied rows; no duplicates or skips among
	allowed rows across cursors.
- Cursor tampering, cross-Project reuse, filter mismatch, and expiry tests.
- Direct denied id returns indistinguishable 404.
- Activity source id maps exactly to the change set without timestamp inference.
- History insert/edit/delete and pruned-history effect tests.
- Redaction snapshots prove no hidden id/name/kind is present in bytes.
- Standard repository gates and Alpha contract smoke test.
## Completion evidence
- Backend guide names one behavior for each endpoint family.
- Alpha no longer performs security redaction or timestamp matching.
- Pagination remains correct under dense denials.
- History renders honest before/after without exposing private compensation data.
## Dependencies
Depends on Ω-009. Blocks Ω-011, Ω-014, Ω-017, Ω-018, and later conversion
workers that report partial imports.
## Sources
- [Alpha access-enforcement request](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/resource-access-enforcement.md)
- [Alpha change-detail fallback commit](https://github.com/gccurtis/taurus-alpha/commit/90d15f1db678be7fbc2068f12a3701b62786ce0d)
- [Omega Activity storage](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/activity)
- [Implementation — Workspace Backend](https://app.notion.com/p/3acb6410e5028138917ff768d9776e8e)


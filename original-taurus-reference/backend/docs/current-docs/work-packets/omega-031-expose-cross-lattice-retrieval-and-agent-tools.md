---
title: "Execute Ω-031 — Expose cross-lattice retrieval and Agent tools"
packet_id: "Ω-031"
status: "ready-for-execution"
wave: "Wave 3 — Complete ingestion, retrieval, and connectors"
depends_on: "Ω-009, Ω-014, Ω-019, Ω-028, Ω-029, Ω-030"
source_mirror: "docs/current-docs/notion/work-packets/omega-031-expose-cross-lattice-retrieval-and-agent-tools.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-031 — Expose cross-lattice retrieval and Agent tools

## Mission

Agents and supported clients can search Text, Structured Data, and Media through one caller-aware application coordinator while each lattice performs its own embedding, descent, score interpretation, result hydration, and authorization. Text results return exact cited regions. Structured and Media results return descriptors plus opaque handles, followed by explicit exact-artifact read/open tools. Raw similarity scores from different vector spaces are never compared.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-009, Ω-014, Ω-019, Ω-028, Ω-029, Ω-030**.

Source dependency statement: Ω-009, Ω-014, Ω-019, Ω-028–Ω-030.

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
- `docs/current-docs/notion/work-packets/omega-031-expose-cross-lattice-retrieval-and-agent-tools.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/knowledge/retrieve.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/agent_*` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-031-expose-cross-lattice-retrieval-and-agent-tools.md`

<callout icon="🔎" color="blue_bg">
	**Frozen-baseline ownership correction.** This packet owns cross-lattice **search**, grouping, hydration, and evidence policy. It consumes Ω-002/Ω-015 Resource exact-read ports; it must not re-create canonical Text/Resource read tools inside Knowledge or Retrieval. Text evidence identifies immutable indexed generation/revision/hash/window IDs. Structured/Media descriptors remain discovery metadata and their exact handles are independently authorized and version-bound.
</callout>
**Type:** Supporting  
**Wave:** 3 — Complete ingestion, retrieval, and connectors  
**Gate:** Project Backend Complete  
**Depends on:** Ω-009, Ω-014, Ω-019, Ω-028–Ω-030  
**Unblocks:** complete grounded Agent/Chat/Prompt workflows
## Outcome
Agents and supported clients can search Text, Structured Data, and Media through
one caller-aware application coordinator while each lattice performs its own
embedding, descent, score interpretation, result hydration, and authorization.
Text results return exact cited regions. Structured and Media results return
descriptors plus opaque handles, followed by explicit exact-artifact read/open
tools.
Raw similarity scores from different vector spaces are never compared.
## Current evidence
Knowledge retrieval accepts Project ID but not caller identity and is exposed
mostly through internal Agent/Chat/Prompt adapters and `/dev/knowledge`.
Structured/Media do not yet exist at baseline. Existing Agent document access
has a narrower Resource authorization adapter, but Knowledge evidence hydration
is caller-blind until Ω-009.
## Before and after
```plain text
core/application/retrieval/
  coordinator.go policy.go grouping.go pagination.go evidence.go errors.go
core/wiring/retrieval_tools.go
core/handlers/retrieval/

RetrievalCoordinator
  ├── TextSearchPort
  ├── StructuredSearchPort + StructuredReadPort
  └── MediaSearchPort + MediaOpenPort
```
## Scope
- Caller-aware typed search APIs and Agent tools.
- Parallel independent lattice retrieval under one overall budget.
- Grouped results and optional ordinal rank fusion.
- Exact Structured read and Media open operations.
- Stable evidence/citation/provenance envelopes.
- Context/source filters, pagination, budgets, redaction, telemetry.
## Non-goals
- No joint vector space or direct image-vector search.
- No descriptor-only grounding for table values or visual claims.
- No arbitrary SQL over structured artifacts.
- No media editing, audio/video, or public unauthenticated search.
- No user-level cross-Project search in V1.
## Governing invariants
1. Trusted Project/caller/role enter through execution context, never tool
	arguments.
2. Each lattice embeds and ranks within its own declared vector identity.
3. Cross-lattice output is grouped, or fused by rank position with a documented
	algorithm such as RRF; raw cosine/distance values are never compared.
4. Every candidate is authorized before inclusion and every artifact is
	re-authorized before hydration.
5. Text evidence returns literal text and locators.
6. Structured/Media descriptors are clearly labeled generated discovery
	metadata.
7. A grounded structured claim requires `read_structured_artifact`; a grounded
	visual claim requires `open_media_artifact`.
8. Pagination cursors bind Project, caller-access policy version, filters,
	lattice generation, and sort mode.
9. Revocation between search and read blocks hydration.
10. Budgets cap query bytes, lattices, candidates, hydrated bytes, tool calls,
	duration, and provider usage.
## Typed API
```go
type SearchRequest struct {
    Query   string
    Kinds   []LatticeKind
    Filters RetrievalFilters
    Limits  RetrievalLimits
    Cursor  string
}

type SearchResponse struct {
    Text       []TextMatch
    Structured []StructuredMatch
    Media      []MediaMatch
    NextCursor string
    Generations map[LatticeKind]int64
}

type StructuredMatch struct {
    Handle      string
    Descriptor  StructuredDescriptorSummary
    Source      SourceCitation
    Rank        int
    ScoreWithinLattice float32
}
```
Recommended Agent functions:
```plain text
search_text(query, filters, limit)
search_structured_data(query, filters, limit)
read_structured_artifact(handle, rows, columns)
search_media(query, filters, limit)
open_media_artifact(handle)
search_project_sources(query, kinds, filters, per_kind_limit)
```
`search_project_sources` returns groups. If a compact mixed list is needed,
Reciprocal Rank Fusion uses only ordinal ranks:
```plain text
rrf(item) = Σ 1 / (k + rank_in_lattice)
```
The response still identifies the source lattice and descriptor/evidence class.
## HTTP surface
```javascript
POST /retrieval/search
POST /retrieval/text
POST /retrieval/structured
POST /retrieval/media
GET  /retrieval/structured/:handle
GET  /retrieval/media/:handle
```
Handles are signed/opaque, short-lived or revision-bound references—not raw
storage keys.
## Ordered implementation tasks
1. Freeze request/result/evidence/handle/cursor/budget/error schemas.
2. Implement caller-aware Text port after Ω-009 and conformance tests.
3. Add Structured and Media search/hydration ports.
4. Implement parallel coordinator with cancellation and per-lattice budgets.
5. Add grouped results and optional RRF; prohibit raw cross-score sort in code
	review/static tests.
6. Add opaque handle signing/validation, exact reads, authorization, redaction,
	pagination, and stale-generation behavior.
7. Register Agent/Chat/Prompt tools through wiring and enforce tool budgets.
8. Add transport, telemetry, negative-security, load, grounded-response, and live
	E2E tests.
## Security, concurrency, jobs, and observability
- Search filters are intersected with caller access; they never broaden it.
- Undisclosing errors prevent existence leaks for inaccessible sources.
- Hydration enforces row/image byte limits and safe content disposition.
- Query embedding can run concurrently by lattice under an overall semaphore;
	one lattice failure yields typed partial status only when policy permits.
- Retrieval is normally inline and bounded; it is not a durable job. Agent Runs
	persist the chosen evidence snapshot.
- Emit latency/candidates/hydration bytes per lattice, filtered result count,
	generation, embedding usage/cost, partial/failure code, tool sequence, and
	revocation blocks. Never log query/source content by default.
## Verification
- Independent-lattice ranking and explicit test that raw scores cannot drive
	mixed order.
- Authorization at candidate and hydration, including mid-flow revocation.
- Descriptor result cannot be serialized as literal evidence.
- Cursor tamper/staleness/access-policy change.
- Prompt-injection content cannot alter trusted tool scope.
- Load and cancellation across three concurrent searches.
- Agent E2E: search descriptor, read exact table; search image, open image; cite
	text region; produce a response whose evidence chain is auditable.
## Migration and rollback
Add coordinator and tools beside current Knowledge adapters, then switch Agent,
Chat, and Prompt consumers one at a time. Keep old internal Text tool only until
parity and authorization are proven. Rollback restores caller-aware Text-only
retrieval; Structured/Media data remains independently persisted.
## Completion evidence
- Conformance and negative-security matrices are green for all ports.
- Mixed-search tests prove no cross-vector comparison.
- Grounding E2E demonstrates descriptor → exact artifact two-step use.
- Agent/Chat/Prompt live suites use only the new coordinator.
## Sources
- Taurus Yesod Design — Multi-lattice ingestion
- Model — Structured Data capability
- Model — Media capability
- `core/capability/knowledge/retrieve.go`
- `core/wiring/agent_*`
- Ω-009 and Ω-028–Ω-030
---


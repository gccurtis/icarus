---
title: "Execute Ω-009 — Make Project reads and retrieval evidence caller-aware"
packet_id: "Ω-009"
status: "ready-for-execution"
wave: "Wave 0 — Stabilize current truth"
depends_on: "Ω-001, Ω-006"
source_mirror: "docs/current-docs/notion/work-packets/omega-009-make-project-reads-and-retrieval-evidence-caller-aware.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-009 — Make Project reads and retrieval evidence caller-aware

## Mission

Make unauthorized Project data impossible to obtain through a read capability, relationship edge, presence record, activity target, resolved Context, or Knowledge citation. Caller identity and organization reach become mandatory inputs to every Project read that can reveal resource identity or content. Authorization moves from handler memory into typed capability contracts and fails closed on resolver errors.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-006**.

Source dependency statement: Ω-001 and Ω-006 for safe Document values

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
- `docs/current-docs/notion/work-packets/omega-009-make-project-reads-and-retrieval-evidence-caller-aware.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-enterprise-control-plane--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-identity-organization-project-ownership-and-access--3acb6410e502.md`
- `core/capability/activity/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/agent/tool_knowledge.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/contexts/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/document/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/knowledge/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/notification/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/reference/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/session/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/*` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/middleware.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/*access*.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-009-make-project-reads-and-retrieval-evidence-caller-aware.md`

<callout icon="🔐" color="red_bg">
	**Frozen-baseline addendum.** Caller-aware scope applies to both semantic retrieval and Ω-002 exact Resource reading. Current Agent/Knowledge tools close over Project ID without requesting User ID and can therefore bypass Resource `AccessScope`. Require trusted `UserID + ProjectID + role/admission`, authorize before candidate loading and before final hydration/origin I/O, reauthorize continuations, and make inaccessible names, best-match windows, traces, citations, and errors undisclosing. Scope store reads by Project as defense in depth.
</callout>
## Outcome
Make unauthorized Project data impossible to obtain through a read capability,
relationship edge, presence record, activity target, resolved Context, or
Knowledge citation. Caller identity and organization reach become mandatory
inputs to every Project read that can reveal resource identity or content.
Authorization moves from handler memory into typed capability contracts and
fails closed on resolver errors.
## As-built evidence
Omega correctly establishes Project membership at the transport gate and
re-scopes records by Project in capabilities. It also has sound primitives in
`resource.Resources`: `CanAccessResource` and `FilterAccessible`.
`documentAccessGuard` protects direct routes containing `:documentID`, and
Document list filtering has already improved.
The remaining class is intra-Project disclosure through response bodies:
Activity, sessions, resolved Contexts, references/backlinks, revision hints,
templates, notifications, and future composite projections can name resources
that a caller cannot open. Current read signatures often accept only
`projectID` or `Scope{ProjectID}`. Retrieval introduces the highest-impact
version: project-wide Knowledge may contain text from a restricted source unless
evidence is filtered against the caller before ranking/tool return.
## Scope
- Introduce one caller-aware Project read scope.
- Add a batch authorization port over resource identities.
- Convert all Project read capability signatures that can reveal resource
	identity, metadata, relationships, presence, or content.
- Filter Knowledge entry frontiers, regions, citation resolution, and Agent
	`knowledge.search` tool results by caller-visible origins.
- Fail closed when access metadata or authorization resolution fails.
- Preserve direct Project isolation and storage-level Project predicates.
- Add negative-security tests for every converted surface.
## Non-goals
- Wire redaction and cursor representation; Ω-010 defines public shapes.
- Replace the membership/grant model or complete enterprise Organizations.
- Create user-level libraries.
- Encrypt the database or introduce row-level security external to SQLite.
- Re-embed content when access changes; access is evaluated at query time.
## Invariants
1. A Project read that can name or return a resource cannot be called without a
	caller scope.
2. Unknown access and resolver failure mean deny, never allow.
3. Access checks cover both ends of references/backlinks and every origin behind
	a resolved Context.
4. Ingestion may remain Project-wide; retrieval and citation emission are
	caller-aware at query time.
5. A shared persona, Context, or future library asset never grants access to
	Project content by association.
6. Authorization filtering happens before content reaches an Agent/model.
7. Batch checks avoid a new N+1 query pattern.
## Representative interfaces
```go
type ReadScope struct {
    ProjectID    string
    CallerID     string
    CallerOrgIDs []string
}

type ResourceRef struct {
    Kind string
    ID   string
}

type AccessDecision struct {
    Ref     ResourceRef
    Allowed bool
}

type ResourceAuthorizer interface {
    AuthorizeBatch(ctx context.Context, scope ReadScope, refs []ResourceRef) ([]AccessDecision, error)
}
```
Knowledge artifacts require traceable origin:
```go
type EvidenceOrigin struct {
    ResourceKind string
    ResourceID   string
    SourceID     string
}

func (k *Knowledge) Retrieve(ctx context.Context, scope ReadScope, q Query) (Result, error)
```
Every returned region must carry an origin that can be authorized. Legacy rows
without an origin are ineligible until backfilled; do not assume Project-wide
means visible to every member.
## Likely paths
- `core/capability/resource/`
- `core/capability/document/`
- `core/capability/activity/`
- `core/capability/session/`
- `core/capability/contexts/`
- `core/capability/reference/`
- `core/capability/notification/`
- `core/capability/knowledge/`
- `core/capability/agent/tool_knowledge.go`
- `core/handlers/*`
- `core/wiring/*access*.go`
- `core/platform/storage/sqlite/`
## Ordered implementation
1. Build a route/read inventory from Ω-001 and add failing leak tests for
	Activity, backlinks, resolved Contexts, sessions, and Knowledge retrieval.
2. Introduce `ReadScope` in a neutral Project-boundary package or as a
	capability-owned value that does not create imports between leaf
	capabilities.
3. Add a batch authorizer adapter in wiring over Resource access primitives.
	Implement a set-based SQLite read for access records.
4. Convert Resource and Document list/point projections first; remove handler
	filters only after capability enforcement tests pass.
5. Convert Activity, session/presence, Context resolution, references/backlinks,
	notifications, revision hints, and template lists.
6. Add resource origin to Knowledge sources/windows where absent. Backfill
	document and connector origins idempotently.
7. Filter the Knowledge frontier before scoring/descent where possible, and
	re-check every final region before returning it. The second check protects
	against access changes during retrieval.
8. Pass caller-aware scope through Ask retrieval planning and tools. Assert that
	denied text never appears in model context or tool traces.
9. Update all compile-broken call sites, companions, architecture, baseline, and
	record.
## Security, concurrency, persistence, and observability
Use one access snapshot per read where possible, but perform a final check before
content emission if the request spans model latency. Access changes racing a
read may conservatively remove data; they must never add it without a positive
decision. Cache only decisions keyed by caller, Project, resource, and access
revision with a short request lifetime—not process-global membership.
Log counts (`candidates`, `allowed`, `denied`) and codes, never denied names or
content. A store failure returns a typed internal error and an empty result to
the caller; it cannot downgrade to “project member therefore allowed.”
## Tests and gates
- Compile-time conversion of every inventoried read signature.
- Negative transport tests with owner, allowed member, denied member, and
	non-member.
- Backlink test where the hidden resource is the opposite edge.
- Context test with nested include/exclude and one denied leaf.
- Session/presence test hiding document id, caret, and selection.
- Knowledge test proving a semantically best but denied window is never scored,
	returned, cited, or sent to the model.
- Access-change-during-retrieval race test.
- Batch-query count/performance assertion.
- `go test -race` for converted packages and standard gates.
## Completion evidence
- No Project content-bearing read exists without caller scope.
- Alpha's restricted Activity reproduction no longer sends the name to the
	browser.
- Restricted Knowledge evidence is absent end to end.
- Denial and resolver-failure tests cover every surface in the baseline matrix.
## Dependencies
Depends on Ω-001 and Ω-006 for safe Document values. Blocks Ω-010, Ω-015 through
Ω-019, and every future resource family.
## Sources
- [Alpha access-enforcement request](https://github.com/gccurtis/taurus-alpha/blob/aee846567e77d5bc13b264479fd19d2994babbc0/docs/backend-requests/resource-access-enforcement.md)
- [Omega middleware](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/transport/middleware.go)
- [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
---


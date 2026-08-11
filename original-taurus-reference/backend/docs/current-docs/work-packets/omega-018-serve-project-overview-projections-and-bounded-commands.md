---
title: "Execute Ω-018 — Serve Project Overview projections and bounded commands"
packet_id: "Ω-018"
status: "ready-for-execution"
wave: "Wave 1 — Close the Project runtime"
depends_on: "Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015"
source_mirror: "docs/current-docs/notion/work-packets/omega-018-serve-project-overview-projections-and-bounded-commands.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-018 — Serve Project Overview projections and bounded commands

## Mission

Give Alpha one caller-aware backend surface for the Project Overview screen, Context-panel lenses, and Inspector selections without moving enterprise identity/Organization/entitlement ownership into the Project execution plane. The default response is a small, coherent projection of Project identity, Project-local brief, Resource summaries, recent/pinned work, Activity, active Task/Run state, and synchronization hints. Larger collections keep their own bounded cursor endpoints. Add only the Project-local commands the Overview owns—updating its working brief and managing Project pins (if enabled by the current Alpha contract). Resource lifecycle, access administration, Organization membership, Project ownership, license, and settings remain in their authoritative capabilities/routes.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015**.

Source dependency statement: Ω-009 through Ω-015 and consumes Ω-019 Task summaries when available.

Later integration or re-certification references in that source section: **Ω-019**. These are not start blockers; implement the packet against its declared ports and leave the production adapter or downstream certification to those later packets.

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
- `docs/current-docs/notion/work-packets/omega-018-serve-project-overview-projections-and-bounded-commands.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-enterprise-control-plane--3acb6410e502.md`
- `docs/current-docs/notion/primary/architecture-user-cell-and-project-subcell-runtime--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-identity-organization-project-ownership-and-access--3acb6410e502.md`
- `docs/current-docs/notion/primary/workstreams-taurus-product-completion--3acb6410e502.md`
- `core/capability/access/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/activity/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/agent/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/projectoverview/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/workspace/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/projectoverview/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/sqlite_project_overview*.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/routes.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `dev-test/project-overview/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-018-serve-project-overview-projections-and-bounded-commands.md`

## Outcome
Give Alpha one caller-aware backend surface for the Project Overview screen,
Context-panel lenses, and Inspector selections without moving enterprise
identity/Organization/entitlement ownership into the Project execution plane.
The default response is a small, coherent projection of Project identity,
Project-local brief, Resource summaries, recent/pinned work, Activity, active
Task/Run state, and synchronization hints. Larger collections keep their own
bounded cursor endpoints.
Add only the Project-local commands the Overview owns—updating its working brief
and managing Project pins (if enabled by the current Alpha contract). Resource
lifecycle, access administration, Organization membership, Project ownership,
license, and settings remain in their authoritative capabilities/routes.
## As-built evidence
Alpha has a Project Overview route plus Context and Inspector panel mocks/work
requests, while Omega exposes the underlying capabilities separately. Resource,
Activity, Agent, access, Context, and Project metadata can therefore be fetched,
but there is no versioned composite projection defining snapshot coherence,
redaction, independent pagination, lens selection payloads, or which commands
actually belong to Overview.
The new architecture separates the Enterprise Control Plane from Project
execution. Project name/owner/organization/grants/entitlements are control-plane
facts supplied through a narrow port or local modular adapter in the initial
monolith. Overview may display a caller-safe snapshot but must not become a
second authority for them.
## Scope
- Freeze the Overview projection and its mapping to current Alpha panels/lenses.
- Add a small default composite endpoint with strict per-section limits.
- Provide separate cursor endpoints for full Resources, Activity, and Task/Run
	lists instead of unbounded expansion.
- Define caller-safe counts, recent items, pinned items, active jobs/tasks,
	publication/sync warnings, and revision/ETag hints.
- Add a Project-local working brief/purpose field if Alpha's screen edits it.
- Add typed pin/unpin/reorder commands only if pins are Project-shared; otherwise
	model personal favorites as Workspace/user state and omit Project commands.
- Use Ω-010 redaction and Ω-009 caller-aware reads throughout.
- Add cache/recompute, event invalidation, and deterministic backend E2E.
## Non-goals
- No Organization administration, member/grant editing, billing, license, or
	entitlement mutation.
- No user settings or user-level library management.
- No giant “fetch the entire Project” endpoint.
- No duplicate Resource create/rename/trash endpoints.
- No frontend layout, card, icon, or animation decisions.
- No analytics warehouse or long-term audit dashboard.
- No hidden-resource counts that reveal more than the caller could enumerate.
## Projection contract
```go
type ProjectOverview struct {
    Project       ProjectIdentityProjection
    Brief         ProjectBrief
    Resources     ResourceOverviewPage
    Activity      ActivityPage
    Tasks         TaskOverviewPage
    Health        []ProjectHealthNotice
    Lenses        []LensDescriptor
    Revision      string
    GeneratedAt   time.Time
}

type ProjectIdentityProjection struct {
    ID               string
    Name             string
    OrganizationName string
    CallerRole       string
    Capabilities     []string
}

type ResourceOverviewPage struct {
    VisibleCounts map[string]int
    Recent        []ResourceProjection
    Pinned        []ResourceProjection
    NextCursor    string
}
```
Counts are computed over caller-visible rows, not total Project rows. If an exact
visible count is too expensive, return an explicit lower-bound/unknown shape
rather than the hidden total.
```go
type Count struct {
    Value    int
    Accuracy string // exact, lower_bound, unknown
}
```
Recommended endpoint surface:
```plain text
GET   /projects/:projectID/overview
GET   /projects/:projectID/overview/resources?cursor=&limit=
GET   /projects/:projectID/overview/activity?cursor=&limit=
GET   /projects/:projectID/overview/tasks?cursor=&limit=
PATCH /projects/:projectID/overview/brief
POST  /projects/:projectID/overview/pins
DELETE /projects/:projectID/overview/pins/:resourceID
```
Do not add pin routes until ownership is resolved. If pins represent an
individual's shortcuts, store them in Workspace and project them here through
the caller's Workspace.
## Lens mapping
Backend lens descriptors are stable identifiers and capabilities, not visual
instructions:
- `project.details` — caller-safe Project identity, Project-local brief,
	timestamps, and permitted commands;
- `project.resources` — visible family counts, recent/pinned Resources, search/
	list cursor link;
- `project.activity` — Ω-010 Activity projection and next cursor;
- `project.tasks` — Project Agent/Task summaries, needs-user/running/failed
	counts, and detail links;
- `project.health` — actionable Project-level publication, connector, or job
	failures the caller may see.
The Inspector selection for a Resource/Activity/Task item returns its canonical
capability projection or link, not a copied unbounded object inside Overview.
## Likely paths
- `core/capability/projectoverview/` or the repository's projection convention
- `core/handlers/projectoverview/`
- `core/capability/resource/`
- `core/capability/activity/`
- `core/capability/agent/`
- `core/capability/workspace/`
- `core/capability/access/`
- Enterprise Control Plane port/adaptor in `core/wiring/`
- `core/platform/storage/sqlite/sqlite_project_overview*.go`
- `core/transport/routes.go`
- `dev-test/project-overview/`
## Ordered implementation
1. Compare Alpha's current Overview, Context panel, and Inspector request shapes
	with Ω-001's available Omega projections. Freeze a field/owner/access/source/
	limit/cursor matrix. Mark enterprise-owned fields read-only.
2. Define `ProjectIdentityPort` that supplies caller-safe control-plane facts to
	the Project façade. Implement it over the current monolith without importing
	Organization/access internals into the Overview capability.
3. Define default section limits, independent cursors, count accuracy,
	consistency rules, ETag/revision, typed health notices, and lens ids. Write
	golden JSON before code.
4. Build each section from Ω-009 caller-aware query ports. Use one SQLite read
	transaction/snapshot for locally stored sections where practical and report
	a revision vector when control-plane identity is from another snapshot.
5. Implement the small composite with parallel bounded reads, shared
	cancellation/deadline, deterministic section order, and explicit partial
	failure policy. Prefer a typed unavailable section over failing unrelated
	sections, except authorization/scope failure fails the entire request.
6. Implement full per-section cursor endpoints using Ω-010 contracts. Do not
	embed subsequent pages in the composite.
7. Add Project-local brief persistence with revision CAS, size/format limits,
	edit authorization, Activity source, and Project event if the product owns
	that field. Otherwise omit the command rather than writing control-plane
	metadata from the execution plane.
8. Resolve pin ownership. Implement Project-shared pins with edit authority,
	stable ordering, missing/trashed cleanup, and limits; or adapt caller
	Workspace favorites read-only. Document the decision.
9. Add event-driven cache invalidation keyed by Project and caller access
	revision. Cache only bounded projections; never cache one caller's redacted
	result for another.
10. Update Alpha contract fixtures, backend guide, companions, completion
	matrix, and change record.
## Security, concurrency, persistence, and observability
All sections run with the same `ProjectScope`; no subquery is allowed to
downgrade to Project-only scope. Counts, warnings, names, and source ids can all
leak hidden resources and therefore pass the same filter. Project admin/custody
does not automatically imply content access where the enterprise model separates
them.
Brief/pin mutations use expected revision and idempotency. Composite reads are
bounded by deadline and work budget; a slow section cannot spawn unbounded
queries or goroutines. Cache keys include caller/access revision, Project,
requested sections, and relevant projection revisions.
Metrics include overall/section latency, partial section code, rows scanned/
visible, cache result, payload bytes, and count accuracy with bounded labels.
Logs do not contain brief content, Resource names, Task objectives, or hidden
warning detail.
## Tests and gates
- Golden Overview and lens descriptors for owner/editor/viewer/denied caller.
- Hidden Resources do not affect names, counts, recent/pinned lists, Activity,
	Tasks, Health, ETag differences visible to the caller, or response bytes.
- Independent cursor correctness under dense denial.
- Control-plane adapter unavailable/stale and local section partial-failure
	policy.
- Brief validation/CAS/idempotency/access and pin ownership/order/limits if
	implemented.
- Concurrent Resource/Activity/Task changes produce coherent revision hints and
	invalidate the right cache only.
- Load test enforces query count, deadline, payload, and allocation budgets.
- Backend E2E across restart and two callers with different resource grants.
- Race detector and standard repository gates.
## Completion evidence
- Alpha can render and refresh every Project Overview panel from documented
	backend projections.
- The default endpoint is bounded and has no N+1 authorization pattern.
- Enterprise-owned fields are never mutated through Overview.
- Hidden Project content leaves no identifying or count side channel.
- Every Overview command has one authoritative owner and deterministic evidence.
## Dependencies
Depends on Ω-009 through Ω-015 and consumes Ω-019 Task summaries when available.
It can land initially with an empty/typed-unavailable Task section, then must be
re-certified after Ω-019. Blocks the Project Overview Alpha integration and the
final backend demonstration.
## Sources
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Workstreams — Taurus Product Completion](https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd)
- [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf)
---


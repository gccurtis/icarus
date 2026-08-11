---
title: "Execute Ω-011 — Make Project scope explicit per request"
packet_id: "Ω-011"
status: "ready-for-execution"
wave: "Wave 1 — Close the Project runtime"
depends_on: "Ω-009, Ω-010"
source_mirror: "docs/current-docs/notion/work-packets/omega-011-make-project-scope-explicit-per-request.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-011 — Make Project scope explicit per request

## Mission

Replace the session-selected Project as an implicit backend authority with an explicit, immutable Project scope on every Project operation. Authentication establishes who the caller is. The route establishes which Project the caller is addressing. A fresh authorization decision establishes what that caller may do there. No capability infers its Project from mutable session state. This is the execution-plane boundary on which the rest of Omega is completed. Two clients, two browser tabs, background jobs, and future service callers can operate in different Projects without changing a shared “selected Project.” Alpha may retain a selected-Project preference for navigation, but that preference has no authority over backend reads or writes.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-009, Ω-010**.

Source dependency statement: Ω-009 and Ω-010 for caller-aware reads and wire behavior

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
- `docs/current-docs/notion/work-packets/omega-011-make-project-scope-explicit-per-request.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-enterprise-control-plane--3acb6410e502.md`
- `docs/current-docs/notion/primary/architecture-taurus-layered-application-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/architecture-user-cell-and-project-subcell-runtime--3acb6410e502.md`
- `core/capability/access/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/session/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/dispatch.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/middleware.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/routes.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/wiring.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/architecture/runtime-model.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
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

Source mirror: `docs/current-docs/notion/work-packets/omega-011-make-project-scope-explicit-per-request.md`

<callout icon="🧭" color="purple_bg">
	**Frozen-baseline addendum.** Current sessions still store one mutable selected Project, which is incompatible with one User Cell holding several simultaneous Project Subcells. Remove selected Project as an authorization authority. Every Project route/tool/job names Project explicitly and performs current admission; “selected Project” may remain Workspace/navigation state only. Prove two open Projects in one authenticated session cannot retarget each other.
</callout>
## Outcome
Replace the session-selected Project as an implicit backend authority with an
explicit, immutable Project scope on every Project operation. Authentication
establishes who the caller is. The route establishes which Project the caller
is addressing. A fresh authorization decision establishes what that caller may
do there. No capability infers its Project from mutable session state.
This is the execution-plane boundary on which the rest of Omega is completed.
Two clients, two browser tabs, background jobs, and future service callers can
operate in different Projects without changing a shared “selected Project.”
Alpha may retain a selected-Project preference for navigation, but that
preference has no authority over backend reads or writes.
## As-built evidence
The current transport gate authenticates a session and uses its selected Project
to establish request scope. Most Project routes are unprefixed. Capability
records generally include `project_id`, so storage isolation is already close to
the target, but the Project identity arrives implicitly. This couples navigation
state to authorization and makes concurrent multi-Project clients, Project-safe
jobs, and the User Cell / Project Subcell execution hierarchy unnecessarily fragile.
`documentAccessGuard` adds a second direct-resource check for routes containing
`:documentID`, but it passes through when resolution fails and cannot protect
resources whose identifiers are in bodies, queries, composite responses, or
internal calls. Ω-009 establishes caller-aware read contracts; this packet
ensures the correct Project and caller reach every one of them.
## Scope
- Introduce a canonical authenticated caller and explicit Project execution
	scope.
- Prefix every Project endpoint with `/projects/:projectID`.
- Authorize Project membership/grant on every request before dispatch.
- Pass Project scope as an argument to every Project capability command/query.
- Reject a Project id in a request body or stored object when it disagrees with
	route scope.
- Carry the same scope into jobs, tools, internal coordinators, and live streams.
- Deprecate selected Project as authority; retain it only as a user-interface
	preference if Alpha still needs it during cutover.
- Convert transport, handler, capability, store, test, and backend-guide
	contracts in one pre-release migration.
## Non-goals
- No Enterprise Control Plane service split.
- No Organization hierarchy, entitlement engine, or user-library migration.
- No runtime-cell implementation; Ω-013 consumes this contract.
- No live change stream; Ω-014 consumes this scope.
- No change to resource-level grant meaning beyond the fail-closed work in
	Ω-009 and Ω-010.
- No compatibility promise for undocumented unprefixed routes.
## Invariants
1. Session establishes `CallerID`; it never establishes Project authority.
2. `ProjectID` comes from the authenticated route or a trusted durable job
	envelope, never from a mutable process-global or session-selected value.
3. Authorization is checked before User Cell / Project Subcell acquisition,
	capability lookup, persistence access, or existence-revealing response.
4. Every store query and mutation retains a `project_id` predicate even after
	authorization succeeds.
5. A client-supplied body Project id is ignored only if absent; disagreement is
	a typed `400 scope_mismatch`, not silently normalized.
6. Internal capability APIs cannot be invoked with a bare string id where a
	typed caller-aware scope is required.
7. Removing a caller's Project access takes effect on the next request and
	causes existing streams to terminate or reauthorize.
## Representative contracts
```go
type AuthenticatedCaller struct {
    UserID         string
    OrganizationID string // optional acting organization, explicitly resolved
    SessionID      string
}

type ProjectScope struct {
    ProjectID string
    Caller    AuthenticatedCaller
}

type ProjectPermission string

const (
    ProjectRead  ProjectPermission = "project.read"
    ProjectWrite ProjectPermission = "project.write"
    ProjectAdmin ProjectPermission = "project.admin"
)

type ProjectAuthorizer interface {
    Authorize(
        ctx context.Context,
        caller AuthenticatedCaller,
        projectID string,
        permission ProjectPermission,
    ) (ProjectScope, error)
}
```
Handlers receive scope after middleware authorization:
```go
func (h *Documents) Get(w http.ResponseWriter, r *http.Request) {
    scope := projectscope.MustFromContext(r.Context())
    documentID := route.Param(r, "documentID")
    result, err := h.documents.Get(r.Context(), scope, documentID)
    // ...
}
```
Target route examples:
```plain text
GET    /projects/:projectID/resources
POST   /projects/:projectID/documents
POST   /projects/:projectID/documents/:documentID/changes
GET    /projects/:projectID/activity
POST   /projects/:projectID/chats/:chatID/turns
GET    /projects/:projectID/workspace
GET    /projects/:projectID/events
```
User-level library and identity routes remain outside this prefix in later
waves.
## Likely paths
- `core/transport/routes.go`
- `core/transport/middleware.go`
- `core/transport/dispatch.go`
- `core/handlers/`
- `core/capability/access/`
- `core/capability/session/`
- every Project capability interface
- `core/wiring/wiring.go`
- `core/platform/storage/sqlite/`
- `dev-test/`
- `docs/backend-guide.md`
## Ordered implementation
1. Extend Ω-001's operation matrix with target scope, minimum permission, route
	parameter, and every body/query Project field. Add a test that no
	Project-scoped operation lacks these columns.
2. Add `AuthenticatedCaller`, `ProjectScope`, and `ProjectAuthorizer` without
	changing routes. Adapt current access storage behind the new port and make
	errors fail closed.
3. Add middleware that parses a canonical Project id, selects the operation's
	required permission, authorizes the caller, and attaches immutable scope to
	context. Remove `documentAccessGuard` pass-through behavior; resource access
	remains an explicit capability check after Project admission.
4. Convert capability interfaces and handlers one vertical at a time. Start
	with Resource and Document, then Context/Knowledge/Agent, then Activity,
	references, comments, presence, Chat, Connector, Workspace, and supporting
	projections. Keep the tree green after each conversion.
5. Add `project_id` predicates and mismatch assertions to every store method.
	A test fixture with duplicate entity ids across Projects must prove the
	predicate cannot be accidentally omitted.
6. Mount prefixed routes and update operation registration. Because Taurus is
	pre-release, cut over directly once Alpha's endpoint adapter is prepared;
	if a temporary alias is unavoidable, it must resolve an explicit path Project
	and emit removal telemetry, never read the session-selected authority.
7. Change `/session/project` or equivalent selection to a navigation preference
	only. Name the property accordingly and document that it grants nothing.
8. Introduce a trusted scope envelope for durable jobs and internal tools.
	Ω-014 completes job ownership, but new work cannot enqueue without Project id
	and initiating caller.
9. Reauthorize long-lived streams on access-revision notification or bounded
	interval and terminate on loss.
10. Update Alpha backend contract fixtures, backend guide, companions,
	completion matrix, migration notes, and change record.
## Security, concurrency, persistence, and observability
Do not cache authorization inside a User Cell or Project Subcell. A subcell is
bound to one User and Project, while its `ProjectScope` and admission are still
request-local and access-epoch bounded.
Short-lived request caches may batch resource decisions only when keyed by
caller, Project, permission, and access revision.
The selected-Project preference can race harmlessly across clients because no
backend operation reads it for authority. Jobs persist their Project and
initiator at enqueue time; execution rechecks the current authorization required
by the job type. Logs and traces include Project id, caller id, operation, and
authorization outcome but never session token, grant contents, or hidden names.
## Tests and gates
- Route inventory test: every Project operation is under exactly one explicit
	Project prefix.
- Two users × two Projects × two roles matrix for point reads, collections,
	writes, jobs, streams, and internal Agent tools.
- Same resource id fixture in two Projects proving no cross-scope read/write.
- Two concurrent clients for one user operating in different Projects while
	repeatedly changing the navigation preference.
- Body/query/path mismatch and malformed Project id tests.
- Access removal during stream and model/tool execution.
- Middleware resolver failure returns non-enumerating denial and invokes no
	capability.
- `go test -race`, all backend E2E suites, and standard repository gates.
## Completion evidence
- No Project capability public method lacks `ProjectScope`.
- No Project route relies on selected session Project.
- Storage isolation and fresh authorization are proven across concurrent
	Projects.
- Alpha can switch Projects by changing its route base, not a backend session
	mutation.
- The completion matrix classifies every route as Project, user, operator, or
	public.
## Dependencies
Depends on Ω-009 and Ω-010 for caller-aware reads and wire behavior. Blocks
Ω-012 through Ω-019 and every later Project resource capability.
## Sources
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/b8ba4aa05974ff21746f14b71acaf09117d38dcf/docs/architecture/runtime-model.md)
---


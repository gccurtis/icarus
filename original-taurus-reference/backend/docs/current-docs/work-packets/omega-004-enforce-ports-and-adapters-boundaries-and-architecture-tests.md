---
title: "Execute Ω-004 — Enforce ports-and-adapters boundaries and architecture tests"
packet_id: "Ω-004"
status: "ready-for-execution"
wave: "Wave 0 — Stabilize current truth"
depends_on: "Ω-001"
source_mirror: "docs/current-docs/notion/work-packets/omega-004-enforce-ports-and-adapters-boundaries-and-architecture-tests.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-004 — Enforce ports-and-adapters boundaries and architecture tests

## Mission

make Omega's ports-and-adapters boundaries explicit, enforceable, and compatible with the logical User Cell → Project Subcell runtime.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001**.

Source dependency statement: Ω-001.

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
- `docs/current-docs/notion/work-packets/omega-004-enforce-ports-and-adapters-boundaries-and-architecture-tests.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/*` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/**` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/connector` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource/resource.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/wiring.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/architecture/runtime-model.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-004-enforce-ports-and-adapters-boundaries-and-architecture-tests.md`

> **Status:** Queued
> **Wave:** 0 — Stabilize current truth
> **Outcome:** make Omega's ports-and-adapters boundaries explicit, enforceable, and compatible with the logical User Cell → Project Subcell runtime.
<callout icon="⬡" color="purple_bg">
	**Architecture decision:** use a modular monolith with hexagonal capability boundaries for the first production system. User Cells and Project Subcells are logical, disposable application/runtime scopes inside an Omega replica—not one process, container, database, or deployable application per user or project.
</callout>
## Why this packet exists
Omega already follows many good hexagonal practices: capability-local value types and stores, injected ports, adapters in `core/wiring`, and a shared composition root. The frozen repository does not, however, mechanically enforce those rules. Some seams remain attached to the wrong owner—most visibly `knowledge.read`—and one large composition root plus late-bound cycles can make architectural drift easy.
“Hexagram architecture” in the planning discussion is the conventional **hexagonal architecture**, also called **ports and adapters**.
## Frozen baseline
Reviewed at [`50efd18413cc47935033889e51d58e9c828733e2`](https://github.com/gccurtis/taurus-omega/commit/50efd18413cc47935033889e51d58e9c828733e2).
- `core/capability/*` contains domain/application behavior with several narrow injected ports.
- `core/wiring` composes cross-capability adapters and infrastructure.
- SQLite is one shared physical adapter, while capability-specific interfaces provide logical isolation.
- Agent is an intentional application-composition tier, but imports and tool ownership need an explicit policy.
- There is no concrete User Cell or Project Subcell registry yet; current services are process-global and receive Project IDs.
- The current topology is one deployable modular backend. Splitting each user/project into an application would multiply processes, connections, migrations, and network failure modes without adding correctness because durable state already converges through database revision/CAS and outbox/change cursors.
- The documentation's strongest boundary claim is aspirational rather than fully true: current capability packages directly import platform job/logging/dispatch packages; Knowledge imports Intelligence tool types; Agent imports multiple capability services/types; HTTP-watcher and local-folder adapters live inside `core/capability/connector`.
## Scope
- Publish an enforceable capability dependency map.
- Define inbound application ports, outbound infrastructure/collaboration ports, adapters, domain types, and the composition root.
- Move exact Resource reading to the correct Resource/application boundary via Ω-002.
- Introduce architecture/import tests and startup registry validation.
- Replace ad hoc late binding with explicit registries or typed two-phase composition that fails startup when incomplete.
- Define how User Cell and Project Subcell logical scopes acquire capability ports without owning canonical data.
- Define transaction/outbox boundaries for cross-capability outcomes.
- Preserve one modular-monolith deployable for V1 while keeping future extraction possible.
## Non-goals
- No microservice-per-capability rewrite.
- No process/container per User Cell or Project Subcell.
- No distributed Project placement or shared Project runtime.
- No universal repository/store interface that erases capability ownership.
- No event-only architecture where a synchronous invariant needs one transaction.
- No cyclic imports hidden behind a service locator.
- No requirement to split the current SQLite file merely to appear modular.
## Governing dependency rules
```plain text
transport / handlers / tool adapters
                 │ inbound calls
                 ▼
application services / logical cells
                 │ domain-owned ports
                 ▼
capability domain + policy
                 │ outbound ports
                 ▼
wiring adapters / storage / providers / queues / clocks
```
1. A capability owns its domain types, invariants, stable errors, inbound service, and the narrow ports it needs.
2. A capability does not import another leaf capability to call behavior. Cross-capability behavior crosses a port implemented in wiring/application composition.
3. Adapters may import the capability whose port they implement and the external/provider package they wrap; the capability never imports its adapter.
4. Handlers translate transport to an inbound application service. They do not coordinate multi-capability transactions directly.
5. Tool definitions are inbound adapters/application bindings. A semantic index does not own a canonical Resource tool merely because an Agent consumes both.
6. Infrastructure packages never import handlers or product capabilities.
7. Shared packages are limited to stable primitives—IDs, clocks, transactions, errors, pagination, telemetry—and may not become a dumping ground for product models.
8. Agent may remain a sanctioned composition tier, but every behavioral dependency is a declared Agent-owned port. It must not receive an entire capability object when a narrower port suffices.
9. Cross-capability atomic invariants use a unit-of-work/outbox adapter. Events are durable outcomes, not an excuse for temporary split-brain state.
10. A logical Cell holds scoped façades, caches, subscriptions, and coordination state only. Canonical resources/jobs/workspaces remain in durable stores.
Current imports to remove or explicitly classify include:
```plain text
core/capability/document      → core/platform/job
core/capability/knowledge     → core/platform/job, core/platform/logging
core/capability/connector     → core/platform/dispatch, core/platform/logging
core/capability/agent         → core/platform/job and leaf capability services/types
core/capability/knowledge     → Intelligence tool-binding types
core/capability/connector     → net/http and filesystem adapters
```
Replace these with capability-owned enqueue, observer, synchronization, reasoner/tool-operation, and provider ports. Move concrete HTTP/filesystem implementations to an integration/adapter layer.
## Suggested package shape
```plain text
core/
  capability/
    resource/
      model.go service.go ports.go errors.go
    knowledge/
      model.go service.go ports.go errors.go
    ...
  application/
    retrieval/
    resourcecontent/
    projectruntime/
  runtimecell/
    usercell/
    projectsubcell/
  handlers/
  wiring/
    adapters/
    composition/
  platform/
    storage/
    jobs/
    telemetry/
```
Do not reorganize directories solely for aesthetics. The required outcome is ownership and dependency enforcement; existing paths may remain when they already satisfy it.
## Cell-facing port set
```go
type UserCellDeps struct {
    AdmitProject ProjectAdmissionPort
    OpenSubcell  ProjectSubcellFactory
    Libraries    UserLibraryPort
    Activity     UserActivityPort
}

type ProjectSubcellDeps struct {
    Resources    ResourceApplication
    Workspace    WorkspaceApplication
    Retrieval    RetrievalApplication
    Agents       AgentApplication
    Jobs         ProjectJobPort
    Changes      ProjectChangePort
}
```
The registry key is `(UserID, ProjectID)`. Two users in one Project receive two distinct Project Subcells; the same user on two devices resolves to the same logical subcell key. None of those subcells is the Project's canonical owner.
## Enforcement
Create an executable architecture policy, for example:
```go
type Layer string

type Rule struct {
    From     string
    MayImport []string
    Deny     []string
}
```
The implementation may use `go list -deps -json`, `golang.org/x/tools/go/packages`, or a small repository-owned checker. Required checks:
- leaf capability → leaf capability imports are denied unless explicitly documented as stable shared value types;
- `core/capability/**` → `core/handlers`, `core/wiring`, or concrete platform adapters is denied;
- handler → concrete store/provider is denied;
- wiring/composition is the only place allowed to assemble concrete cross-capability adapters;
- every registered family/job/tool/provider has a unique key and complete required ports;
- no package imports an archived companion or design implementation.
Exceptions are a small reviewed file with owner, rationale, removal condition, and expiry packet—not inline wildcard suppression.
## Ordered implementation
1. Generate the current package/import graph at the frozen SHA. Classify every edge by layer and owner.
2. Freeze the rules above and record intentional exceptions.
3. Add the architecture checker to the baseline/CI gates before moving packages.
4. Correct wrong ownership seams, beginning with Ω-002 exact Resource reading.
5. Narrow Agent, Document, Context, Connector, Workspace, Knowledge, and Resource dependencies to ports; keep value-type imports only where explicitly approved.
6. Move HTTP watcher and local-folder connector implementations out of the Connector capability; move Knowledge model-tool schemas/bindings into Agent/application wiring; replace platform job/logging/dispatch imports with owned ports.
7. Treat Agent as an application-orchestration tier or relocate it accordingly. Its behavioral dependencies must be Agent-owned ports and translated DTOs, not whole leaf services.
8. Introduce typed application coordinators for cross-capability flows such as retrieval, Resource publication, and Project runtime admission.
9. Replace incomplete late-bound cycles with explicit construction phases and a final `Validate()` that fails before readiness.
10. Make User Cell/Project Subcell factories accept complete port bundles. Never reach into global singletons from a subcell.
11. Define one unit-of-work/outbox boundary for operations requiring atomic state plus publication.
12. Add adapter conformance tests, import graph snapshots, architecture documentation, and a change record.
## Production topology decision
```plain text
Alpha clients
    │
load balancer
    │
identical Omega replicas
    ├── logical UserCell(UserID)
    │      └── ProjectSubcell(UserID, ProjectID)
    ├── durable jobs/workers
    └── ports to PostgreSQL, object storage, providers, telemetry
```
- Start with one production Omega replica plus workers if operationally appropriate.
- Scale to identical replicas. Best-effort user affinity may reduce cache/subscription churn, but correctness never depends on it.
- Any replica may rehydrate a User Cell/Subcell after admission from durable state.
- Database CAS/revisions and the durable Project outbox/change cursor synchronize collaborators.
- A cross-node wake-up adapter may reduce polling latency; it is not durable authority.
- Split control-plane endpoints, workers, or conversion runtimes into separate deployables only when security isolation or measured load justifies it. Ports remain the seam.
## Verification
- Architecture checker fails on a fixture leaf-capability import, handler-to-store import, and capability-to-wiring import.
- Every exception is explicit and counted; baseline count can only fall unless a reviewed packet changes it.
- Composition fails before readiness for missing/duplicate family, tool, job, provider, or required port.
- Unit tests construct capabilities with fakes, without importing SQLite, HTTP, or another capability service.
- Shared SQLite and future PostgreSQL adapters pass the same capability port contracts.
- Two users in one Project have distinct subcell instances but converge through durable revisions/events.
- Two replicas can discard/rehydrate cells without losing correctness or undoing accepted mutations.
- No correctness test requires sticky sessions or a single in-memory registry.
## Completion evidence
- Import/dependency policy is executable in CI.
- Current exceptions are enumerated and justified.
- Exact Resource read ownership is corrected.
- Cell/subcell composition uses declared ports and can be rehydrated on any replica.
- The deployment model remains one modular product, with extraction seams proven by adapter tests rather than premature services.
## Dependencies and unlocks
Depends on Ω-001. Coordinates with Ω-002–Ω-003. Blocks Ω-011–Ω-015 composition closure and the production gates Ω-042–Ω-044.
## Sources
- [Frozen Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/docs/architecture/runtime-model.md)
- [Frozen composition root](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/core/wiring/wiring.go)
- [Current Resource capability](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/core/capability/resource/resource.go)


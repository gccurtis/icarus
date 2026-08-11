---
title: "Work Packet — Ω-004 — Enforce ports-and-adapters boundaries and architecture tests"
notion_page_id: "3acb6410e5028134b99ef90126e27abb"
notion_url: "https://app.notion.com/3acb6410e5028134b99ef90126e27abb"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:48:42Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-004 — Enforce ports-and-adapters boundaries and architecture tests

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


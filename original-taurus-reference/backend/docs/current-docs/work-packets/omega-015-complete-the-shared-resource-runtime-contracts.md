---
title: "Execute Ω-015 — Complete the shared Resource runtime contracts"
packet_id: "Ω-015"
status: "ready-for-execution"
wave: "Wave 1 — Close the Project runtime"
depends_on: "Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014"
source_mirror: "docs/current-docs/notion/work-packets/omega-015-complete-the-shared-resource-runtime-contracts.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-015 — Complete the shared Resource runtime contracts

## Mission

Make Resource the stable, testable protocol through which Omega discovers, authorizes, catalogs, opens, duplicates, trashes, restores, purges, references, templates, and eventually imports/exports every Project content family. Document and Connector will implement the complete V1 kernel now. Spreadsheet, Slides, revisioned Chat, structured data, and conversion workers can then join through declared optional capability interfaces rather than new switch statements and one-off routes. The contract separates concerns: each family owns its typed content, revision, and family invariants; the Resource kernel owns coordination, stable identity, Project envelope/access integration, registration, and caller-visible catalog projection. Unsupported behavior is explicit and typed—never a placeholder that claims success.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014**.

Source dependency statement: Ω-009 through Ω-014

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
- `docs/current-docs/notion/work-packets/omega-015-complete-the-shared-resource-runtime-contracts.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-user-cell-and-project-subcell-runtime--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-workspace-capability-and-runtime-contract--3acb6410e502.md`
- `docs/current-docs/notion/primary/workstreams-taurus-product-completion--3acb6410e502.md`
- `core/capability/activity/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/connector/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/contexts/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/document/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/reference/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/workspace/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/resource/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/platform/storage/sqlite/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/runtimecell/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/resource_*.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
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

Source mirror: `docs/current-docs/notion/work-packets/omega-015-complete-the-shared-resource-runtime-contracts.md`

<callout icon="📖" color="blue_bg">
	**Frozen-baseline contract correction.** Ω-002 supplies the urgent exact-read foundation; this Resource-kernel packet makes it the permanent family contract. Add caller-aware `resource.find/list/read`, exact-name ambiguity handling, stable kind/Resource ID selection, version-pinned bounded cursors, and a `TextReadableFamily`/named-representation conformance suite. Knowledge search returns Resource/version locators but never owns canonical inventory or authorizes reads. Document, Connector/File, Spreadsheet, Slides, and Chat adapters define their own immutable representation/version semantics; unsupported binary/media projections fail honestly.
</callout>
## Outcome
Make Resource the stable, testable protocol through which Omega discovers,
authorizes, catalogs, opens, duplicates, trashes, restores, purges, references,
templates, and eventually imports/exports every Project content family.
Document and Connector will implement the complete V1 kernel now. Spreadsheet,
Slides, revisioned Chat, structured data, and conversion workers can then join
through declared optional capability interfaces rather than new switch
statements and one-off routes.
The contract separates concerns: each family owns its typed content, revision,
and family invariants; the Resource kernel owns coordination, stable identity,
Project envelope/access integration, registration, and caller-visible catalog
projection. Unsupported behavior is explicit and typed—never a placeholder that
claims success.
## As-built evidence
Omega already has a unified Resource catalog and a `resource.Family` mechanism.
Document and Connector are the only registered family adapters. Other
capabilities expose resource-like behavior directly, and future Spreadsheet,
Slides, and Chat models will otherwise repeat lifecycle, access, Activity,
reference, template, job, and live-delivery integration.
The current contract is not yet a completion gate: optional behavior,
transaction/outbox semantics, duplication, trash/restore/purge, capability
discovery, registration validation, and a reusable family conformance suite are
not uniformly defined. Ω-009 and Ω-010 supply caller-aware access and wire
semantics; this packet makes them mandatory for every family.
## Scope
- Define the minimal core Family protocol and narrow optional interfaces.
- Define stable family descriptors and capability discovery.
- Define lifecycle state machine: create, read projection, rename where
	meaningful, trash, restore, purge, and duplicate.
- Define resource target resolution for Workspace, Context, references,
	Activity, jobs, Knowledge origin, and Agent tools.
- Define atomic/outbox coordination between family state and Resource
	projection.
- Require registration at composition and fail startup on duplicate/incomplete
	families.
- Retrofit Document and Connector and pass a common contract suite.
- Reserve typed hooks for history, templates/materialization, knowledge
	projection, and interchange without implementing later-wave features.
- Publish a versioned HTTP and internal contract for future family authors.
## Non-goals
- No Spreadsheet, Slides, or Chat aggregate implementation.
- No generic “JSON resource” that bypasses family invariants.
- No user-level library assets; they use a related kernel in Wave 5.
- No Office/PDF codecs.
- No permanent binary/plugin ABI or runtime-loaded third-party code.
- No fake adapter that registers an unavailable family merely to populate UI.
- No requirement that every family support rename, history, templates, import,
	or export.
## Governing invariants
1. `ResourceID` is stable and Project-scoped; family/type cannot change.
2. A family owns content and content revision. Resource does not deserialize or
	mutate family-specific bases.
3. Resource projection cannot outlive a purged family object or point at a
	different Project/family identity.
4. All point/list/lifecycle operations receive Ω-011 `ProjectScope`; access
	errors fail closed and use Ω-010 wire semantics.
5. Trash is reversible and removes the resource from ordinary catalogs,
	retrieval, references, and active Workspace resolution. Purge is explicit,
	authorized, and irreversible.
6. Duplicate creates a new identity and lineage, never reuses history,
	idempotency keys, access rows, or Knowledge publication ids.
7. Optional support is discovered through typed interfaces/descriptors.
	Unsupported returns `resource.capability_unavailable`.
8. Registration is deterministic and frozen after startup.
## Representative interfaces
```go
type FamilyDescriptor struct {
    Kind             string
    SchemaVersion    int
    SupportsHistory  bool
    SupportsTemplate bool
    SupportsImport   []string
    SupportsExport   []string
}

type Family interface {
    Descriptor() FamilyDescriptor
    Create(context.Context, ProjectScope, CreateInput) (FamilyObject, error)
    GetProjection(context.Context, ProjectScope, string) (Projection, error)
    Trash(context.Context, ProjectScope, string, ExpectedRevision) error
    Restore(context.Context, ProjectScope, string, ExpectedRevision) error
    Purge(context.Context, ProjectScope, string, PurgeAuthorization) error
    Duplicate(context.Context, ProjectScope, string, DuplicateInput) (FamilyObject, error)
}

type RenameFamily interface {
    Rename(context.Context, ProjectScope, string, string, ExpectedRevision) error
}

type HistoryFamily interface {
    History(context.Context, ProjectScope, string, Page) (HistoryPage, error)
}

type TemplateFamily interface {
    DescribeTemplate(context.Context, ProjectScope, string) (TemplateShape, error)
    Materialize(context.Context, ProjectScope, TemplateMaterialization) (FamilyObject, error)
}

type KnowledgeProjector interface {
    ProjectRevision(context.Context, ProjectScope, string, int64) (TextProjection, error)
}
```
Interchange hooks should describe formats and queue a sandboxed conversion job
in Wave 4; do not put DOCX/PDF libraries in Resource.
```go
type Registry interface {
    Register(Family) error
    Family(kind string) (Family, bool)
    Descriptors() []FamilyDescriptor
    Validate() error
}
```
## Lifecycle coordination
The family commit is authoritative for typed content; the Resource catalog is
the canonical cross-family projection/coordination surface. Use a single SQLite
unit of work when adapters share the store. Where a later worker is isolated,
use an outbox and idempotent projector. Never use “write family, then best-effort
catalog update” without durable recovery.
Recommended envelope:
```go
type ResourceEnvelope struct {
    ID            string
    ProjectID     string
    Family        string
    FamilyRevision int64
    State         ResourceState
    Title         string
    OwnerRef      OwnerRef
    CreatedAt     time.Time
    UpdatedAt     time.Time
    TrashedAt     *time.Time
}
```
If a title is structurally derived for a family, the family projection remains
authoritative and the catalog stores its versioned projection. Workspace reads
titles through this caller-aware projection instead of persisting them.
## Likely paths
- `core/capability/resource/`
- `core/capability/document/`
- `core/capability/connector/`
- `core/capability/reference/`
- `core/capability/activity/`
- `core/capability/contexts/`
- `core/capability/workspace/`
- `core/wiring/resource_*.go`
- `core/runtimecell/`
- `core/platform/storage/sqlite/`
- `core/handlers/resource/`
- `docs/backend-guide.md`
## Ordered implementation
1. Inventory every current Resource route, adapter method, lifecycle state,
	projection field, and call site. Record the authoritative owner of each
	field and identify split-brain possibilities.
2. Freeze descriptors, core/narrow interfaces, typed errors, idempotency and
	revision preconditions, lifecycle state machine, lineage, and golden HTTP
	shapes.
3. Build an in-memory family conformance harness before changing adapters. It
	must exercise scope, access, create/get, rename support, trash/restore/purge,
	duplicate, idempotency, conflict, missing/redacted behavior, events, and
	failure atomicity.
4. Implement registry validation in shared wiring and Project Subcell construction. Reject duplicate
	kind, invalid descriptor/version, missing required adapter, or route claiming
	an unregistered family.
5. Define Resource/family unit-of-work and durable outbox semantics. Add
	reconciliation that can repair a missing/stale projection from family state
	without guessing or exposing content.
6. Retrofit Document. Preserve its base/change-set revision model, history,
	comments, marks, references, and prompts while routing shared lifecycle
	behavior through Resource.
7. Retrofit Connector. Preserve source/sync semantics, apply Ω-007 policy, and
	distinguish Connector definition revision from ingestion/job progress.
8. Integrate Activity provenance, references/backlinks, Context target
	resolution, Workspace targets, Project events, and access cleanup using the
	stable Resource identity.
9. Add bounded catalog/search/list endpoints and per-resource capability
	descriptors. Omit unsupported operations from available actions and return a
	typed error if directly invoked.
10. Write the “new family” implementation guide and compile-only fixture
	adapter. Update baseline, companions, and change record.
## Security, concurrency, persistence, and observability
The Resource kernel never widens family access. Every adapter receives caller
scope and either enforces access itself or is wrapped by a tested structural
guard; internal calls cannot bypass the rule. Purge requires stronger explicit
authorization and dependency checks. Duplicate copies only caller-visible,
family-approved content and applies new default access; it does not clone hidden
references or grants.
Lifecycle commands are serialized by Project+Resource and use expected family
revision plus idempotency. Projection lag is observable and repaired from the
authoritative family. Events carry family, Resource id, lifecycle state, and
revision but no content.
Metrics use bounded family/operation/outcome labels: registry failures, lifecycle
latency, conflicts, projection lag, reconciliation count, and orphan detection.
## Tests and gates
- Common conformance suite passes unchanged for Document and Connector.
- Startup rejects duplicate/invalid/missing registrations.
- Crash matrices for family commit, envelope projection, outbox publish, and
	reconciliation.
- Cross-Project/caller authorization and Ω-010 redaction for every lifecycle
	operation.
- Duplicate lineage, default-access, hidden-reference, history independence,
	and Knowledge-id independence.
- Trash/restore effects on catalog, Workspace, Context, references, Activity,
	retrieval, and live events.
- Purge dependency/authorization/idempotency and irreversible-store tests.
- Concurrent rename/trash/duplicate with revision conflicts and race detector.
- A compile-only example family proves no switch statement outside registration
	must change.
- Standard backend E2E and repository gates.
## Completion evidence
- Document and Connector pass one Resource family contract suite.
- Adding a family requires registration and its own adapter, not transport or
	cross-capability switch edits.
- Catalog/family crash recovery has no unowned split-brain state.
- Every optional action is discoverable and honest.
- Resource lifecycle and access behavior are documented once for Alpha.
## Dependencies
Depends on Ω-009 through Ω-014. Blocks Ω-016 through Ω-019 and every resource
capability in Wave 2.
## Sources
- [Omega Resource capability](https://github.com/gccurtis/taurus-omega/tree/b8ba4aa05974ff21746f14b71acaf09117d38dcf/core/capability/resource)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Workstreams — Taurus Product Completion](https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd)
- [Model — Workspace Capability](https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb)
---


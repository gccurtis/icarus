---
title: "Execute Ω-039 — Migrate Personality, Context, and Template libraries"
packet_id: "Ω-039"
status: "ready-for-execution"
wave: "Wave 5 — Complete the control plane"
depends_on: "Ω-017, Ω-019, Ω-020, Ω-038"
source_mirror: "docs/current-docs/notion/work-packets/omega-039-migrate-personality-context-and-template-libraries.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-039 — Migrate Personality, Context, and Template libraries

## Mission

Personality, Context, and Template become typed versioned projections over the Ω-038 library kernel. Signed-in users can manage them before selecting a Project, share them with Users or Organizations, explicitly capture safe exact Project versions, and materialize independent copies into an authorized Project. The existing project Persona, Context, Document Template, and Agent runtime remain the canonical Project-side representations.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-017, Ω-019, Ω-020, Ω-038**.

Source dependency statement: Ω-017, Ω-019, Ω-020, Ω-038, the existing admission/membership port,
and target capability adapters.

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
- `docs/current-docs/notion/work-packets/omega-039-migrate-personality-context-and-template-libraries.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-enterprise-control-plane--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-user-agents-and-personality-library--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-user-context-library--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-user-template-library--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-chat-capability-and-runtime-contract--3abb6410e502.md`
- `docs/current-docs/notion/primary/model-identity-organization-project-ownership-and-access--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-workspace-capability-and-runtime-contract--3acb6410e502.md`
- `docs/current-docs/notion/primary/workstreams-taurus-product-completion--3acb6410e502.md`

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

Source mirror: `docs/current-docs/notion/work-packets/omega-039-migrate-personality-context-and-template-libraries.md`

### Outcome
Personality, Context, and Template become typed versioned projections over the
Ω-038 library kernel. Signed-in users can manage them before selecting a
Project, share them with Users or Organizations, explicitly capture safe exact
Project versions, and materialize independent copies into an authorized
Project. The existing project Persona, Context, Document Template, and Agent
runtime remain the canonical Project-side representations.
### Reviewed evidence
- [Implementation — User Agents & Personality Library](https://app.notion.com/p/3acb6410e50281229fe9eec53047607c)
- [Implementation — User Context Library](https://app.notion.com/p/3acb6410e502814e928ae1f10eac6f75)
- [Implementation — User Template Library](https://app.notion.com/p/3acb6410e50281d4a4d8ee542f91d595)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf)
Current Omega already has durable project Agent Tasks, versioned project
Personas, project Context include/exclude/nesting, project Document Templates,
and project jobs. Known Template access defects must be closed: template list
cannot be unfiltered, `fromTemplateId` must authorize the source, and clearing
bindings must clear `BoundResource` as well as visible binding fields.
### Scope
Personality:
- Immutable Personality versions containing focus, behavioral guidance, output
	preferences, verification, and other approved persona fields.
- User global default plus explicit per-Project override behavior.
- Exact-version copy into a project Persona with protected lineage.
- User-level, requester-private projection of project Agent Tasks across
	Projects still accessible to the caller; task execution remains project-local.
Context:
- Immutable self-contained library Context versions.
- Named includes/excludes, nested captured Context snapshots, safe Resource
	snapshots where permitted, and explicit binding slots for information that
	must be chosen at materialization.
- Preservation of exclusion precedence, cycle prevention, bounded resolution,
	and whole-project semantics only where an explicit project binding supplies
	it.
Template:
- Document-first revisioned draft and immutable published versions.
- Prompt view versus ephemeral content preview, typed Context slots, safe
	parameters, and exact-version materialization as a new Document or insertion
	through an ordinary Document ChangeSet.
- Fresh canonical IDs on every copy/insertion.
### Non-goals
- Organization-owned masters, live-linked copies, automatic synchronization,
	automatic Project lift, or ownership transfer.
- Sharing Agent Tasks, moving a Task between Projects, autonomous scheduled
	routines, arbitrary tool grants, or chain-of-thought.
- Storing live Project IDs inside a supposedly portable Context/Template
	version.
- Spreadsheet/Slides Template payload adapters until their Ω-020 parameter
	contract and resource adapters are complete; the kernel and API remain ready.
- Cross-project Task content that bypasses the requester-private rule.
### Invariants
1. `library_assets` is the only identity/owner/metadata/lifecycle/grant
	authority. Typed tables contain immutable payloads keyed by asset/version.
2. Every published version is immutable and digest-addressed. Metadata CAS and
	payload-head CAS are separate.
3. Project copies carry informational source asset/version lineage but no live
	foreign-key cascade or inherited ACL.
4. A library Context is portable: every included leaf is an approved immutable
	snapshot or a declared binding slot. Hidden inaccessible names never leak.
5. A Template preview is not a canonical Project resource. “Content” preview
	uses an ephemeral binding environment and cannot persist side effects.
6. Materialization authorizes exact library version and current target Project
	write, validates bindings, assigns fresh IDs, and commits by the target
	capability.
7. Agent Tasks remain Project-bound, requester-private, and persona-snapshotted.
	`/me/agent-tasks` is a filtered projection, not a new Task aggregate.
8. Typed payloads cannot register tools, credentials, connectors, policies, or
	permissions.
### Target packages, schema, and API
```plain text
core/control/library/personality/
core/control/library/context/
core/control/library/template/
core/control/library/agentprojection/
core/capability/persona/library_adapter.go
core/capability/contexts/library_adapter.go
core/capability/document/template_library_adapter.go
core/platform/storage/{sqlite,postgres}/library_payloads/
core/transport/http/library/
```
```sql
CREATE TABLE personality_library_versions (
    asset_id          TEXT NOT NULL,
    version           BIGINT NOT NULL,
    definition_json   TEXT NOT NULL,
    definition_digest TEXT NOT NULL,
    created_by        TEXT NOT NULL,
    created_at        TIMESTAMP NOT NULL,
    PRIMARY KEY (asset_id, version)
);

CREATE TABLE user_personality_defaults (
    user_id          TEXT PRIMARY KEY,
    asset_id         TEXT NOT NULL,
    asset_version    BIGINT NOT NULL,
    version          BIGINT NOT NULL,
    updated_at       TIMESTAMP NOT NULL
);

CREATE TABLE context_library_versions (
    asset_id          TEXT NOT NULL,
    version           BIGINT NOT NULL,
    graph_json        TEXT NOT NULL,
    graph_digest      TEXT NOT NULL,
    leaf_count        BIGINT NOT NULL,
    created_by        TEXT NOT NULL,
    created_at        TIMESTAMP NOT NULL,
    PRIMARY KEY (asset_id, version)
);

CREATE TABLE template_library_drafts (
    asset_id          TEXT PRIMARY KEY,
    base_version      BIGINT,
    draft_revision    BIGINT NOT NULL,
    draft_json        TEXT NOT NULL,
    updated_by        TEXT NOT NULL,
    updated_at        TIMESTAMP NOT NULL
);

CREATE TABLE template_library_versions (
    asset_id          TEXT NOT NULL,
    version           BIGINT NOT NULL,
    resource_kind     TEXT NOT NULL,
    payload_json      TEXT NOT NULL,
    payload_digest    TEXT NOT NULL,
    slots_json        TEXT NOT NULL,
    created_by        TEXT NOT NULL,
    created_at        TIMESTAMP NOT NULL,
    PRIMARY KEY (asset_id, version)
);
```
Add nullable library lineage columns or a separate project-copy-lineage table
for stable project Persona, Context, and Template-created Resource IDs. The
library asset may later be unavailable, so do not enforce a destructive
cross-scope cascade.
```plain text
GET/POST /me/personalities
GET      /me/personalities/{assetID}
POST     /me/personalities/{assetID}/revisions
POST     /me/personalities/{assetID}/materializations
POST     /me/personalities/captures
GET      /me/agent-tasks
GET      /me/agent-tasks/{taskID}

GET/POST /me/contexts
POST     /me/contexts/{assetID}/revisions
GET      /me/contexts/{assetID}/resolved
POST     /me/contexts/{assetID}/materializations
POST     /me/contexts/captures

GET/POST /me/templates
PATCH    /me/templates/{assetID}/draft
POST     /me/templates/{assetID}/publish
POST     /me/templates/{assetID}/previews
POST     /me/templates/{assetID}/materializations
POST     /me/templates/captures
```
Sharing/lifecycle/status use Ω-038 common routes or typed aliases with identical
semantics.
### Sequential tasks
1. Freeze all typed payload schemas, digest/canonicalization, revision/CAS,
	binding-slot, lineage, and diagnostic contracts.
2. Implement Personality version store and service over Ω-038; add global
	default and exact project Persona materialization.
3. Add requester-private `/me/agent-tasks` projection over accessible Projects,
	with stable cursor, safe summary, and no cross-project content leakage.
4. Implement Context portable snapshot/cycle/resolution model, capture
	sanitizer, exact-version materialization, and bounded resolved projection.
5. Fix project Template authorization defects before exposing captures:
	caller-filter list, source authorization for `fromTemplateId`, and complete
	binding clearing.
6. Implement Document Template drafts, publication, prompt/content preview,
	Context slots, new-Document and insert materialization through canonical
	Document operations.
7. Wire grants/lifecycle/audit/status through Ω-038 without typed ACLs.
8. Add migrations that preserve all current Project assets without implicitly
	promoting them; enable explicit capture only after policy tests pass.
9. Add Alpha-independent handler/integration/load/recovery demonstrations.
### Security, privacy, concurrency, idempotency, and observability
Every typed read resolves the common asset and effective permission first, then
reads only the requested immutable version. The service validates asset kind
at this boundary. Organization-derived grants are recalculated through access
epochs. Cross-project Agent queries first enumerate caller-accessible Projects,
then return only Tasks whose requester is the caller; another Project member’s
Task remains invisible.
Context capture traverses authorized leaves with hard depth/leaf/token/byte
limits and sanitizes hidden identifiers. An inaccessible source, cycle,
governance uncertainty, or policy failure aborts without creating an asset.
Template preview and materialization cannot fetch an undeclared Resource,
connector, URL, or credential. Personality definitions are instructions only
within the existing Agent safety boundary and cannot grant capability.
Draft mutations use expected draft revision and client request ID. Published
version creation, asset head advance, receipt, audit, and outbox commit
atomically. Capture/materialization fingerprints include exact source/asset
version, target, binding digest, mapping version, and caller key. Project
revision CAS still governs insertion into an existing Document.
Metrics include assets/versions by kind, Context leaves/depth/resolve latency,
Template draft conflicts/publish/preview/materialize, Persona copies/default
resolution, Agent projection scan/rows, permission denials, captures rejected
by policy, retries, and stale target conflicts. Payload bodies never enter logs
or audit.
### Tests and failure drills
- Shared permission/lifecycle behavior is identical across all three kinds.
- Personality immutable version/default/project-copy/snapshot behavior and
	requester-private Agent projection across access/revocation changes.
- Context include/exclude precedence, nested snapshots, cycles, whole-project
	slot, inaccessible leaves, thousands-of-leaves bounds, deterministic digest,
	and independent Project copy.
- Template draft CAS, publish immutability, prompt/content preview isolation,
	required/optional/wrong-type bindings, fresh IDs, new-resource and insertion
	paths, and concurrent target revision conflict.
- Regression tests for unfiltered template list, unauthorized
	`fromTemplateId`, and `clearBindings` retaining `BoundResource`.
- Capture/materialization crash, retry, grant revocation, Project revocation,
	policy outage, job redelivery, and commit-ack loss.
- No migration creates a user master from a Project asset without an explicit,
	audited capture.
### Migration, rollback, and completion evidence
Create typed tables empty. Existing Project Personas, Contexts, Templates, Task
snapshots, and defaults remain unchanged. A user may explicitly capture one
exact version after cutover. Existing project routes remain for editor
integration while user routes launch; there is no dual-write of master and
copy. Rollback disables user routes and capture/materialization; typed library
masters remain durable and Project copies remain independent.
Completion evidence includes backend-only create/revise/share/capture/
materialize flows for all three kinds, Project-copy independence, cross-project
Agent projection privacy proof, template security regression proof, Context
scale report, idempotency/race/recovery evidence, and schema inspection proving
one common envelope/ACL.
### Dependencies
Depends on Ω-017, Ω-019, Ω-020, Ω-038, the existing admission/membership port,
and target capability adapters. Ω-040 later hardens that port without changing
typed library semantics. Blocks user-library portions of Ω-041 and Ω-044.
### Linked sources
- [Model — Chat Capability & Runtime Contract](https://app.notion.com/p/3abb6410e50281258d89d5719fa851fc)
- [Model — Workspace Capability & Runtime Contract](https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb)
- [Workstreams - Taurus Product Completion](https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd)


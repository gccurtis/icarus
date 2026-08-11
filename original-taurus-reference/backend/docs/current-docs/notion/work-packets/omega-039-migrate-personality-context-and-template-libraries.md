---
title: "Work Packet — Ω-039 — Migrate Personality, Context, and Template libraries"
notion_page_id: "3acb6410e50281c2bd7aea5f19585153"
notion_url: "https://app.notion.com/3acb6410e50281c2bd7aea5f19585153"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:49:09Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-039 — Migrate Personality, Context, and Template libraries

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


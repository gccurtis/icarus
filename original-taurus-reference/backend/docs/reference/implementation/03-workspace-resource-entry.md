# Stage 03 — Workspace, Resource identity, and Product entry

## Outcome

Create the Project-scoped Product entry layer: the shared Resource reference
contract and a cross-family catalog projection,
per-User/per-Project workspace snapshots, permanent destinations, transient New
Tab, Resource tabs, private Resource/Data favorites, versioned Product HTTP
contracts, and a headless Project Overview journey over durable Control and
Project state.

## Non-goals

- generic Resource content or repository
- editable Document/Workbook/Deck/Board/Chat models
- frontend implementation beyond contract fixtures
- hiding unsupported Resource families behind successful placeholders
- storing selection, pending requests, provider clients, or launcher state

## Target tree and files

```text
internal/
  capabilities/workspace/       snapshot values, invariants, pure transitions
  cell/handlers/catalog/        rebuildable catalog queries and owner routing
    repository.go
    mysql/
  cell/handlers/overview/       bounded authorized composition; no persisted aggregate
  cell/handlers/workspace/      workspace commands, mount resolution and persistence
    repository.go
    mysql/
  cell/handlers/favorites/      private Resource/Data refs and owner decoration
    repository.go
    mysql/
  transport/http/product/       Product routes, bounds, ETags and error mapping
api/openapi/product-v1.yaml     versioned catalog/workspace/Overview wire contract
```

The Resource-family registry supplies descriptors and mount readers; it is not
a generic Resource-content repository. Overview composes bounded projections
through registered operations and never imports capability implementations.

## Resource identity and catalog projection

Each Resource family exclusively owns its Resource identity, name, lifecycle,
creator/attribution, family version, provenance links, and content. A family
create operation mints its `ResourceID`; there is no catalog-owned identity row
and no generic Resource aggregate.

The Project catalog is a rebuildable cross-family projection containing only
bounded owner-supplied summary fields:

- `ResourceID`, Project, registered family kind, title and lifecycle;
- current family-version reference and safe summary, never family payload;
- bounded attribution/timestamps and provenance summary references;
- openability and registered action descriptors; and
- projection version plus exact owning family version used to build it.

Creating, renaming, archiving, restoring, or deleting a Resource always invokes
the owning family operation. That family handler may update its catalog row in
the same Project transaction for immediate consistency, but the row remains a
projection that can be discarded and rebuilt from family truth. A catalog
handler cannot mint identity, mutate lifecycle, reserve a canonical name, or
create an empty family payload.

## Workspace model

One compact versioned snapshot per `(UserID, ProjectID)` contains:

- permanent destinations: Overview, Data, Agents;
- ordered closeable Resource tabs;
- active durable destination/tab;
- durable panel open/size preferences within bounds;
- optional last meaningful Resource/component references; and
- optimistic workspace version.

It excludes New Tab launcher state, hover, live selection, text cursor,
in-flight requests, errors/toasts, cached Resource bodies, session credentials,
and runtime clients.

## Public types and schemas

`ResourceSummaryV1` carries identity, family, title, lifecycle, creator,
current family-version reference, safe timestamps and bounded owner-supplied
summary fields. `WorkspaceSnapshotV1` carries the fixed destinations, ordered
Resource mounts, active durable destination, bounded panel preferences and
revision. `FavoriteRefV1` is a closed Resource-or-Data identity union;
`FavoriteSetV1` carries only the current User's ordered refs and independent
revision, while `FavoriteProjectionV1` adds current safe owner decoration at
query time. `OverviewProjectionV1` contains Project profile, authorized catalog
page, private favorites, member summary, Activity/history window, data-health
summary, recommendations and an availability map. Each nested projection declares
`available`, `unavailable`, or `degraded`; absence is never presented as an
empty successful subsystem.

Catalog queries use a versioned `ResourceListQueryV1` with bounded page token,
search text, family/lifecycle/creator filters, and an allowlisted sort
(`updated`, `created`, `title`). Opaque page tokens bind the Project, filter and
sort digest. Workspace writes carry `expected_revision`; retryable commands
carry idempotency. Unknown schema or operation versions fail closed.

## Project Overview and New Tab contract

Overview is an authorized composition, not a second Project aggregate. Its
full target and staged availability are fixed here:

| Surface | Required contract | Stage 03 | Later owner |
| --- | --- | --- | --- |
| Project identity | Name and editable description with version, authority and visible save result | Read and edit through the Control Project-profile operation | Stage 14 adds policy/admin controls |
| Create actions | Document, Workbook, Deck, Board and Chat actions | Return descriptors with honest availability; no fake create | Stages 04 and 08–10 register real creates; only Document/Workbook/Deck/Board have Templates, while Chat may have starter/settings presets |
| Unified catalog and favorites | One paged list across all Resource families; private Resource/Data favorite shortcuts; upload, open, exact-version family duplicate, search, filter, sort, archive/restore | Projection query, private reference aggregate and owner routing are real; only currently authorized decoration and real owner actions appear | Stage 05 enables upload; Stage 07 enables Data decoration; family stages provide summaries/actions |
| Members | Authorized members, roles, owner and sharing action | Bounded Control projection | Stage 14 adds full administration |
| Activity and history | Recent semantic Project activity and selected-Resource history | Explicitly unavailable until a projector is registered | Stage 12 owns Activity; families own canonical history |
| Data health | Current/stale/resolving/failed/needs-review counts and actionable items | Explicitly unavailable | Stage 07 Data Catalog projection |
| Project Agent | Sparse, evidence-linked recommendations with why-now and expiry | Explicitly unavailable | Stage 12 Agents/recommendations |
| Inspector | Project or selected-Resource metadata, lifecycle, provenance, version and owner-provided actions | Project/catalog metadata only | Family, Collaboration, Data and Agent adapters add facets |

New Tab is one transient launcher over the same authorized registry and catalog.
It offers the five editable-family create actions, Templates for Document/
Workbook/Deck/Board, Chat starter/settings presets, upload, recent/open
Resources, and bounded search/filter/sort. Stage 03 returns
the complete descriptor schema and only real registered availability. Document
create arrives in Stage 04, upload in Stage 05, and Workbook/Deck/Board/Chat
create in Stages 08–10. Choosing create/open replaces the launcher in place;
canceling or reloading persists no launcher, query, selection or draft.

## Operations

### Resource catalog

- list/recent/search/get summaries under current access;
- route create/duplicate/archive/restore/delete to the owning family handler,
  with duplicate freezing an exact owner version under a new same-Project
  identity and delete authorized by the current Project grant and deletion
  policy rather than a Resource-level owner;
- route rename under the family's expected canonical version;
- resolve a stable Resource reference; and
- return capability/kind metadata for launcher and tabs.

### Workspace

- load snapshot;
- compare-and-set replace/update;
- open/focus/reorder/close Resource tab;
- select permanent destination;
- update bounded panels;
- reconcile missing/inaccessible/archived Resource references safely; and
- list/add/remove/reorder private exact Resource/Data favorite refs under their
  independent expected revision, reauthorizing and decorating through current
  owners without copying content or authority.

### Product entry

- Project Overview projection with profile, catalog, private favorites,
  members, activity/history, data health, recommendations and explicit per-
  section availability;
- permanent destination descriptors;
- New Tab launcher catalog of actually registered/entitled capabilities,
  family-appropriate Templates or presets, upload and authorized Resource
  browsing;
- workspace bootstrap combining bounded authorized projections; and
- explicit unsupported response for unimplemented families.

## UI generation fencing contract

Every asynchronous client request captures session generation, Project
generation, and request generation. Switching Project or signing out aborts old
work and independently discards any late response whose generations no longer
match. Cancellation alone is insufficient.

## Persistence

The catalog projection, Workspace and favorite set live in the Project
Database. Repositories are different: catalog rows are version-stamped
rebuildable owner projections; Workspace and favorites are separate canonical
private aggregates using conditional replacement. All are scoped from the
bound Cell, never from payload User/Project identifiers.

Workspace and favorite-set last-write-wins is not implicit. Concurrent
replacements require expected version and return a conflict plus current
aggregate. A handler may retry a deterministic commutative tab or favorite
action against current state.

## Construction and request flows

Project entry resolves current Control authority and placement before creating
a bound Cell. `overview.get.v1` then performs one bounded fan-out: Project
profile and member summaries come from Control-safe projections; catalog and
workspace use the bound Project Database; optional Activity, Data and Agent
facets run only when their registered versions are available. One failed
optional facet produces a degraded section, while authority, placement,
catalog-integrity or workspace-integrity failure fails the whole response.

Create/open begins from `launcher.get.v1`, but the launcher stores nothing.
The client invokes the selected family's create/query operation; after success,
`workspace.open_resource.v1` records only the resulting stable Resource ref.
Archive and restore route through the owning family handler so canonical family
state and its catalog projection settle in one Project transaction.

## Authority, transaction, failure, and recovery

Every read reauthorizes and shapes nested projections. Every mutation derives
User and Project from the Cell, obtains a fresh one-use permit immediately
before commit, and atomically writes canonical owner state, its catalog
projection or Workspace state where applicable, idempotency, required Project
Audit, and any declared `SemanticFact`. Project-profile and member mutations
remain Control transactions; Overview never tries to combine them with a
Project transaction.

Stable failures cover invalid page/filter/sort, stale revision, unavailable
family, lifecycle conflict, inaccessible Resource mapped to `not_found`,
degraded optional projection, corrupt snapshot and placement/authority loss.
After a crash, canonical family Resource state wins; a stale/missing catalog
row is rebuilt from its exact owner version, a missing tab is repaired by
idempotent open, and an inaccessible tab is pruned by reconciliation. No cache,
realtime hint or Overview aggregate is required for recovery.

## API contracts

OpenAPI and generated Go/client types cover session-safe Project bootstrap,
catalog, workspace, and Overview. Transport limits, stable errors, ETags or
explicit expected versions, idempotency, and mutation receipts are normative.

No `/dev` or compatibility content surface exists. Capability routes appear
only when their real handlers are registered.

## Production and local/test composition

Production requires durable Control and Project repositories, current access,
the Resource-family registry, generated transport contracts and real Audit/
permit plumbing. It fails closed if any required adapter is synthetic or if a
registered action lacks its handler/schema version. Local/test composition may
use deterministic catalog families and optional-facet fakes, but must label
their availability and run the same Product descriptors, bounds and errors.

## Proof matrix

- durable workspace survives Host restart and multiple Cells;
- same User/different Project snapshots never cross;
- different Users/same Project have independent workspaces over shared catalog;
- stale Project/session responses are discarded by client contract fixtures;
- New Tab/selection/pending data never serializes;
- inaccessible/deleted Resource references reconcile without existence leaks;
- Resource/Data favorite add/remove/reorder is private, revision-safe and
  owner-reauthorized; access loss or deletion reveals nothing and never changes
  canonical owner state;
- concurrent tab changes and catalog rename/archive/delete follow documented
  version behavior;
- launcher exposes only registered, entitled, usable capability versions;
- Product OpenAPI generation/drift and DTO bounds pass;
- every mutation uses current authority, permit fencing, idempotency, and Audit;
- production has no memory repositories or synthetic access; and
- headless journey: sign in fixture → select durable Project → create a
  permitted catalog fixture through its family handler → open tab → restart →
  restore Overview/tab.

## Completion boundary

The Product can now enter a real Project and persist its shell, but it has no
editable Resource family. Stage 04 implements Documents without a legacy
content bridge.

## Consequential decisions and source grounding

- **Overview is a composition, not canonical truth.** This avoids duplicating
  Project, Resource, Activity, Data or Agent state. Revisit only if a measured
  latency budget requires a rebuildable materialized projection.
- **New Tab is transient.** Only the resulting Resource mount is durable;
  preserving launcher drafts would require a separately accepted resume model.
- **Unavailable is data.** A not-yet-built or unhealthy optional owner is named
  explicitly instead of returning plausible empty content.
- **Resource metadata has attribution, not Resource-level ownership.** Project
  grants remain the access boundary unless a future family explicitly accepts
  its own ownership model.

Grounding: [Workspace capability](../capabilities/workspace.md),
[Project-entry flow](../flows/project-entry.md),
[Control/Project boundary](../architecture/control-and-project-boundary.md),
and [product experience map](../product/experience-map.md).

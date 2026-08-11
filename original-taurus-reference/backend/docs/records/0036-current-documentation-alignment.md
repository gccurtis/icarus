# 0036 Current documentation alignment

This documentation increment audits every current-state documentation layer
against the accepted source tree after the Resource, Activity, share-link, and
prompt-route work. It removes stale pre-increment claims, restores companion
fidelity, and leaves historical records, pre-build plans/specs, and aspirational
reference material intact as history rather than rewriting them as current
contracts.

## `core/capability/access/access.go`

### Make package and port comments describe production

Replaces the original in-memory-only/SQL-next wording with the current
SQLite-production and memory-test arrangement, and counts all five Access store
ports including share links.

## `core/capability/access/access.go.md`

### Keep the Access companion verbatim

Updates the reproduced source comments alongside `access.go` so the companion
continues to match the source.

## `core/capability/access/memory.go.md`

### Count the share-link store in explanatory prose

Corrects the companion overview from four implemented Access interfaces to five.

## `core/capability/access/project.go`

### Describe current visibility semantics

Replaces the obsolete ID-based read self-join comment with visibility's actual
role as the master switch for read/edit share-link tokens.

## `core/capability/access/project.go.md`

### Keep the Project companion verbatim

Reproduces the corrected visibility comment exactly.

## `core/capability/document/document.go`

### Describe the complete current Document capability

Updates the package comment from “change sets come next” to the built base,
change-set, re-base, prompt-resolution, and Activity-fact model, without changing
runtime behavior.

## `core/capability/document/document.go.md`

### Keep the Document companion verbatim

Mirrors the source comment changes exactly.

## `core/capability/document/prompt.go`

### Document the implemented refresh gate

Removes the stale claim that refresh is future work and states its actual
no-change reuse behavior.

## `core/capability/document/prompt.go.md`

### Keep prompt source and explanation current

Mirrors the source comment and removes prose that treated the already-built gate
as a later increment.

## `core/capability/knowledge/knowledge.go.md`

### Restore byte-verbatim multi-query retrieval

Replaces abbreviated `RetrieveMany`/`poolRankings` pseudocode with the complete
current source, restores the omitted `strings` import, and explains its role.

## `dev-test/README.md`

### List the Formula names suite

Adds the existing offline name-manager suite to the end-to-end test catalog.

## `dev-test/names/manual.md`

### Pair the names runner with a manual

Adds the missing by-hand walkthrough for scalars, constructive/wholesale tables,
stored functions, evaluation, reads, and authorization.

## `docs/architecture/README.md`

### Index every current capability and status

Adds Activity and Resources, describes Formula's wired name-manager state layer,
and clearly labels Quarterback Ask as planned rather than implemented.

## `docs/architecture/capabilities/access.md`

### Reconcile Projects, links, stores, and routes

Corrects Project purpose/timestamp semantics, the five-store port set,
role-carrying share links, deletion cleanup, the entity diagram, and the complete
Access HTTP surface.

## `docs/architecture/capabilities/agents/ask.md`

### Mark Ask as an unimplemented design

Prevents a planned Quarterback consumer from appearing to be a routed
capability, while acknowledging the existing library-only Intelligence tool-use
loop.

## `docs/architecture/capabilities/documents/README.md`

### Align Document lifecycle and persistence

Updates block shape, prompt support, Resource summaries, Activity-atomic store
signatures, visible timestamps, rename, prompt resolve, and the two async
operations.

## `docs/architecture/capabilities/documents/atoms-and-marks.md`

### Separate implemented prompt blocks from deferred prompt atoms

Clarifies that inline generated atoms remain deferred while the standalone
prompt-block subtype is built.

## `docs/architecture/capabilities/documents/block-types.md`

### Describe the prompt kind as current state

Adds `Inferred`/`Data`, the prompt kind, and its grounded resolution behavior
instead of retaining its earlier open-design framing.

## `docs/architecture/capabilities/documents/data-model.md`

### Add the typed block subtype to the model

Updates the diagram and prose for `BlockData`, `PromptData`, `Inferred`, and
fail-closed payload validation.

## `docs/architecture/capabilities/formula/README.md`

### Distinguish the pure kernel from its wired state layer

Removes the obsolete wholly-headless description and documents Formula names as
the HTTP/SQLite consumer while retaining the evaluator's I/O-free boundary.

## `docs/architecture/capabilities/formula/name-manager.md`

### Label the remaining limitation accurately

Renames a misleading library-only heading now that the manager is wired.

## `docs/architecture/capabilities/formula/querying.md`

### Account for persisted name-manager tables

Clarifies that stored tables enter as materialized values while automatic
Resource scans and richer query-runtime features remain unimplemented.

## `docs/architecture/overview.md`

### Refresh the whole-system map

Updates handlers, all seven top-level capabilities, composition adapters,
persistence ports, Formula wiring, and both async Document operations.

## `docs/architecture/persistence.md`

### Document the complete store and job registry

Adds share links, Activity, Formula names, timestamp repair, atomic
Document/Activity writes, name transactions, prompt-resolution jobs, and the
current two-handler registry.

## `docs/architecture/transport.md`

### Reconcile the envelope, access tiers, dispatch map, and routes

Adds query parameters, Formula names, links/members, Users, Activity, Resources,
Document rename/resolve, and the complete current route table.

## `docs/backend-guide.md`

### Make the practical endpoint guide exhaustive

Adds the diagnostic and constructive-table routes, cursor semantics, all manual
links, and both asynchronous entry points.

## `docs/orientation/README.md`

### Orient against the current capability set

Adds Activity and Resources, corrects Formula wiring, tightens the companion
rule, expands current vocabulary, and removes the stale five-capability
baseline.

## `docs/orientation/alpha-omega-integration.md`

### Move the mission baseline past the completed request import

Records the implemented Resource/purpose/Activity/share-link slice, describes
stage progress honestly, and turns the former “bring in the first branch”
instructions into the ongoing request-reconciliation loop.

## `docs/records/0017-formula-core.md`

### Repair historical architecture links

Fix the relative targets without changing the record's historical claims.

## `etc/README.md`

### Point configuration docs at the current package

Replace the obsolete `core/config` target with `core/platform/config`.

---
title: "Work Packet — Ω-001 — Freeze Completion Baseline & Executable Contract"
notion_page_id: "3acb6410e50281dea887f4a804e87faa"
notion_url: "https://app.notion.com/3acb6410e50281dea887f4a804e87faa"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:43:41Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-001 — Freeze Completion Baseline & Executable Contract

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🔒" color="green_bg">
	**Execution baseline is now frozen.** Use Taurus Omega main commit [`50efd18413cc47935033889e51d58e9c828733e2`](https://github.com/gccurtis/taurus-omega/commit/50efd18413cc47935033889e51d58e9c828733e2), not the earlier moving planning anchors below. Record shipped Knowledge records/commits through the final resilient-ingest audit and carry forward the six unresolved `ING-1`–`ING-6` findings from [`docs/architecture/issues-and-gaps.md`](https://github.com/gccurtis/taurus-omega/blob/50efd18413cc47935033889e51d58e9c828733e2/docs/architecture/issues-and-gaps.md). Reconcile documentation drift discovered at freeze: the issues page still names `504c57e`; orientation still conflicts with the retired-companion rule; the runtime model overstates infrastructure-import isolation; and connector exact-read comments lag the current listing-plus-point-open behavior.
</callout>
## Frozen-head changes to the completion ledger
- Mark self-contained Knowledge windows, sliced commits, content-derived IDs, retry-bounded reconciliation, deferred corpus rebuild, and origin-backed exact reads as **as-built evidence**, not future packet work.
- Classify current `knowledge.read` as a **partial transitional implementation**: origin bytes are current, but discovery/authorization/identity still depend on Knowledge.
- Add explicit architecture-import and startup-registry inventories to the baseline gate.
- Keep all six unresolved ING findings linked to their revised packets and fail the completion matrix if any remains unowned.
> **Status:** Queued
> **Wave:** 0 — Stabilize current truth
> **Outcome:** establish one executable, version-pinned definition of “Taurus
> Omega complete” before feature packets change code.
## Why this packet exists
Omega was moving during initial planning; execution is now pinned to the frozen baseline named above. During this audit, main advanced from
`79ee190` through `b8ba4aa` and then to `67cb84d`: resilient-ingest Phase 3
landed, the remaining design was corrected, and Phase 4's first additive
window-storage step shipped. Workspace is being developed separately from
main. Alpha has nine current backend requests,
while 46 active Taurus Yesod Resources define a wider target. The repository's
as-built architecture pages are valuable but some still name older commits and
the legacy session-selected-Project/opaque-Workspace model.
Without a frozen executable baseline, later agents will duplicate shipped work,
follow stale paths, or call a packet complete because files exist rather than
because the backend can demonstrate the behavior.
This packet changes no product behavior. It creates the audited completion
ledger, test harness, and branch/cutover discipline that every later packet
uses.
## Evidence at planning time
- Omega main was most recently refreshed at
	[`67cb84d`](https://github.com/gccurtis/taurus-omega/commit/67cb84da35625c781b15ef655c7a6a393a58f4ce):
	Phases 1–3 were complete, Phase 4's additive `Window.Text`/`Window.Blocks`
	storage and backfill had landed, and the remaining Phase 4 cutover was still
	open. The earlier `b8ba4aa` review remains the broad capability/route audit
	baseline.
- Alpha main was reviewed at
	[`aee8465`](https://github.com/gccurtis/taurus-alpha/commit/aee846567e77d5bc13b264479fd19d2994babbc0).
- Alpha `docs/backend-requests/README.md` lists exactly nine open Omega asks.
- Taurus Yesod has 46 active related Resources: 42 Primary and 4 Supporting.
- Omega currently composes 20 capabilities over one WAL-mode SQLite Store.
- Only Document and Connector implement `resource.Family`; Spreadsheet and
	Slides do not exist, and Chat is not a revisioned Resource family.
- Main still contains the legacy opaque `GET/PUT /workspace` implementation.
- Office/PDF workers, production manifests, an object-store adapter, and the
	User Cell / Project Subcell registries do not exist.
Ω-001 must refresh every statement against the actual execution baseline. The
commit above is evidence, not a command to reset or discard newer work.
## Scope
Create:
```plain text
docs/completion/
  README.md
  omega-completion-matrix.md
  route-scope-inventory.md
  persistence-inventory.md
  dependency-license-inventory.md
  accepted-deferrals.md

scripts/acceptance/
  omega-baseline.sh
  omega-route-inventory.sh

dev-test/completion-baseline/
  run.sh
  README.md
```
Exact placement may follow newer repository conventions, but the information
and executable gates are required.
## Non-goals
- Do not implement a capability, route, migration, or UI contract.
- Do not merge or rewrite the Workspace branch.
- Do not rename packages or perform a cleanup sweep.
- Do not reopen archived Alpha requests wholesale.
- Do not turn aspirational Notion paths into empty scaffolding.
- Do not add a third-party dependency merely to generate the inventory.
## Required inventories
### Capability and resource matrix
One row per capability/resource with at least:
```go
type CompletionRow struct {
    Capability       string
    ProjectScoped    bool
    CanonicalModel   string
    ServicePackage   string
    StorePort        string
    SQLiteAdapter    string
    ResourceFamily   string
    HTTPRoutes       []string
    DispatchModes    []string
    CallerAwareReads bool
    RevisionModel    string
    Jobs             []string
    LiveDelivery     string
    ContractTests    []string
    DevTests         []string
    AsBuiltDocs      []string
    TargetSpecs      []string
    CompletionPacket string
    State            string // shipped | partial | missing | in-flight | superseded
}
```
The matrix must distinguish:
- shipped behavior;
- code present but uncalled/unwired;
- prototype behavior that conflicts with the target model;
- active work on another branch;
- target-only behavior;
- explicit V1 exclusions.
### Route and authority inventory
Derive the inventory from the real route/dispatch registry rather than typing a
second list by hand. Every route receives exactly one scope:
```go
type RouteScope string

const (
    ScopePublic      RouteScope = "public"
    ScopeUser        RouteScope = "user"
    ScopeOrgAdmin    RouteScope = "organization_admin"
    ScopeProjectMeta RouteScope = "project_directory"
    ScopeProject     RouteScope = "project_execution"
    ScopeOperator    RouteScope = "operator"
)
```
For each route record:
- operation name and method/path;
- handler and owning capability;
- current middleware;
- required caller/Project/action context;
- response-body resource references;
- dispatch mode and serial key;
- idempotency/revision behavior;
- error/redaction contract;
- completion packet.
The executable gate fails when a registered route has no owner/scope or a
serial/deferred route lacks its required key/spec.
### Persistence inventory
Capture:
- every current table, index, foreign key, additive migration, and backfill;
- the owning Store port and capability;
- whether Project/caller scope appears in each lookup;
- canonical versus rebuildable/derived data;
- CAS, idempotency, lease, and retention semantics;
- large inline payloads that must move behind the object Store;
- legacy tables parked for later cutover;
- fixtures for a fresh database and a representative upgraded database.
Record current startup-migration behavior honestly. Later packets will introduce
explicit production migration artifacts; Ω-001 does not.
### Dependency and license inventory
Generate a reproducible inventory of Go modules and any existing external
runtime/tool dependency:
- package/module and pinned version;
- license and source URL;
- whether it is linked, invoked as a subprocess, or distributed in an image;
- production purpose;
- security/update owner.
The baseline gate fails for an unknown/proprietary dependency. Future packets
may add only free/open-source dependencies, preferring permissive licenses.
## Sequential implementation
1. **Pin the execution baseline.** Record branch, full commit, dirty state, Go
	version, operating system, config profile, schema hash, and relevant in-flight
	branches/plans. Never reset or discard unrelated work.
2. **Run the existing repository gates.** Capture exact commands and results:
	build, unit/integration tests, race tests where currently supported, format,
	companion checks, existing dev-test suites, and current live-suite
	prerequisites.
3. **Generate the route inventory.** Add a test/export seam around the real
	registry. Avoid a parallel handwritten registry.
4. **Generate the schema inventory.** Build fresh and upgraded fixtures and
	record deterministic schema output.
5. **Write the capability/resource matrix.** Reconcile code, Alpha's nine asks,
	and all active Yesod Resources. Link every non-shipped row to exactly one
	packet in this program.
6. **Record accepted deferrals.** Include audio/video, legacy XLS, slide
	animations/transitions, editable PDF import, commercial libraries,
	organization-owned library masters, and premature distributed placement.
7. **Create the baseline acceptance script.** It runs without paid provider
	calls and reports optional live suites separately.
8. **Update as-built orientation.** Correct stale commit anchors and clearly
	label target links as target, without claiming later packets have shipped.
9. **Write one numbered change record.** Include inventory hashes, commands,
	failures discovered, and links to the program/packets.
## Security and privacy requirements
- Inventory output contains no cookies, tokens, prompts, resource bodies,
	connector secrets, DSNs, signed URLs, or raw personal identifiers.
- Hash or replace fixture IDs and emails.
- Explicitly flag caller-blind reads, response-body resource references,
	retrieval evidence, connector source admission, filesystem/URL exposure, and
	fail-open middleware.
- A green baseline does not waive a known vulnerability; it records it and
	points to its blocking packet.
## Tests and gates
- Route inventory covers 100% of registered routes and dispatch operations.
- Capability matrix covers every package under `core/capability`.
- Persistence inventory matches a freshly migrated Store and an upgrade fixture.
- Every Alpha open request maps to at least one packet and none maps only to an
	archived request.
- Every active backend-relevant Yesod Resource maps to a packet or an explicit
	frontend-only/accepted-deferral classification.
- Every packet ID appears exactly once in the matrix.
- Baseline script fails on an unclassified route, table, capability, dependency,
	or open request.
- Existing repository gates remain green.
## Completion evidence
Attach to the packet:
- baseline commit and branch;
- clean/dirty state explanation;
- generated inventory hashes/counts;
- exact command transcript;
- current known failures and whether they pre-existed;
- links to the committed ledger and change record;
- explicit confirmation that no product behavior changed.
## Dependencies and unlocks
Depends on: none.
Unlocks: every later packet. No later packet may silently replace Ω-001's
baseline; it records its own new baseline and updates the completion matrix as
work ships.
## Sources
- [Omega repository](https://github.com/gccurtis/taurus-omega)
- [Omega runtime model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/runtime-model.md)
- [Omega persistence model](https://github.com/gccurtis/taurus-omega/blob/main/docs/architecture/persistence.md)
- [Alpha current backend requests](https://github.com/gccurtis/taurus-alpha/blob/main/docs/backend-requests/README.md)
- [Workstreams — Taurus Product Completion](https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd)
- [Implementation — Control Plane, User Cell & Project Subcell Integration](https://app.notion.com/p/3acb6410e50281b2999bce58d559d902)


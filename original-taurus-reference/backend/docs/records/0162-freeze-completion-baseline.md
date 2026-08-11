# 0162 — Freeze the Omega completion baseline

## Baseline and decision

Ω-001 began from a clean `main` at
`c0d072556919048b495e729736cf78a7d28e68d3`, on branch
`agent/omega-001-completion-baseline`, with no predecessor packet. The packet's
`50efd18413cc47935033889e51d58e9c828733e2` is retained as its planning anchor;
the repository was not reset to it.

The audited host was `go1.26.4 linux/amd64` on
`Linux 7.1.3 x86_64 GNU/Linux`. The starting schema source hash was
`6e2951dd879526a8a66f5fedd4c06d902a4bc808079d0bbeb9a3643209aec8d1`.
Current Alpha had ten asks, not the planning-time nine; the Yesod manifest had
176 pages, not the earlier 46-resource review set. Both current values became
gated inputs.

The central decision was to make completion a drift detector over real seams:

```text
routes.go + operationMode + operationSerialKey → route inventory
sqlite.Open + sqlite_schema + PRAGMAs        → persistence inventory
go list + source manifests                   → package/dependency/import coverage
Alpha checkout + Yesod manifest              → cross-repo/spec coverage
```

Tests live in the owning packages so they can inspect the actual unexported
registries. That avoids a second production registry or a public API invented
only for documentation. The alternative—hand-maintaining route and schema
tables—was rejected because it could go green while runtime wiring drifted.
Adding a generator dependency was also rejected; the standard library and
existing shell/Go tools are enough.

No Workspace or Slides branch was merged, no future capability was scaffolded,
and none of the security findings was “fixed” by weakening its acceptance
language. Ω-001 records and owns current truth; later packets change behavior.

## `core/transport/completion_inventory_test.go`

### Derive and freeze every route contract

```go
func TestCompletionRouteInventory(t *testing.T) {
    rows := completionRoutes(t)
    generated := renderCompletionRoutes(rows)
    // update only under OMEGA_UPDATE_COMPLETION_INVENTORIES=1
}
```

The test parses `routes.go`, then consults the real `operationMode` and
`operationSerialKey` maps. Every route must have one operation, handler, owner,
scope, middleware/context description, response-reference classification,
dispatch/key/spec, mutation contract, error/redaction contract, and packet
owner. It also proves every dispatch operation is installed exactly once.
Generated Markdown is a golden output; changing runtime source without reviewing
the inventory fails.

## `core/platform/storage/sqlite/completion_inventory_test.go`

### Compare fresh and upgraded Stores

```go
freshSchema := completionSchema(t, fresh.db)
upgradedSchema := completionSchema(t, upgraded.db)
if freshSchema != upgradedSchema {
    t.Fatal("fresh and representative upgraded databases do not converge")
}
```

The test opens the real Store fresh, creates a pre-current `users` table plus a
synthetic row in a second database, and opens that through the startup migrator.
It requires exact normalized schema convergence and preserved fixture data. It
then classifies all 38 tables and all 71 indexes (29 explicit plus 42 automatic
constraint indexes), including Store port, physical/caller scope, authority,
foreign keys, transaction/CAS behavior, retention, and inline/legacy boundaries.

## `core/capability/connector/sync.go`

### Remove obsolete whole-snapshot narration

```go
// It lists the source and opens one member.
```

The old comment said exact reads materialized the whole source, immediately
before the current comment described listing plus point-open. Removing the
obsolete phase narrative makes the source match shipped provider behavior; no
executable code changed.

## `core/wiring/source_origin.go`

### Describe current connector origin reads

```go
// ReadFile performs a metadata listing and opens exactly that member.
```

The wiring comment now records the current exact-read path instead of the
retired snapshot behavior. It also makes clear that lattice identity-to-key
resolution remains transitional work.

## `core/transport/dispatch.go`

### Correct the process-placement claim

```go
// The process serves multiple users and projects ...
```

The dispatch rationale no longer calls the current server a single-tenant cell.
The process is multi-user today; request goroutines and bounded downstream pools
are the current concurrency mechanisms. The target cell model does not become
as-built merely because planning documents name it.

## `docs/completion/README.md`

### Pin the baseline and entry points

```text
Actual approved main start: c0d072556919048b495e729736cf78a7d28e68d3
Routes: 142 / dispatch operations: 137
Tables: 38 / indexes: 71 total, 29 explicit
```

The index records branch, clean state, host, config, source hashes, Alpha/Yesod
drift, in-flight branches, inventory hashes, commands, optional live gates, and
the distinction between exhaustive baseline coverage and product safety.

## `docs/completion/omega-completion-matrix.md`

### Give each packet exactly one completion row

```text
state = shipped | partial | missing | in-flight | superseded
```

The 44-row matrix distinguishes working, transitional, target-only, separate-
branch, and conflicting prototype behavior. It covers all 21 capability
packages, current routes/stores/families/revisions/jobs/live delivery, contract
and dev evidence, target specs, and every packet once. The six unresolved ING
findings stay explicitly owned.

## `docs/completion/route-scope-inventory.md`

### Commit generated route evidence

```text
Routes: 142
Dispatch: concurrent 132, serial 3, deferred 2, direct 5
```

The generated table is the review surface for the route test. It visibly flags
caller-blind reads, fail-open document resolution, connector source admission,
operator-path gaps, and response-body resource references without storing
request bodies, cookies, prompts, or secrets.

## `docs/completion/persistence-inventory.md`

### Commit generated schema and migration evidence

```text
Application tables: 38
Indexes: 71 total (29 explicit, 42 automatic constraints)
Additive compatibility columns: 44
```

The document records fresh/upgrade convergence, every table/index/foreign-key
classification, all additive columns, named backfills/repairs, inline object
boundaries, and the historical `user_version < 1` Document-data reset. That
existing irreversible dev migration is named as a production risk rather than
hidden.

## `docs/completion/dependency-license-inventory.tsv`

### Pin all Go modules mechanically

```text
module	version	license	linkage	purpose	security_update_owner	source
```

All 40 non-root modules from `go list -m all` have a version, FOSS license,
source, linkage classification, purpose, and update owner. Linked-production
modules are distinguished from graph-only generator/test/tool modules.

## `docs/completion/dependency-license-inventory.md`

### Explain distribution and external-tool boundaries

```text
No dependency was added by Ω-001.
```

The prose records the graph-only MPL-2.0 module, embedded pure-Go SQLite,
current main binaries, and environment-provided Go/shell/curl/jq tools. Optional
OpenRouter and connector endpoints are services/data sources, not bundled
software dependencies.

## `docs/completion/accepted-deferrals.md`

### Make V1 exclusions explicit

```text
audio/video; legacy XLS/macros; slide animation; editable PDF import;
commercial libraries; organization-owned masters; premature distribution
```

Each exclusion says both what is deferred and what bounded behavior remains
allowed. Deferral never waives authorization, recovery, or resource limits for
the product that does ship.

## `docs/completion/alpha-request-map.tsv`

### Reconcile the current ten Alpha asks

```text
project-level-presence.md	10	omega-014,omega-018	open
```

Every live file in Alpha's `docs/backend-requests/` maps to one or more current
Omega packets. No row maps only to an archived request. The map deliberately
records ten rather than preserving the packet's stale planning-time count.

## `docs/completion/yesod-resource-map.tsv`

### Classify non-packet Yesod pages

```text
local_path	classification	completion_owner
```

The 65 Primary/supporting non-packet pages are mapped individually to backend
packets/programs or `frontend-only`. Acceptance rules additionally classify
all 44 Omega packet mirrors to themselves and all 67 Alpha execution packets as
frontend-only for the backend matrix, producing exhaustive 176-page coverage.

## `docs/completion/architecture-import-map.tsv`

### Freeze the sanctioned capability import edges

```text
core/capability/agent	core/capability/document	sanctioned-composition
core/capability/formula/names	core/capability/formula	sanctioned-library
```

The seven current capability-to-capability edges have a classification and
rationale. `go list` output must match this file exactly, so architecture drift
cannot hide behind an absolute but already-false “never imports” slogan.

## `docs/completion/architecture-startup-inventory.md`

### Record the actual composition root

```text
21 capability packages; 2 Resource families; 4 durable job handlers
```

The startup inventory records SQLite as the root, Document and Connector as the
two families, the four registered job types, current background loops, and the
route/dispatch count. It labels User Cell/Project Subcell registries as target
work.

## `scripts/acceptance/omega-route-inventory.sh`

### Provide the narrow route drift gate

```bash
go test ./core/transport -run '^TestCompletionRouteInventory$' -count=1
```

The default verifies the committed generated section. `--update` opts into
regeneration so a reviewer must inspect the resulting diff.

## `scripts/acceptance/omega-baseline.sh`

### Compose the no-provider acceptance contract

```bash
./scripts/check-format.sh
go build ./...
go test ./...
go test -race ./...
```

Before the broad gates, the script checks route/schema goldens, 44 unique packet
rows, 21 capability packages, ING ownership, exact architecture edges, four job
registrations, 44 additive columns and six migration steps, module/license
coverage, ten Alpha requests, and 176 Yesod resources. It uses a validated
temporary directory and never invokes a provider suite. `--inventory-only`
provides the fast subset; `--with-free-dev-tests` explicitly adds the no-provider
HTTP suites.

## `dev-test/completion-baseline/run.sh`

### Expose the acceptance contract under the dev-test convention

```bash
exec "$repo_root/scripts/acceptance/omega-baseline.sh" "$@"
```

The thin entry point keeps one implementation of the contract and forwards all
arguments.

## `dev-test/completion-baseline/README.md`

### Document cost-free and paid execution separately

```text
default: no provider calls
optional paid: ./dev-test/run.sh intelligence
```

The manual states that a credential skip is not a pass and shows the inventory,
full, free-black-box, and paid-live entry points.

## `dev-test/run.sh`

### Make the `free` label true

```bash
intelligence_suites=" ... knowledge-scale ... web "
```

The pre-edit `./dev-test/run.sh free` passed but wrongly selected
`knowledge-scale`; with a local key it made real embedding calls, and the first
sync alone reported 1,207,594 prompt tokens. Live web could also spend when
fully configured. Both suites are now in the provider-backed set, so `free`
cannot select them.

## `docs/architecture/runtime-model.md`

### Refresh current runtime truth

```text
multi-user modular monolith; 21 Go capability packages; 137 dispatch operations
```

The baseline SHA, process model, import exceptions, operation-map names,
background lifecycle, counts, and Formula/Knowledge/Agent edges now match the
code. User Cells remain explicitly target work.

## `docs/architecture/transport.md`

### Reconcile the split transport implementation

```text
routes.go → routes; dispatch.go → operationMode; transport.go → options/guards
```

The transport guide now names the real files, constants, 137-operation count,
diagram labels, dispatch modes, and exhaustive map.

## `docs/architecture/persistence.md`

### Use current dispatch names around durable jobs

```go
var operationMode = map[string]executionMode{ /* ... */ }
```

The persistence guide's async path now matches `dispatchConcurrent`,
`dispatchSerial`, and `dispatchDeferred`; the durable queue semantics did not
change.

## `docs/architecture/issues-and-gaps.md`

### Refresh the audit anchor and preserve ingest ownership

```text
ING-1, ING-2, ING-4 → Ω-003
ING-3               → Ω-007
ING-5, ING-6        → Ω-005
```

The register now names the execution baseline, correct dispatch count/map in its
fixed note, and a completion owner on every still-open ingest finding. Their
severity and proposed fixes remain unchanged.

## `docs/architecture/live-document-walkthrough.md`

### Label exact reading as transitional

```text
origin bytes are current; discovery, authorization flow, and identity still
begin from Knowledge
```

The walkthrough no longer implies that a uniform tool shape proves separation
from Knowledge. Ω-002 owns that remaining boundary.

## `docs/architecture/capabilities/documents/README.md`

### Refresh Document dispatch names

```text
dispatchDeferred / dispatchConcurrent
```

The capability guide points to `dispatch.go` and uses the current mode names.

## `docs/architecture/capabilities/notification.md`

### Correct the current placement assumption

```text
Omega is a single process today.
```

Ephemeral delivery remains an accepted current trade, but it is no longer
justified by a false single-tenant-cell claim.

## `docs/architecture/capabilities/presence.md`

### Bound the in-memory claim to single-process reality

```text
Project-level and subcell-safe presence remain target work.
```

The no-sweeper trade remains unchanged and is now scoped to current deployment.

## `docs/orientation/README.md`

### Retire absolute import and stale capability statements

```text
21 Go packages; Document + Connector families; Ask through Chat turns
```

Orientation now points to the executable import inventory, permits
infrastructure-neutral platform mechanisms without concrete adapters, and
removes stale claims that Ask is unrouted or Document is the only family.

## `docs/orientation/alpha-omega-integration.md`

### Apply the retired-companion and current-integration rules

```text
tests + numbered record; do not create .go.md companions
```

The Alpha handoff now recognizes Connector as a family, Chat-routed Ask, and the
retired companion convention. It keeps ports as the normal leaf boundary while
allowing inventoried composition/type edges.

## Validation

Pre-edit gates on the starting SHA:

```text
./scripts/check-format.sh  PASS
go build ./...             PASS
go test ./...              PASS
go test -race ./...        PASS
./dev-test/run.sh free     PASS, but exposed the paid-suite classification bug
```

Final focused validation:

```text
bash -n scripts/acceptance/omega-baseline.sh \
  scripts/acceptance/omega-route-inventory.sh \
  dev-test/completion-baseline/run.sh dev-test/run.sh
./scripts/acceptance/omega-baseline.sh --inventory-only
git diff --check
```

All passed. Final broad validation:

```text
./scripts/acceptance/omega-baseline.sh  PASS
  ├─ ./scripts/check-format.sh          PASS
  ├─ go build ./...                     PASS
  ├─ go test ./...                      PASS
  └─ go test -race ./...                PASS
./dev-test/run.sh free                  PASS; no provider/cost summary
```

## Operational effect and remaining risk

No API, model, route, table, startup migration, or product behavior changed.
Default inventory tests are read-only except when the explicit regeneration
environment variable is set; their databases live under test temporary
directories. The only runner behavior change prevents cost under a command
labeled free.

Known caller-blind reads, fail-open document middleware, response-body resource
references, retrieval-evidence scope, connector filesystem/URL admission,
irreversible historical startup reset, inline file/vector data, operator-path
authorization, and missing production backup/restore remain risks. They are
visible in the ledger and assigned to later packets; a green baseline does not
waive them.

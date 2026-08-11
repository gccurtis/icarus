# Stage 07 — Formula, names, Project data assets, and lineage

## Outcome

Build a pure typed Formula language plus Project-scoped named definitions,
tables, canonical Project data assets, lineage, and a Data catalog projection.
It becomes the deterministic computation substrate for Workbooks and live values
in Documents, Decks, and Boards.

## Non-goals

- spreadsheet UI or workbook editing
- model/network/Knowledge calls from pure Formula evaluation
- silently coercing unsupported values to strings
- analytic code sandbox in the initial slice
- Data catalog as canonical owner or authorization source

## Target tree and files

```text
internal/
  capabilities/{formula,dataobjects,datacatalog}/
  cell/handlers/{formula,dataobjects,datacatalog}/
  cell/handlers/{formula,dataobjects,datacatalog}/mysql/
  host/jobs/dataobjects/refresh/       exact-input leased execution/settlement
  wiring/{testing,development,production}/data.go
migrations/project/*_{formula,data_assets,data_catalog}.sql
api/openapi/product-v1.yaml
test/{integration,security,recovery,golden}/data/
```

`dataobjects` is not under `capabilities/resources`: a canonical Project data
asset has its own governance/version contract and is not a common Resource
family.

## Versioned contracts and schemas

Register the exact Formula, Project data-asset and Data Catalog operations from
[Formula and Data](../capabilities/formula-and-data.md#commands-and-queries),
with no stage-local aliases. Schemas version the Formula language/AST, stable
Name IDs/bindings/lifecycle, immutable data schema/data versions and aggregate
lifecycle, review/override
provenance, current/last-good pointers, lineage edges and rebuildable catalog
rows. Data refresh schemas include stable typed definitions, exact request/
generation/input manifests, Job/receipt/work references, attempt state,
candidate diff/provenance and conditional settlement metadata. Unknown
language, value, reference, schema or operation versions fail closed.
`ValueResolver` returns only committed exact values; analytic
`SandboxRunner` belongs to [Stage 07A](07a-analytic-compute.md).

## Formula core

- lexer/parser/AST with stable syntax and source spans;
- typed values: null, boolean, number/decimal policy, text, date/time policy,
  list, record, table, error, and stable Resource/value references;
- explicit type/coercion rules;
- arithmetic, logical, comparison, conditional, text, date, lookup, aggregate,
  statistical, list/record/table built-ins;
- deterministic evaluation under explicit limits;
- dependency extraction and cycle detection;
- explain/diagnostic output with safe source spans; and
- canonical encoding/versioning for stored definitions.

Volatile or provider-backed functions are not part of the pure evaluator.
Future AI functions are separate operations that materialize typed results with
provenance before Formula consumes them.

## Names and bindings

Project state can define named formulas, constants, tables, variables, and
stable aliases to authorized Resource components. Names have stable IDs,
display names, namespace/scope, definition version, dependencies, owner,
visibility, and lifecycle. Name resolution is explicit and Project-bound.
`formula.get_name.v1` resolves by stable NameID and
`formula.list_names.v1` returns a cursor-bounded authorization-shaped Project/
scope projection; neither operation resolves an ambiguous mutable display
name or triggers calculation.

A Resource binding stores formula source/definition reference, inputs, expected
dependencies, last typed value/error, revision, and staleness. The owning
Resource decides rendering and update incorporation.

## Canonical Project data asset

A governed canonical Project data asset outside the common Resource-family
catalog containing:

- stable object/schema/record/field IDs;
- immutable schema and data versions;
- typed scalar/record/list/table values;
- exact field-level provenance and transformations;
- user overrides separate from generated/imported proposal;
- draft/reviewed/published/archived lifecycle;
- current/stale/refreshing/needs-review/failed-with-last-good state; and
- stable refresh-definition revisions, exact durable request generations,
  frozen committed source/input manifests, refresh diff and lineage.

Missing remains missing. Model-assisted extraction arrives through Resolution
as a typed cited proposal and cannot invent filler, citations, keys, or types.
Refresh never auto-publishes: successful settlement creates one immutable
reviewable candidate, advances the current candidate pointer and preserves the
prior validated last-good version until the ordinary publish command promotes
it. Stale, canceled or failed work creates no candidate and never clears
last-good.

## Data catalog

A rebuildable access-shaped projection over Sources, Project data assets, names,
Formula definitions/results, Resolution Results, templates, corpora/connectors,
lineage/freshness, runs, and history. It delegates operations to owners and
cannot grant authority or become Evidence. `datacatalog.get.v1` returns one
authorization-shaped owner detail projection; list/lineage/impact remain
independently bounded queries.

## Operations

- parse/validate/explain/evaluate and strictly bounded pure recalculation
  against an explicit exact-value resolver;
- create/update/rename/archive named definitions and tables under expected
  version, plus get/list safe Name projections by stable identity;
- evaluate a bounded dependency graph and affected definitions in memory only;
- create/import/update/review/publish/archive canonical Project data assets;
- apply/reject field proposals and user overrides;
- set an inert typed refresh definition; idempotently request/cancel durable
  refresh; query exact status; and conditionally settle one normalized internal
  proposal/failure under exact request/input/work preconditions;
- query upstream/downstream lineage and impact; and
- get/list/filter Data catalog detail/summaries and current states.

## Persistence/concurrency

Pure Formula state is passed by value. Named definitions and Project data
assets have capability-owned Project repositories and conditional versions.
Dependency and catalog indexes are rebuildable projections. Updates that
change a definition and its canonical dependency edges commit atomically.
`formula.recalculate.v1` is a strictly bounded pure Query: it creates no Job,
WorkAuthority, artifact, idempotency/Audit row, cache entry or owner mutation,
and limit exhaustion returns the stable Formula limit error with no side
effect. Any durable scheduling and result materialization belongs to the
consumer capability that owns the binding and displayed/last-good state.

Data refresh is separately durable. The request transaction conditionally
locks the exact Data Object and refresh-definition revisions, freezes committed
source/input versions, increments the refresh generation, preserves last-good,
and atomically stores Request, Job, receipt, idempotency, required Project Audit
and the ordinary durable-work finalizer registration. Candidate schema/data
versions are immutable inserts. Internal settlement conditionally advances the
candidate/review pointer only when the request, definition, every input,
generation, lease fence and authority still match; stale work cannot substitute
newer inputs or overwrite a later Object revision.

## Authority, transactions, failure, and recovery

Every exact Name, binding, data asset and lineage node is authorized under the
bound Project. Name/data-asset mutations consume a fresh permit and atomically
commit canonical versions, idempotency, dependency edges and required Project
Audit. Pure evaluation consumes no permit; a consumer commits accepted output
under its own protocol. Name and Data Object archive/restore/tombstone use
explicit lifecycle operations and preserve retained exact reference/lineage
integrity. Expected revisions and immutable inserts prevent blind replacement.

`dataobjects.refresh.request.v1` uses the ordinary
`DurableWorkAuthority{PendingProjectReceipt}` handshake and preselected exact
RefreshRequest/WorkAuthority/Job identities. Only trusted acknowledgement of
the committed Project receipt activates work. A leased worker performs exact-
input provider work outside a transaction and without holding a permit.
`dataobjects.refresh.proposal.settle.v1` rechecks the exact Object,
definition, source/input versions, request/work/Job/receipt/generation and
lease fence, then consumes a fresh work-sourced permit in the same Project
transaction as the immutable candidate or safe stale/failure outcome,
idempotency, lineage and required Audit. Definition/input advancement,
cancellation, authority revocation or lease loss fences the result. After
revocation the restricted Job finalizer may update Job bookkeeping only; it
cannot write a candidate or alter current/last-good state.

Recovery uses the exact receipt, stable request/generation and candidate
digest. Crash before request commit leaves no work; commit-before-acknowledgement
reconciles from the receipt; lease takeover fences the old worker; and
settlement-before-acknowledgement returns the already committed candidate or
outcome without duplication. `dataobjects.refresh.status.get.v1` is a bounded
read-only Query and creates no work. Publish remains a separate current-session
review command; refresh never auto-publishes.

Stable failures include syntax/type/reference/cycle/limit,
duplicate name, stale version, schema/provenance mismatch, inaccessible input
and corrupt lineage, plus refresh conflict/stale-input/rejected/canceled.
Catalog/dependency projections rebuild from owners;
canonical name/data versions recover through Project backup/restore.

## Production and test composition

Production wires durable owner repositories, strict language/schema registries
and an authorization-shaped catalog projector plus a durable refresh request/
settlement adapter; Formula has no provider, network or analytic-code escape.
Pure tests use plain resolvers, deterministic refresh providers and projector
fixtures. Live Project database concurrency, durable-work receipt/lease
recovery, rebuild and restore are required; memory catalogs and allow-all
resolvers are test-only.

## Proof matrix

- parser/evaluator table, property, fuzz, and golden tests;
- determinism, numeric/date policy, limits, and typed errors;
- dependency extraction/cycles and Project name isolation;
- hostile/deep/large expression bounds;
- unsupported Resource-context rendering is explicit;
- concurrent name/data version updates; bounded Formula recalculation proves
  deterministic output or limit error and zero Job/work/artifact/idempotency/
  Audit/owner writes;
- Name get/list bounds, exact stable-ID lookup, lifecycle visibility and
  unauthorized-existence hiding;
- Name and Data Object lifecycle transition races, retained-reference
  reproducibility and fail-closed new use after archive/tombstone;
- exact per-field provenance, overrides, refresh diffs, last-good behavior;
- refresh request exact/divergent replay, definition/source/input advancement,
  provider failure, cancellation, authority revocation, lease loss, stale
  settlement, all request/ack/provider/settlement crash boundaries, one-
  candidate maximum, fresh-permit/Audit atomicity and no auto-publish;
- Data catalog get/list authorization, deletion/staleness reconciliation, and
  rebuild;
- Formula core imports no provider/network/Knowledge/runtime package; and
- headless typed evaluation plus live-MySQL name/data/lineage journey.

## Completion boundary

The deterministic language, governed data substrate and durable reviewable
refresh path are ready. Stage 08
defines Workbook-specific cells, ranges, tables, calculation, and editing on
top of them. [Stage 07A](07a-analytic-compute.md) separately promotes the
hardened analytic sandbox intentionally excluded here.

## Consequential decisions and source grounding

- **Formula stays pure:** model work materializes typed versions before
  evaluation; volatile AI functions are excluded.
- **Project data assets are not a seventh common Resource family:** they may be
  projected or mounted, but do not inherit catalog/editor semantics.
- **Data Catalog is rebuildable:** it shapes discovery but cannot grant
  authority or replace owner state.

Grounding: [Formula and Data](../capabilities/formula-and-data.md),
[persistence and concurrency](../architecture/persistence-and-concurrency.md),
and [Stage 07A](07a-analytic-compute.md).

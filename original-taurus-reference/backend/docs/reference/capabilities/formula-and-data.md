# Formula and Data capabilities

## Purpose, ownership, and boundary

This document defines four related but distinct capability libraries:

- **Formula**: one pure, typed, deterministic expression language plus the
  semantics of stable Project-scoped named definitions;
- **Data Objects**: governed structured scalar/record/list/table Project data
  assets, initially outside the six common Resource families;
- **Data Catalog**: an authorization-shaped, rebuildable projection of Project
  data and lineage; and
- **Analytic Compute**: bounded, sandboxed computation over pinned read-only
  datasets that produces typed result artifacts.

They share value/reference/lineage vocabulary, not canonical storage. Formula
does not own consumer values. Data Catalog does not own the objects it lists.
Analytic output is not canonical Resource state until an explicit owner command
materializes it.

These capabilities do not own authorization, Resource-family content,
Knowledge evidence, Resolution refresh, model providers, workspace UI, or
Project placement. No Formula evaluation may perform network, storage, clock,
random, Intelligence, Knowledge, Resolution, or arbitrary-code work.

## Feature contract

| Area | Feature | Required behavior | Initial boundary | Retained breadth |
| --- | --- | --- | --- | --- |
| Formula | Language | Parse, validate, type, evaluate, and explain versioned source | Core literals, refs, arithmetic, logic, text | Rich typed function library |
| Formula | Values | Immutable text, logic, decimal, null, list, record, table, object, and typed error | Scalars/list/record/table | Domain-specific object shapes |
| Formula | Names | Stable `NameID` distinct from display name for Formula-owned Project definitions; family-local named ranges/components remain family-owned but use the same language rules | Project names | Rich namespaces and rename tooling |
| Formula | Consumer mounts | A Resource family owns its stable slot/mount, expression, expected type, dirty state, and displayed/last-good result; Formula validates/evaluates supplied values | One consumer seam | All visual families and Templates |
| Formula | References | Exact-version consumer-supplied resolver; unresolved/dirty/waiting is a value error | Resource/Result refs | Range/field/query refs |
| Formula | Recalculation | Dependency graph, cycle detection, deterministic order, bounds, dirty propagation | Explicit request | Fan-out scheduling/materialization |
| Formula | Assistance | Intelligence may propose source outside evaluation; deterministic engine validates it | Optional | Contextual composer |
| Data Object | Typed state | Scalar/record/list/table with immutable schema and data versions | Authored/imported table | Large and nested objects |
| Data Object | Identity | Stable Object, Record, and Field IDs independent of display/order | Required | Schema evolution tooling |
| Data Object | Provenance | Exact field lineage, derivation, confidence/review status, and user override | Per-field | Multi-source extraction/impact |
| Data Object | Lifecycle | Draft, needs review/resolution, published, refreshing, stale, failed/failed-with-last-good, archived or retention-tombstoned | Manual review/publish | Governed refresh automation |
| Data Catalog | Observatory | Project Data screen projection over Sources, Objects, Names/Formulas, Results, Templates, corpora/connectors, runs, history | Core list/detail | Complete Project observatory |
| Data Catalog | Lineage | Exact upstream/downstream edges, freshness, impact, reconciliation, safe inaccessible nodes | Basic graph | Large graph queries |
| Analytics | Compute | Isolated bounded code/query over pinned read-only datasets | One approved engine | Multiple engines and scheduled runs |
| Analytics | Results | Typed immutable artifact with input versions, code digest, environment, usage, and provenance | Table/scalar output | Charts/models and governed promotion |

## Domain model: shared values and references

Formula owns the canonical public value algebra used at capability boundaries.
It does not own a central registry of every Resource's formula mount:

```text
Value = Text | Logic | Decimal | Null | List<Value> | Record<FieldID,Value>
      | Table<Schema,Rows> | Object<TypeID,Fields> | Error<FormulaError>

Reference {
  owner_kind, owner_id, component_id?, exact_version, field_or_range?,
  expected_value_type
}

LineageEdge {
  edge_id, upstream_ref, downstream_ref, transform_kind,
  transform_version, created_by, created_at
}
```

Values are immutable and deterministically serialized. Decimal semantics,
Unicode normalization, ordering, null behavior, comparison, and error
propagation are versioned language rules. Floating-point ambiguity must not
leak into canonical results.

## Domain model: Formula

```text
Expression {
  expression_id, language_version, source, ast_digest,
  expected_type, dependency_refs, revision
}

NameDefinition {
  name_id, scope, display_name, normalized_lookup_key,
  target, revision, state
}

EvaluationInput {
  definition, exact_bindings, limits, requested_explain_level
}

EvaluationResult {
  value, dependency_versions, evaluation_digest, explanation,
  warnings, language_version
}
```

Formula invariants:

- parsing and evaluation are pure functions of versioned source, exact
  bindings, and language version;
- a resolver may return only an already committed exact value or a typed
  unavailable/stale error; it cannot trigger work;
- all dependency cycles and resource/step/depth/size limits terminate with
  stable errors;
- Names use stable IDs, so renaming a label does not silently retarget a
  compiled reference; and
- unknown language/function/value/reference versions fail closed.

`NameDefinition.state` is `active`, `archived`, or a retention-governed
`tombstoned`. Archived/tombstoned Names cannot satisfy new resolution, but
retained exact historical references remain reproducible while policy retains
their immutable definitions.

## Domain model: Data Objects, Catalog, and Analytics

```text
DataObject {
  object_id, kind, schema_version_id, data_version_id, state,
  last_good_version_id?, refresh_definition_id?, refresh_generation, revision
}

DataSchemaVersion {
  schema_version_id, fields[{field_id, name, type, constraints}], digest
}

DataVersion {
  data_version_id, schema_version_id, records[], field_provenance[],
  derivation?, created_by, created_at, digest
}

DataRefreshDefinition {
  refresh_definition_id, object_id, revision, closed_provider_kind,
  exact_source_scope, mapping_schema_version, review_policy, limits, state
}

DataRefreshRequest {
  refresh_request_id, object_id, expected_object_revision,
  refresh_definition_id, refresh_definition_revision, refresh_generation,
  exact_input_refs[], input_digest, work_authority_id, job_id, state
}

DataRefreshProposal {
  refresh_request_id, exact_definition_and_input_versions,
  candidate_schema_version, candidate_data_version, diff_summary,
  validation_and_review_state, result_digest
}

FieldProvenance {
  record_id, field_id, origin_ref, transform, evidence_refs?,
  review_state, override_of?
}

CatalogItem {
  item_ref, kind, title, normalized_state, current_version,
  freshness, lineage_summary, authorized_actions
}

AnalyticRun {
  run_id, engine_version, code_digest, pinned_inputs[], limits,
  state, result_artifact_id?, usage, failure?
}
```

Data Objects are canonical Project data assets, not editor Resources. Missing
values remain missing; model
extraction cannot fabricate filler. A user override creates a new attributable
field value and retains the superseded derivation. Publish is an explicit
expected-version command.

`DataObject.state` uses the closed states `draft`, `needs_review`,
`needs_resolution`, `published`, `refreshing`, `stale`, `failed`,
`failed_with_last_good`, `archived`, and retention-governed `tombstoned`.
`refreshing` never hides or replaces `last_good_version_id`. A successful
refresh creates a reviewable immutable candidate and advances the current
candidate pointer, while the last-good pointer remains on the prior validated
published version until `dataobjects.publish.v1` promotes the candidate. A
failure becomes `failed_with_last_good` when that pointer exists and `failed`
otherwise; neither state fabricates a new DataVersion. Restore is allowed only
from `archived`; tombstoned objects remain unavailable except for policy-
governed historical integrity and cannot be silently republished.

A refresh definition is inert Project data: it names an admitted provider kind,
exact source scope, typed mapping/schema, review policy and bounds but contains
no credential, SDK client, callback or mutable provider object. Each refresh
request freezes one exact definition revision and exact committed input
references/versions. Changing either definition or an input after admission
does not retarget the request; it makes any later result stale for settlement.

Catalog state is derived from authoritative owners and normalized to `current`,
`stale`, `resolving`, `needs_review`, `needs_resolution`, `failed`,
`inaccessible`, or `archived`. Catalog absence/presence never grants or denies
authority.

Analytic runs see immutable read-only snapshots. Sandboxed compute has no
ambient network, secret, filesystem, process, clock, or Project-store access.
Promotion is a separate authorized Data Object or Resource-family command.

## Commands and queries

### Formula

| Operation | Kind | Behavior |
| --- | --- | --- |
| `formula.parse.v1` | Pure query | Returns versioned AST or stable syntax diagnostics |
| `formula.validate.v1` | Pure query | Type/reference checks against supplied declarations |
| `formula.evaluate.v1` | Pure query | Resolves exact supplied bindings and returns typed value/explanation |
| `formula.explain.v1` | Pure query | Returns bounded dependency and evaluation explanation |
| `formula.define_name.v1` | Command | Creates/updates one stable Project-scoped Name by expected revision |
| `formula.set_name_lifecycle.v1` | Command | Archives/restores or retention-tombstones one Name under expected revision without retargeting references |
| `formula.get_name.v1` | Query | Returns one currently authorized exact Name definition/revision by stable NameID without resolving a mutable display label |
| `formula.list_names.v1` | Query | Returns an authorized cursor-bounded Project/scope list of safe Name projections and exact revisions |
| `formula.recalculate.v1` | Pure query | Within explicit dependency/work/output limits, computes a deterministic in-memory proposal from a consumer-owned expression and exact bindings; it performs no durable effect |
| `formula.get_dependencies.v1` | Query | Returns exact dependency graph and dirty causes |

`formula.recalculate.v1` has one strictly bounded, read-only request class. It
may call only the exact-value resolver, and it never creates a Job,
WorkAuthority, artifact, idempotency record, Audit mutation, cached canonical
result or consumer state. Exceeding dependency, step, depth, time or output
bounds returns the stable Formula limit error with no side effects. Formula
defines no asynchronous form of this operation. A consumer that needs durable
scheduling owns its own named durable request, freezes its own inputs, invokes
Formula as pure computation, and conditionally materializes the result under
that consumer's authority and transaction protocol.

### Data and analytics

| Operation | Kind | Behavior |
| --- | --- | --- |
| `dataobjects.create.v1` | Command | Creates a typed draft with immutable initial schema/data versions |
| `dataobjects.propose_version.v1` | Command | Adds a derived/imported/authored candidate with provenance |
| `dataobjects.override_field.v1` | Command | Adds attributable user override without deleting origin |
| `dataobjects.review.v1` | Command | Records per-field/object decisions by expected version |
| `dataobjects.publish.v1` | Command | Promotes a validated reviewed version |
| `dataobjects.set_lifecycle.v1` | Command | Archives/restores or retention-tombstones one Data Object under expected revision while preserving governed lineage |
| `dataobjects.set_refresh_definition.v1` | Idempotent command | Create, update, disable or replace one inert typed refresh definition under exact Object/definition revisions |
| `dataobjects.refresh.request.v1` | Idempotent durable command | Freeze one exact Object, refresh-definition revision and committed input-version set and admit a durable refresh Job |
| `dataobjects.refresh.cancel.v1` | Command | Cancel/revoke one expected active refresh generation and fence any later provider or settlement result |
| `dataobjects.refresh.status.get.v1` | Query | Return bounded safe request/Job state, exact frozen-input summary and any settled candidate/error metadata |
| `dataobjects.refresh.proposal.settle.v1` | Internal settlement command | Conditionally create one normalized immutable candidate proposal or record a safe stale/failure outcome under exact request, source, definition, input and work-generation preconditions |
| `dataobjects.get.v1` | Query | Returns an authorized bounded projection and provenance |
| `datacatalog.get.v1` | Query | Returns one authorization-shaped detail projection with owner state, freshness, safe lineage summary and currently registered actions |
| `datacatalog.list.v1` | Query | Lists authorization-shaped items and normalized state |
| `datacatalog.lineage.v1` | Query | Returns bounded authorized upstream/downstream graph |
| `datacatalog.impact.v1` | Query | Computes version/freshness impact without mutation |
| `analytics.start.v1` | Durable command | Pins inputs and starts a sandboxed bounded run |
| `analytics.cancel.v1` | Command | Requests cancellation and fences stale completion |
| `analytics.get_run.v1` | Query | Returns status, usage, provenance, and typed result metadata |
| `analytics.result.get.v1` | Query | Returns a bounded authorized typed result page at an exact immutable result version |
| `analytics.materialize.v1` | Command | Delegates explicit result promotion to the destination owner |

## Consumed and provided ports

Formula owns a synchronous resolver contract:

```go
type ValueResolver interface {
    ResolveExact(context.Context, Reference) (ResolvedValue, error)
}
```

The consumer supplies it from already loaded or bounded nested exact queries.
`ResolveExact` must never start Resolution, call Intelligence, or write.

Data Objects may consume capability-owned `GroundedExtractionProvider` and
`FormulaEvaluator` ports. A refresh adapter accepts only the plain frozen
`DataRefreshRequest` projection and returns a normalized candidate or stable
safe failure; it cannot write Data Object state, choose a newer source, publish
a candidate or retain a provider handle. Grounded extraction adapters
coordinate Resolution, Knowledge, and Intelligence, then Data Objects
deterministically validate all types, entity keys, citations, and transforms
before an internal settlement can create a proposal.

Data Catalog consumes read-model/projector contracts from owners. It exposes
queries, not mutation ports. Every catalog action routes to the owning
capability's operation.

Analytic handlers consume a `SandboxRunner` technical port and exact dataset
readers. The capability defines the allowed input/output/resource contract;
wiring supplies a hardened implementation.

## Persistence and concurrency

- Project named definitions use expected aggregate revisions. Resource-family
  slots/mounts, expression source, dirty state, and displayed/last-good results
  remain in that family's aggregate and transaction. A consumer may keep a
  disposable result cache keyed by the full input digest, but Formula queries
  neither own nor populate it; a result is canonical only when the consumer
  explicitly materializes it through its own operation.
- Name uniqueness is enforced within the declared scope using normalized keys
  and stable IDs. Rename/update transactions preserve referential integrity.
- Name and Data Object lifecycle transitions are expected-revision commands;
  archive denies ordinary discovery/use without erasing retained exact
  historical references or immutable versions.
- Data Object schema/data versions are immutable inserts; the aggregate
  current/last-good/review pointers advance conditionally.
- Refresh definitions have stable IDs and exact revisions. Refresh requests,
  generations, input manifests and attempt outcomes are durable; an exact
  idempotent replay returns the existing Request/Job, while the same key with a
  different Object, definition, source scope or input digest conflicts.
- Per-field review/override decisions use stable RecordID/FieldID and expected
  data version. Concurrent incompatible edits return explicit conflicts.
- Catalog tables/indexes are rebuildable projections. Dropping them cannot
  lose canonical Formula, Data Object, Resolution, Source, or Template state.
- Analytic runs are durable jobs with leases/fencing, pinned inputs, bounded
  artifacts, cancellation, and idempotent terminalization.
- Materialization commits in the destination owner's transaction with fresh
  authority and records exact analytic/formula lineage.

`dataobjects.refresh.request.v1` preselects stable `RefreshRequestID`,
`WorkAuthorityID` and `JobID`. Under the current session, Control creates exact
`DurableWorkAuthority{PendingProjectReceipt}`. One session-permitted Project
transaction then rechecks the Object and refresh-definition revisions, resolves
and freezes the committed exact input references, increments the refresh
generation, sets `refreshing` without changing `last_good_version_id`, and
stores the request, Job, non-authoritative receipt, idempotency, required Audit/
fact and `durable_job@1`. Trusted acknowledgement of that exact Project receipt
alone activates the work. Pending authority or a bare receipt cannot issue a
permit; absent Project state expires as an unusable orphan and lost
acknowledgement reconciles only from the exact trusted receipt.

The worker holds a lease fence but no mutation permit while it reads only the
frozen exact inputs and invokes the admitted refresh provider. It returns a
plain typed candidate, safe failure or cancellation outcome.
`dataobjects.refresh.proposal.settle.v1` is the sole result-acceptance seam. It
locks the request and Data Object, verifies the active WorkAuthority, Job,
receipt and refresh generation, rechecks the exact refresh-definition revision
and every source/input version, deterministically validates schema, record/
field identities, provenance, citations, mapping and diff, and then obtains a
fresh work-sourced permit. In one Project transaction it either:

- inserts exactly one immutable candidate schema/data version, advances the
  current candidate pointer, sets `needs_review` or `needs_resolution`,
  preserves last-good, and records lineage, attempt settlement, idempotency,
  required Audit/fact and the permit consumption; or
- records only an authorized safe stale/failure/cancellation state and attempt
  summary, preserving last-good and creating no candidate DataVersion.

If the Object, definition, source/input version, work generation, authority or
lease fence changed, settlement cannot substitute a newer input or overwrite
state. It returns/records the stable stale outcome only when a fresh permit
still authorizes that canonical status transition; after revocation it may
change only Job bookkeeping through the restricted finalizer. A provider error
sets `failed_with_last_good` or `failed` only through the same fresh-permit
settlement. Successful refresh never auto-publishes: `dataobjects.publish.v1`
is a separate current-session review command that conditionally promotes the
candidate and advances last-good.

Crash recovery is identity-driven. A crash before the request transaction
leaves no Project work; after commit/before acknowledgement, exact receipt
reconciliation activates or expires the pending authority; during provider
work, the lease generation fences a stale worker; after candidate settlement/
before Job acknowledgement, the unique request/generation and candidate digest
return the already committed result without duplication. The read-only
`dataobjects.refresh.status.get.v1` reconstructs status from request, Job and
candidate metadata and creates no work. Cancel revokes the expected work
generation under a fresh current-session permit, atomically records required
Audit, and fences settlement without clearing the last-good version.

`analytics.start.v1` preselects stable `RunID`, `WorkAuthorityID` and `JobID`.
Under the current session, Control creates exact
`DurableWorkAuthority{PendingProjectReceipt}`; a session-sourced permit commits
the Run, exact Job, non-authoritative receipt, idempotency, Audit/fact and
`durable_job@1`. Trusted receipt acknowledgement alone activates
the work. Missing Project state leaves an unusable expiring/revoked orphan;
lost acknowledgement reconciles only from exact trusted receipt verification.
Neither pending authority nor receipt can issue an ordinary permit.

The immutable AnalyticResult commit requires a fresh permit sourced by the
active WorkAuthority and matching Job/receipt/generation; no permit is held in
the sandbox. Current-family sign-out preserves the admitted run, while
User-wide/grant/policy/entitlement/cancel/expiry revocation denies and fences
result publication. `durable_job@1` can only terminalize exact Job bookkeeping;
success requires prebound proof that the ordinary result effect already
settled. It cannot change Run/usage state, execute code, publish a result,
materialize Data/Resource state, enqueue work or widen authority. Capability
state must commit under a fresh permit before revocation or remain nonterminal.
`analytics.materialize.v1` is a later current-session command under
the destination owner's ordinary permit, not a privilege inherited from the
run.

There is no universal data transaction, event stream, or application-wide
lock. Each owner follows its own Project-local concurrency protocol.

## Security, failure, and errors

All exact references are resolved under the bound Cell's current authority.
Catalog/lineage responses omit or safely mark inaccessible nodes without
revealing titles or identifiers. Formula error detail is safe and bounded; it
cannot include source values unless the caller is authorized and the operation
contract explicitly requests a preview.

Analytic sandboxes enforce CPU, memory, wall time, output size, syscall,
filesystem, network, and package policy. Code and data content are redacted
from general logs and Audit. Required Audit records safe identities, versions,
action, policy/authority generations, and outcome.

Stable error details include syntax/type/name/reference/cycle/limit errors,
schema mismatch, missing required field, stale expected version, lineage
integrity failure, sandbox policy violation, and result-size exceeded. They map
to `invalid_argument`, `precondition_failed`, `conflict`, `not_found`,
`unsupported_version`, `integrity_failure`, `rate_limited`, or
`temporarily_unavailable` without leaking cross-Project data.

Refresh-specific stable errors include `dataobject_refresh_conflict` when the
Object/request generation changed, `dataobject_refresh_stale_input` when the
definition or any frozen source/input version no longer satisfies settlement,
`dataobject_refresh_rejected` when normalized schema/provenance/review policy
fails, and `dataobject_refresh_canceled` after an expected cancellation fence.
`formula_recalculation_limit` is a side-effect-free `precondition_failed`
result and never implies that background work was started.

## Cross-capability contracts

- Resource families own formula slots/mounts, expression source, dirty and
  last-good state, and decide how evaluated values appear and persist.
- Resolution owns Results; Formula may read an exact committed Result but never
  refresh it.
- Intelligence can propose Formula source outside evaluation; Formula remains
  the only validator/evaluator.
- Knowledge evidence and Memory are not Formula values unless an explicit
  authorized owner exposes a committed typed projection.
- Data Catalog projects Sources, Objects, Names/Formulas, Results, Templates,
  corpora/connectors, runs, and lineage but owns none.
- Translation maps formulas/data with explicit compatibility/loss reports.
- Agents use the same versioned commands and cannot access Formula/Data stores
  or the analytic sandbox directly.

## Headless proof plan

1. Parser/AST/value golden files and deterministic serialization across
   repeats/platforms.
2. Type, null, decimal, Unicode, ordering, cycle, size/depth/work, and unknown-
   version tests.
3. Architecture fixtures prove Formula cannot import network, database,
   Intelligence, Knowledge, Resolution, clock, random, or runtime packages.
4. Resolver proves exact committed values only and never triggers refresh.
5. Concurrent Project Name updates and consumer-owned mount updates use their
   respective owner revisions and never silently retarget stable IDs; Name
   get/list are bounded, authorization-shaped and hide inaccessible existence.
6. Name archive/restore/tombstone and Data Object lifecycle races preserve
   reference/lineage integrity and fail closed for new ordinary use.
7. Formula recalculation exhausts dependency/step/depth/time/output bounds with
   `formula_recalculation_limit` and proves zero Job, WorkAuthority, artifact,
   idempotency, Audit or consumer-state writes.
8. Data Object schema/data versions, per-field provenance, override, review,
   publish, refresh diff, and last-good recovery golden journey.
9. Refresh request exact replay/divergent replay, definition/source/input
   advancement, provider failure, cancellation, authority revocation, lease
   loss, stale settlement, crash before/after request/acknowledgement/provider/
   candidate commit, and retry-after-commit prove one candidate at most, fresh
   permit/Audit atomicity, no auto-publish and last-good preservation.
10. Catalog get/list/lineage/impact authorize every owner projection;
   deletion/rebuild produces an equivalent projection and cannot change owner
   truth.
11. Two-Project lineage/search tests prove no catalog/index bleed.
12. Sandboxed analytic denial tests cover network/filesystem/process/secrets,
   cancellation, limits, lease loss, crash/restart, stale completion, and race.
13. Materialization pins inputs/results and commits exactly once with fresh
    permit, Audit, idempotency, and lineage.

The initial proof includes core Formula evaluation, Name get/list, and one
authored/imported table Data Object that completes the durable exact-input
refresh-to-review-to-publish journey with field provenance and remains visible
through a rebuilt Data Catalog. Analytic compute remains incomplete until a
real sandbox passes live isolation and resource-exhaustion evidence.

## Source grounding

- [SOL X 42 — Formula](https://app.notion.com/p/39ab6410e5028173bb38fbebcbffea4d)
- [SOL X 49 — Analytic compute](https://app.notion.com/p/39ab6410e502818bae40fef5d1fc0ec0)
- [SOL X 73 — Project Data](https://app.notion.com/p/39ab6410e50281cd9ddde1bc130700d6)
- [SOL X 74 — Structured Data Objects](https://app.notion.com/p/39ab6410e50281e29a63c2a9131dfc90)
- [SOL X 75 — Project Data Screen](https://app.notion.com/p/39ab6410e50281e0afa9c99c851fe739)
- [Omega capability model](../architecture/capability-model.md)
- [Omega persistence and concurrency](../architecture/persistence-and-concurrency.md)

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
[`internal/formula`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/formula)
is an implemented primitive with lexer, parser, AST, typed JSON-stable values,
evaluator, structured errors, built-ins and headless parse/evaluate/explain.
Named Project formulas/tables, dependency recalculation, Resource consumers,
Data Objects, Data Catalog and analytic compute are target-only.

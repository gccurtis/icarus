# Translation, native packages, Project Archive, and family Templates

## Purpose, ownership, and boundary

Translation converts exact immutable inputs into typed staging graphs or
immutable delivery artifacts with explicit compatibility, loss, and
provenance. It covers import, export, Taurus Native packages, and Project
Archive production.

Template behavior is documented here because it shares translation/native
contracts, but Omega has **no generic Template capability, store, service, or
ResourceKind**. Document, Workbook, Deck, and Board families each own their
Template recipes, versions, invariants, commands, persistence, and
instantiation. Shared code may define pure interchange vocabulary and
validation helpers only.

Translation does not own uploaded FileVersions, destination Resources,
Resource-family truth, object-store authority, browser downloads, provider
secrets, Agent workflow effects, or Project backup/restore.

## Feature contract

| Area | Feature | Required behavior | Initial boundary | Retained breadth |
| --- | --- | --- | --- | --- |
| Intake | Immutable input | Start from exact authorized FileVersion with digest/type/size metadata | Upload already committed | Connectors and external sources |
| Import | Inspect/plan | Sandboxed format detect/inventory/mapping/loss/ambiguity report before destination effect | Native Document then DOCX | XLSX/PPTX and richer formats |
| Import | Confirmation | User confirms material loss/ambiguity/destination proposal | Required | Policy/approval automation |
| Import | Staging | Convert to versioned typed staging graph and validate; no partial visible Resource | Single Resource | Multi-Resource graphs/assets |
| Import | Commit | Destination owner atomically creates ordinary Resources and provenance | Document | Workbook/Deck/other owners |
| Export | Pinning | Explicit subject and exact owner/dependency versions; refresh/save is separate | Document | All supported families |
| Export | Fidelity | Compatibility/loss preview, structural validation, immutable artifact, fidelity report | Native normal; then DOCX | XLSX/PPTX and rendered slide comparison |
| Export | Confirmation | Bind material loss/mode/consequence acknowledgement to the exact ExportPlan before execution | Required when material | Policy/approval automation |
| Delivery | Artifact | Translation records fidelity/lineage to a checksummed immutable Files-owned output FileVersion; Files reauthorizes short-lived delivery | Required | Admin policy/regions |
| Native | Normal mode | Preserve supported live definitions, refs, formulas, bindings, schemas, provenance | Document | Resource graphs |
| Native | Materialized mode | Static visible values; remove refresh/Agent/provider/connector/automation/external-data behavior | Deferred | All eligible families |
| Native | Template mode | Reusable definitions/parameters; strip instance/private/output/runtime state | Document Template | Multi-Resource recipes |
| Archive | Project package | Async exact-version policy-shaped inventory/manifests/checksums/fidelity/exclusions | Deferred | Enterprise export controls |
| Template | Publish | Preview fixed/variable/live content, requirements, assets, stripping; freeze immutable family TemplateVersion | Document | Workbook/Deck/Board |
| Template | Instantiate | Validate inputs/requirements, preview graph, create ordinary Resources, wire bindings, verify, record lineage | Single Document | Multi-Resource graphs/workflows |
| Template | Workflow | Attached workflow runs as authorized Agent Task with approvals; Template never writes stores | Deferred | Reusable automations |

V1 format mappings are:

- DOCX -> Document;
- XLSX -> Workbook;
- PPTX -> Deck; and
- `.tars` plus an explicitly accepted `.taurus.json` alias -> Taurus Native
  normal, materialized, or template package according to manifest mode.

Upload, original download, import, Resource creation, export, artifact delivery,
Template publication, Template instantiation, and Project Archive are distinct
commands and states. A successful upload does not imply import, and export does
not silently save/refresh live content.

## Domain model: Translation

```text
TranslationJob {
  job_id, kind, input_ref, requested_format, exact_subject_refs,
  state, generation, policy_version, created_by, failure?
}

ImportInspection {
  format, format_version, inventory, hazards, parser_version,
  source_digest
}

ImportPlan {
  plan_id, inspection_ref, destination_kind, mapping,
  losses[], ambiguities[], requirements[], plan_digest
}

StagingGraph {
  staging_id, schema_version, nodes[], typed_edges[], assets[],
  provenance, graph_digest
}

ExportPlan {
  plan_id, subject_refs[], pinned_versions[], dependency_pins[],
  format, mode, compatibility, losses[], plan_digest
}

ExportConfirmation {
  plan_id, plan_digest, acknowledged_consequence_digest,
  actor, authority_generation, confirmed_at
}

ExportFileLink {
  output_file_id, output_file_version_id,
  digest, size, media_type, created_from, fidelity_report, state
}

NativeManifest {
  native_version, mode, inventory, dependencies, schemas,
  provenance, assets, checksums, required_features
}

ProjectArchiveManifest {
  archive_version, project_ref, policy_version, inventory,
  pinned_versions, included_originals, exclusions, checksums
}
```

Job states are `queued`, `inspecting`, `awaiting_confirmation`, `converting`,
`validating`, `awaiting_destination`, `rendering`, `verifying`, `ready`,
`failed`, `canceled`, or `expired`. Expected state/generation and worker fencing
govern transitions.

Invariants:

- all input and subject/dependency versions are exact and integrity checked;
- no destination Resource is visible before its owner atomically commits it;
- no output FileVersion is ready/deliverable before render, structure, and
  checksum verification;
- a loss/ambiguity classified as material requires explicit confirmation;
- native package references are closed or explicitly declared external;
- path traversal, duplicate/confusable names, decompression bombs, unsupported
  required features, and checksum mismatches fail closed;
- Project Archive is not a database backup, grant snapshot, or legal-hold
  implementation; and
- temporary staging and delivery credentials never establish Product authority.

## Domain model: family-owned Templates

Each eligible family owns a model equivalent to:

```text
FamilyTemplate {
  template_id, family_kind, title, lifecycle, current_version,
  owning_project, revision
}

FamilyTemplateVersion {
  template_id, version, recipe_schema, fixed_content,
  parameters[], live_definitions[], requirements[], assets[],
  resource_graph?, workflow_refs[], stripping_report,
  source_lineage, digest
}

InstantiationPlan {
  template_version, inputs, requirement_status, preview_graph,
  consequences, plan_digest
}

InstantiationResult {
  created_resource_refs[], binding_refs[], lineage, verification
}
```

Template is a trait, not a generic Resource. Only Documents, Workbooks, Decks,
and Boards may publish it. Template is distinct from Favorite, clone, file
export, prompt, and marketplace item. Publishing freezes an immutable version;
editing creates a new version. Instantiation creates ordinary family Resources
and uses their commands/concurrency.

Template lifecycle is `active`, `archived`, or `retention_tombstoned` under an
expected family-template revision. First publication creates an active Template
and current pointer. Every later publication appends an immutable version and
conditionally advances that pointer; selecting old content requires publishing
a new version derived from it. Archive hides the Template from ordinary create
surfaces without changing retained versions or instances; restore returns it to
active. Retention tombstone is policy-gated and never erases lineage required by
existing instances.

Template-mode native export does not mark the source as a Project Template.
Importing a template package creates a candidate family Template only through
the family's explicit publish/review command.

## Commands and queries

### Translation

| Operation | Kind | Behavior |
| --- | --- | --- |
| `translation.inspect_import.v1` | Durable command | Freeze one exact FileVersion and produce a sandboxed format inventory and hazard report |
| `translation.plan_import.v1` | Durable command | Produces typed mapping, loss, ambiguity, and requirement plan |
| `translation.confirm_import.v1` | Command | Confirms exact plan digest/consequences |
| `translation.execute_import.v1` | Durable command | Builds/validates staging graph and delegates atomic destination commit |
| `translation.cancel.v1` | Command | Cancels/fences an expected job generation |
| `translation.plan_export.v1` | Durable command | Pin exact subject/dependencies and produce a compatibility/loss plan |
| `translation.confirm_export.v1` | Command | Binds explicit material-loss/mode/consequence acknowledgement to one exact ExportPlan and plan digest |
| `translation.execute_export.v1` | Durable command | Renders, validates, and delegates final immutable FileVersion publication while recording fidelity/lineage |
| `translation.get_job.v1` | Query | Returns safe status, plan, losses, provenance, and Files-owned output FileVersion metadata |
| `translation.create_project_archive.v1` | Durable command | Produces a policy-shaped exact-version manifest and verified Files-owned archive FileVersion |

`translation.execute_export.v1` consumes the exact plan and, whenever policy
classifies any loss/mode/consequence as material, the matching current
`ExportConfirmation`. Missing, stale, differently scoped or different-digest
confirmation fails before durable work admission. Confirmation is attributable
but is not authority and cannot widen the pinned plan.

### Family Templates

Operations are family-namespaced. Every eligible family exposes the same seven
workflow shapes under its own invariants; these are distinct public operations,
not aliases to a generic Template owner.

| Operation | Kind | Behavior |
| --- | --- | --- |
| `documents.templates.preview_publish.v1` | Query | Validates stripping, requirements and parameters and returns the exact candidate preview |
| `documents.templates.publish.v1` | Command | Publishes an immutable Document TemplateVersion under expected family revision |
| `documents.templates.get.v1` | Query | Returns one authorized Document Template lifecycle/current pointer and an exact requested version projection |
| `documents.templates.plan_instantiation.v1` | Query | Validates exact TemplateVersion, inputs and target-Project requirements and returns a preview plan |
| `documents.templates.instantiate.v1` | Command | Creates an ordinary Document through the confirmed exact plan and records lineage |
| `documents.templates.list.v1` | Query | Lists authorized Document Template projections without becoming a generic catalog authority |
| `documents.templates.set_lifecycle.v1` | Command | Conditionally archives/restores or policy-tombstones the expected Document Template revision without rewriting versions |
| `workbooks.templates.preview_publish.v1` | Query | Validates Workbook stripping, formulas/names/data requirements and returns the exact candidate preview |
| `workbooks.templates.publish.v1` | Command | Publishes an immutable Workbook TemplateVersion under expected Workbook-template revision |
| `workbooks.templates.get.v1` | Query | Returns one authorized Workbook Template lifecycle/current pointer and exact requested version projection |
| `workbooks.templates.plan_instantiation.v1` | Query | Validates exact TemplateVersion, typed inputs and target-Project name/data requirements |
| `workbooks.templates.instantiate.v1` | Command | Creates an ordinary Workbook through the confirmed exact plan and records lineage |
| `workbooks.templates.list.v1` | Query | Lists authorized Workbook Template projections |
| `workbooks.templates.set_lifecycle.v1` | Command | Conditionally archives/restores or policy-tombstones the expected Workbook Template revision without rewriting versions |
| `decks.templates.preview_publish.v1` | Query | Validates Deck stripping, layout/theme/assets/binding requirements and returns the exact candidate preview |
| `decks.templates.publish.v1` | Command | Publishes an immutable Deck TemplateVersion under expected Deck-template revision |
| `decks.templates.get.v1` | Query | Returns one authorized Deck Template lifecycle/current pointer and exact requested version projection |
| `decks.templates.plan_instantiation.v1` | Query | Validates exact TemplateVersion, inputs and target-Project layout/asset/data requirements |
| `decks.templates.instantiate.v1` | Command | Creates an ordinary Deck through the confirmed exact plan and records lineage |
| `decks.templates.list.v1` | Query | Lists authorized Deck Template projections |
| `decks.templates.set_lifecycle.v1` | Command | Conditionally archives/restores or policy-tombstones the expected Deck Template revision without rewriting versions |
| `boards.templates.preview_publish.v1` | Query | Validates Board stripping, mode/theme/assets/binding requirements and returns the exact candidate preview |
| `boards.templates.publish.v1` | Command | Publishes an immutable Board TemplateVersion under expected Board-template revision |
| `boards.templates.get.v1` | Query | Returns one authorized Board Template lifecycle/current pointer and exact requested version projection |
| `boards.templates.plan_instantiation.v1` | Query | Validates exact TemplateVersion, inputs and target-Project asset/data requirements |
| `boards.templates.instantiate.v1` | Command | Creates an ordinary Board through the confirmed exact plan and records lineage |
| `boards.templates.list.v1` | Query | Lists authorized Board Template projections |
| `boards.templates.set_lifecycle.v1` | Command | Conditionally archives/restores or policy-tombstones the expected Board Template revision without rewriting versions |

There is deliberately no `templates.*` mutation API that owns all family
recipes. A family keeps these operations unavailable until its complete model,
stripping rules, persistence, authority, and proof matrix are implemented.

## Consumed and provided ports

Translation owns consumer-side contracts for format and destination adapters:

```go
type FormatAdapter interface {
    Inspect(context.Context, ExactInput) (ImportInspection, error)
    Convert(context.Context, ConfirmedImportPlan) (StagingGraph, error)
    Render(context.Context, ConfirmedExportPlan) (RenderedArtifact, error)
    Verify(context.Context, RenderedArtifact) (FidelityReport, error)
}

type DestinationAdapter interface {
    ValidateStaging(context.Context, StagingGraph) (DestinationPreview, error)
    CommitStaging(context.Context, ConfirmedDestination) (DestinationResult, error)
}

type ExactSubjectReader interface {
    ReadExportProjection(context.Context, ExactSubjectRef) (ExportProjection, error)
}
type OutputFilePublisher interface {
    PublishVerified(context.Context, VerifiedExport) (OutputFileVersion, error)
}
```

Format adapters are sandboxed and provider/library types do not escape.
Destination and subject adapters use bounded nested dispatch to the owning
family. The destination owner revalidates family invariants and commits under
normal authority, idempotency, permit, Audit, and concurrency rules.
`OutputFilePublisher` delegates final verified bytes/metadata to Files; Files
owns the FileVersion, object lifecycle, retention, and authorized download.

Eligible families may share pure Template interchange types/validators, but
each family owns its `TemplateProjection`, stripping logic, requirements,
preview, persistence, and instantiation adapter. Workflows invoke Agents
through an explicit Task port after Resource creation; they never run inside a
Template transaction.

## Persistence and concurrency

- Jobs, plans, confirmations, staging manifests, output-File links, and lineage
  have stable identities and expected-state transitions.
- Durable workers use leases/fencing and resumable checkpoints. Stale workers
  cannot finalize artifacts or destination commits.
- Input/staging/render objects are immutable and digest-addressed through
  opaque references. Staged render/finalization and orphan reconciliation
  handle database/object-store crash boundaries; Files owns the final output
  object and FileVersion.
- Destination commit is idempotent by job/plan/input digest and atomic only in
  that owner's Project transaction. Cross-Resource staging graphs use an
  explicit durable coordinator and honestly report/compensate partial work;
  they do not claim distributed atomicity.
- Family Template versions are immutable inserts; publish conditionally advances
  the current pointer and each family's named `set_lifecycle` operation
  conditionally changes lifecycle. Instantiation records exact TemplateVersion
  and input digest.
- Delivery URLs/tokens are Files-owned derived short-lived mechanisms and never
  canonical state or authority.

There is no file-watcher service, universal event stream, or hidden worker per
format/family. Host-supervised explicit jobs run the same operations.

Every effectful durable Translation operation preselects a stable
`TranslationWorkID`, `WorkAuthorityID` and `JobID` plus exact input/plan/
dependency digest. Under the initiating current session, Control creates exact
`DurableWorkAuthority{PendingProjectReceipt}`; a fresh session-sourced permit
then commits the workflow state, Job, non-authoritative receipt, idempotency,
required Project Audit/fact and `durable_job@1`. Trusted
acknowledgement of that exact receipt alone activates the work. A confirmed
execute operation is a distinct admission from an inspect/plan Job and cannot
silently widen it.

Pending authority and a bare receipt cannot issue an ordinary permit. Missing
Project state leaves an unusable expiring/revoked orphan; lost acknowledgement
reconciles only from the exact trusted receipt. Every later canonical plan/
report/staging transition, destination-family commit, Files-owned output
publication or final lineage link consumes a fresh permit sourced by the
active WorkAuthority and matching Job/receipt/generation. No permit is held
during parsing, rendering, encoding or object transfer.

Current-family sign-out preserves accepted Translation work; User-wide,
grant/policy/entitlement, cancel/expiry or explicit revocation denies/fences
later effects. `durable_job@1` may only terminalize exact Job bookkeeping;
success requires prebound proof that the ordinary destination/File/lineage
effects already settled. It cannot change Translation or lineage state, run a
converter, mutate a destination, publish a FileVersion, deliver bytes, enqueue
work or widen authority. Capability state must commit under a fresh permit
before revocation or remain nonterminal.

## Security, privacy, and failure

Import parsers/renderers run with strict size/count/depth/time/memory/output,
archive-expansion, path, network, filesystem, and process limits. Malware and
unsupported active content fail or quarantine according to explicit policy.
Office macros/external links/embedded objects never execute during translation.

Every read, confirmation, commit, Files delivery, and Template operation checks
current durable authority. A fresh permit is consumed at canonical mutation
commit. Artifact/FileVersion possession, object key, staging ID, or delivery
token cannot substitute for Product authority.

Native template/materialized stripping excludes instance outputs/IDs/history,
comments, private Notes, Tasks, Activity, Audit, Working Context, Memory,
presence, secrets, credentials, session/delivery state, and unauthorized
source content as defined by mode. Normal mode still includes only explicitly
supported, authorized, policy-admitted data.

Stable errors cover unsupported format/version/feature, integrity/checksum
failure, unsafe archive/path/content, limits, material-loss confirmation
required, ambiguous mapping, staging/schema invalid, destination conflict,
stale authority, render/fidelity failure, expired artifact, and temporarily
unavailable parser/renderer. Raw file content and parser/provider errors are
redacted.

Open question Q007 remains authoritative for cross-trust native/archive signing
and encryption. Until decided, packages are versioned, checksummed, and
zip-safe, and must not claim authenticity/confidentiality across trust
boundaries.

## Cross-capability contracts

- Files owns upload, input and output FileVersions, originals, object lifecycle,
  malware status, retention, and authorized download/delivery. Translation owns
  the job, plan, conversion, fidelity, and exact output-File lineage.
- Resource families own staging validation/commit and exact export projections.
- Formula/Resolution/Knowledge/Data define exact dependency/reference
  projections and mode-specific materialization semantics.
- Family Templates own recipes and instances; Data Catalog may project them but
  cannot mutate or authorize them.
- Agents run optional Template workflows after explicit Task creation and
  normal approvals.
- Activity may project committed job/Resource/output-File facts without file
  bodies; realtime is only a status hint.
- Project Archive policy consults Control/owners but is not backup/restore or a
  frozen authorization model.

## Headless proof plan

1. Golden native normal Document round-trip preserves supported structure,
   definitions, exact references, provenance, and stable visible rendering.
2. DOCX import/export plan, loss/ambiguity confirmation, staging validation,
   atomic destination, provenance, structural validation, and fidelity report.
3. XLSX/PPTX mappings remain incomplete until equivalent family and rendered-
   fidelity proofs pass; PPTX requires strongest practical per-slide rendered
   comparison.
4. Malformed/hostile archive, zip bomb, traversal, duplicate/confusable path,
   checksum, macro/external object, parser crash/hang, and output-limit tests.
5. Crash/retry/cancel/lease loss at each job and object-store boundary produces
   no partial visible Resource or ready/deliverable corrupt FileVersion;
   staged orphans are reconciled.
6. Exact version/dependency pins remain reproducible after source advances;
   export never silently refreshes or saves.
7. Normal/materialized/template stripping matrix proves prohibited state is
   absent and materialized packages have no live behavior.
8. Family Template preview/publish/version/instantiate/lineage tests, including
   strict stripping, missing requirements, concurrent updates, and ordinary
   destination authority.
9. Cross-Project input/staging/artifact/template substitution, revoked delivery,
   stale permit, idempotency mismatch, and existence-disclosure tests.
10. Project Archive inventory/checksum/exclusion/policy/retention tests plus
    explicit evidence that it cannot be used as backup or authority snapshot.

Initial completion is original upload/download plus Document native normal
round-trip, followed by DOCX import/export and one family-owned Document
Template recipe. All are headless, durable, resumable, and independently
reviewable before broader formats or multi-Resource Templates begin.

## Source grounding

- [SOL X 32 — Translation Kernel, Fidelity & Format Registry](https://app.notion.com/p/39ab6410e50281d8b760ddca52173ad5)
- [SOL X 46 — Resource Templates](https://app.notion.com/p/39ab6410e502817b9773de5f8db9f66e)
- [SOL X 77 — Import Pipeline: Office & Native Intake](https://app.notion.com/p/39ab6410e5028132ada6d3336eae11ac)
- [SOL X 78 — Export Pipeline: Office & Native Rendering](https://app.notion.com/p/39ab6410e5028161afcbedc98c3bb809)
- [SOL X 81 — Project Archive and package modes](https://app.notion.com/p/39ab6410e5028127bc49d65df8e03340)
- [Omega capability model](../architecture/capability-model.md)
- [Omega persistence and concurrency](../architecture/persistence-and-concurrency.md)
- [Omega open questions](../questions/README.md)

### Nova evidence (pinned)

At [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova),
[`internal/platform/objectstore`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/platform/objectstore)
is an integrity-oriented primitive, and Documents provide deterministic
extraction/serialization evidence. Nova has no complete File Resource,
translation/import/export pipeline, Files-owned export publication, native
package/Project Archive or family Template lifecycle. Those behaviors are
target-only.

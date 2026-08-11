# Stage 11 — Translation, import, export, and Project archive

## Outcome

Build safe durable translation pipelines: Taurus native packages, DOCX/XLSX/
PPTX import/export, explicit fidelity/loss reports, exact-version artifacts,
and policy-shaped Project Archive. Import/export are workflows around family
owners, not a generic Resource capability or hidden translation runtime.

## Non-goals

- perfect or unreported Office fidelity
- partial visible destination Resources
- using Project Archive as backup or authorization snapshot
- executing macros/active content
- embedding secrets, sessions, Audit, private Notes, Memory, or provider tokens
  in portable packages

## Target tree and files

```text
internal/
  capabilities/translation/          plans, staging, fidelity and lineage
  cell/handlers/translation/          owner adapters and workflow commands
  cell/handlers/translation/formats/  native, DOCX, XLSX and PPTX adapters
  cell/handlers/translation/mysql/    job/plan/report/link adapter
  wiring/{testing,development,production}/translation.go
migrations/project/*_translation.sql
api/openapi/product-v1.yaml
test/{integration,security,recovery,golden}/translation/
```

## Versioned contracts and schemas

Register only the exact operations in
[Translation and Templates](../capabilities/translation-and-templates.md#commands-and-queries).
Schemas version import/export/archive jobs, plans, typed staging graphs,
compatibility/fidelity/loss reports, exact owner refs and `ExportFileLink` to a
Files-owned FileVersion. Family Template schemas remain with Document,
Workbook, Deck or Board; Chat presets and Files are not Templates. Format
adapters return plain normalized projections, never mutate owner tables.

The seven `documents.templates.*.v1`, `workbooks.templates.*.v1`,
`decks.templates.*.v1`, and `boards.templates.*.v1` workflows are public only
through their family handlers. This stage may supply shared pure package/
stripping vocabulary, but it owns no generic `templates.*` operation or table.

## Import state machine

```text
uploaded FileVersion
  -> quarantined/scanned
  -> format detected and inventory parsed in sandbox
  -> typed staging graph
  -> mapping + loss/ambiguity report
  -> waiting for confirmation when needed
  -> destination proposal/diff
  -> destination-owned atomic commit
  -> completed or failed/canceled with no partial visible Resource
```

V1 mappings: DOCX→Document, XLSX→Workbook, PPTX→Deck, native package→matching
family/template/materialized Resource. Translators output family-owned command
input, never write family tables directly.

## Export state machine

```text
subject + exact canonical version
  -> pin dependencies/source/asset/font versions
  -> compatibility and loss preview
  -> required exact-plan confirmation for any material consequence
  -> family projection/render
  -> format writer
  -> structural and visual validation
  -> immutable checksummed FileVersion + fidelity report
  -> short-lived authorized delivery
```

Save/refresh is separate from export. Export never silently updates live
bindings or source versions.

## Native package modes

- **Normal:** preserves supported live definitions, references, bindings,
  formulas, schemas, provenance, and Resource-family state.
- **Materialized:** replaces live outputs with visible static values and removes
  refresh, Agent, provider, connector, automation, and external-data behavior.
- **Template:** preserves reusable structure, definitions, parameters, and safe
  assets while stripping instance IDs/outputs/history, comments/private Notes,
  Tasks, Activity, Audit, Memory, presence, credentials, and delivery state.

Packages are versioned, canonical-manifested, checksummed, zip-safe, bounded,
and parsed in a sandbox. Cross-trust-boundary signature/encryption policy is
resolved before external native import.

## Family Template workflow

Each eligible family implements preview publication, publish immutable
version/current pointer, get an exact Template/version, plan instantiation,
instantiate an ordinary family Resource, list authorized projections, and
conditionally archive/restore/policy-tombstone lifecycle under the exact names
in the capability contract.
Preview and plan digests bind stripping, fixed/variable content, parameters,
requirements, assets and target-Project resolution. Publishing and
instantiation commit only through the family owner's authority, revision,
Audit, lineage and concurrency rules.

## Project Archive

An asynchronous version-pinned package with Project/resource inventory,
manifests, checksums, fidelity reports, allowed originals/attachments, and
explicit exclusions. It is a portable product export, not a transactionally
consistent database backup or a grant/session snapshot.

## Ownership

- Files owns uploaded and produced immutable artifacts.
- Translation owns staging state, mapping, fidelity, and job orchestration.
- Each Resource family owns import validation/commit and export projection.
- Control owns export authorization/policy/retention.
- Platform provides sandbox/object/job mechanisms without format semantics.

## Authority, transactions, failure, and recovery

Import pins one authorized ready FileVersion, builds staging durably, then
invokes exactly one destination-owner command. The destination appears only in
that owner's permit-fenced Project transaction. Export pins exact owner and
dependency versions; Translation commits plan/report/lineage, while Files owns
the immutable output FileVersion. No transaction spans those owners, so stable
idempotency and exact refs make each settlement retryable.

Each effectful durable `translation.inspect_import.v1`,
`translation.plan_import.v1`, `translation.execute_import.v1`, asynchronous
`translation.plan_export.v1`, `translation.execute_export.v1`, and
`translation.create_project_archive.v1` run has a stable `TranslationWorkID`,
`WorkAuthorityID` and `JobID` plus exact input/plan/dependency digest. A
confirmed execution is a distinct admitted run from its earlier inspect/plan;
confirmation cannot silently widen the plan Job.

Under the initiating current session, Control first creates the exact bounded
`DurableWorkAuthority{PendingProjectReceipt}`. A fresh session-sourced permit
then authorizes one Project transaction that stores the workflow intent, exact
Job, non-authoritative receipt, idempotency, required Project Audit, declared
fact and registered `durable_job@1` record. Only trusted
acknowledgement of that exact receipt activates the WorkAuthority. Missing
Project state leaves an unusable expiring/revoked orphan; lost acknowledgement
is reconciled only from exact receipt verification through trusted placement.

The pending authority and bare receipt cannot issue an ordinary permit. Each
later canonical plan/report/staging transition, destination-family commit,
Files-owned output publication or final lineage link obtains a fresh permit
sourced by the exact active WorkAuthority and matching Job/receipt/generation.
`files.add_version.v1` still validates and commits the preselected File/
FileVersion through Files ownership; Translation's staged bytes, job or report
grant no publication authority. No permit is held during parsing, rendering,
encoding, validation or object transfer.

Current-family sign-out preserves an explicitly admitted Translation run. Sign
out everywhere, User disable/removal, Project-grant/policy/entitlement loss,
cancel, expiry or explicit revoke denies new permits and fences issued ones.
The separately typed `durable_job@1` finalizer may only terminalize the exact
pre-admitted Job bookkeeping; success requires prebound proof that the ordinary
destination/File/lineage effects already settled. It cannot change Translation
or lineage state, parse/render/encode again, create or mutate a destination
Resource, publish a FileVersion, deliver bytes, enqueue work or widen authority.
Capability state must commit under a fresh permit before revocation or remain
nonterminal.

Crashes resume by state/generation; stale parsers/renderers cannot publish.
Cancellation before owner commit leaves no visible destination. After an owner
commit, replay returns the same destination or File link. Parser, validation,
fidelity, version drift, integrity and authorization failures remain distinct.
Orphan transient artifacts are reaped; Files retention governs durable export
outputs. Project Archive recovery is restore-as-import, never database restore.

## Production and test composition

Production enables a format/mode only with a hardened parser/writer sandbox,
registered family adapter, Files output publisher, explicit loss policy and
measured fixtures. Missing crypto policy keeps cross-trust native import
disabled. Tests use deterministic family projections and malicious fixtures;
live parser, object, crash/retry, structural/visual validation and large-file
evidence are required for each promoted format.

## Proof matrix

- malicious archive/path/bomb/active-content/macro/parser fixtures;
- cancel/retry/restart at every state with no partial visible Resource;
- stable Translation/Work/Job identities with pending→Project receipt→trusted
  acknowledgement activation, lost-ack reconciliation, orphan expiry, and
  denial of pending/bare-receipt permits;
- current-family sign-out survival versus User-wide/grant/policy/entitlement/
  cancel/expiry denial and fencing at every canonical effect;
- `durable_job@1` confinement after authority loss, including no Translation-
  state change, parser/renderer, destination mutation, File publication or
  delivery;
- exact destination version and idempotent commit;
- native normal round-trip preserves canonical supported state;
- materialized/template stripping negative tests for every forbidden class;
- all four eligible family seven-operation Template surfaces, including exact
  preview/plan digests, immutable versions/current pointers, lifecycle,
  stripping, lineage and no generic Template owner;
- DOCX/XLSX/PPTX structural validation and declared unsupported feature loss;
- strongest feasible per-slide rendered PPTX comparison;
- export pins dependencies and does not refresh/mutate source;
- artifact digest/fidelity/retention/authorized delivery;
- cross-Project/unauthorized import references fail closed; and
- Project Archive inventory/exclusion/restore-as-import behavior is explicit.

## Completion boundary

Each promoted format has measured supported fidelity and visible loss. Formats
without that evidence remain unavailable, not “best effort.”

## Consequential decisions and source grounding

- **Owners commit canonical imports.** Translators emit typed commands and
  never write family tables.
- **Files owns every durable export output.** Translation owns job, plan,
  fidelity and exact `ExportFileLink`; transient renderer bytes are not another
  artifact authority.
- **Fidelity is visible and versioned.** Unsupported features block or appear
  in a loss report instead of silent best effort.

Grounding: [Translation and Templates](../capabilities/translation-and-templates.md),
[import/export flow](../flows/import-export.md),
[Files/Sources/Connectors](../capabilities/files-sources-connectors.md), and
[Q007](../questions/README.md#q007--native-package-cryptographic-policy).

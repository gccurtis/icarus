# Stage 04 — Documents

## Outcome

Build the first complete editable Resource family: a backend-owned Document
aggregate with stable structure, rich inline content, base/ChangeSet/head
history, semantic reconciliation, comments/notes anchors, family templates,
deterministic JSON/Markdown rendering, and durable multi-Cell collaboration.

Documents owns only Document anchor identity, validation, rebasing/orphaning,
and render/export semantics. The Collaboration capability introduced later owns
comment/private-Note records, commands, visibility, and persistence.

Prompt blocks are modeled and can hold sealed prior Resolution output, but live
Knowledge/Intelligence resolution is activated in Stage 06.

## Non-goals

- browser editor implementation
- DOCX/PDF translation
- a generic Resource payload/change log/template system
- universal realtime synchronization
- formula, image-generation, or inference clients inside Documents
- silent merging or last-write-wins for incompatible edits

## Target tree

```text
internal/capabilities/resources/documents/
  api.go
  model.go
  structure.go
  tables.go
  media.go
  styles.go
  typed_blocks.go
  inline.go
  marks.go
  changes.go
  operations.go
  conflict.go
  anchors.go
  prompt.go
  output_revisions.go
  ports.go
  validate.go
  render.go
  errors.go
  templates/
internal/capabilities/changecore/       optional pure shared mechanics
internal/cell/handlers/documents/
  commands.go
  queries.go
  prompt.go
  styles.go
  output_revisions.go
  repository.go
  mysql/
migrations/project/*_documents_expand.sql
test/golden/documents/
```

## Canonical model

The initial complete model includes:

- Document identity metadata linked to the Project Resource catalog;
- print/page geometry and document styles;
- a versioned semantic StyleRegistry, StyleDefinition revisions, exact usages,
  supported overrides and deterministic historical rendering;
- stable ordered Sections/Rows/Blocks as the selected structural model;
- block kinds: paragraph, heading, list item, quote, code, divider, prompt,
  image, embed, table, chart, metric, and explicitly unsupported future-kind
  handling, each with exactly one matching versioned payload;
- stable atoms/runs, text, inline Formula/Prompt output slots, marks and anchors;
- a real structured `Table` contract with stable Table/Row/Column/Cell
  identities, rectangular ownership, validated row/column spans, ordered
  cell-contained Blocks/Atoms, and deterministic structural anchors;
- an exact-version `MediaRef` contract with an opaque File/asset identity and
  immutable version, verified digest/media type/byte size, bounded alt text and
  caption, fit/crop and dimensions, and no bucket key, presigned URL, mutable
  “latest” pointer, or embedded bytes;
- typed Image/Embed/Chart/Metric contracts with exact File/provider/Formula/
  DataObject revisions, safe accessible fallback, closed presentation specs,
  last-good typed values and no SDK/runtime/HTML payload;
- provenance on server-authored/generated components;
- stable collaboration-anchor references and deterministic rebase/orphan rules;
- immutable PromptOutputRevision history with current and last-good-generated
  pointers, user-divergence, append-only restore and retention/reference pins;
- family template definitions/parameters and instantiation behavior;
- verified base snapshot, ordered canonical Document ChangeSets, live-ID ledger,
  head, schema version, checkpoints, and retention metadata.

Every persisted value is serializable and contains no runtime client, provider,
repository, context, callback, lock, or transport field.

### Structured tables

`Table` is canonical Document structure, not a placeholder or rendered image.
It contains a stable `TableID`, ordered stable `TableRowID` and
`TableColumnID` values, and stable `TableCellID` values. Each cell names its
origin row/column, positive bounded row/column span, ordered contained
Blocks/Atoms, and versioned family-native attributes. The occupied-cell grid
must be complete and rectangular: no overlap, hole, dangling row/column,
duplicate identity, out-of-bounds span, containment cycle, or content owned by
two cells is valid. Header semantics and accessibility labels are explicit
attributes, never inferred solely from visual position.

Table changes create/remove/move rows and columns, create/update/remove cells,
change spans, and edit contained ordinary Document content through typed
operations. Each operation declares the exact table/row/column/cell and
expected revision it reads or changes. Span changes are judged against the
whole affected rectangle; incompatible concurrent ownership changes return an
explicit conflict. Render, extraction, anchors, templates, checkpoints and
canonical JSON preserve the same identities and logical reading order.

### Exact-version media

`MediaRef` contains only an opaque `FileID`/asset identity and exact immutable
`FileVersionID`, verified digest, media type, byte size and safe display
metadata. Document-owned display state is bounded alt text, caption, fit/crop,
intrinsic dimensions and requested layout dimensions. Files remains the owner
of bytes, rendition availability, scanning/quarantine and access policy.

Creating or replacing media requires `AssetMetadataProvider` to resolve the
exact authorized version and return normalized verified metadata before the
candidate ChangeSet is accepted. Unknown, mutable, quarantined, digest-
mismatched, inaccessible or unsupported versions fail closed. A later File
version never silently changes an existing Document. Rendering/extraction
reauthorizes the exact reference and reports an explicit unavailable/redacted
projection when policy permits the Document but not the asset; it never swaps
in another version or leaks storage identity.

### Versioned styles

`StyleRegistry{Revision, Styles}` is folded as canonical Document content.
Each `StyleDefinition` has a stable StyleID, own revision/name, closed
applicable BlockKinds, semantic typography/spacing/appearance token sets and
an allowlist of per-Block override keys. Blocks store only StyleID and admitted
overrides. CSS, editor classes, font files and browser measurements are not
persisted domain values.

Registry create/update/apply/delete are first-class versioned Product
operations and each emits a normal canonical Document ChangeSet. Updating a
definition changes its usages only at the new head; historical heads retain
the prior registry. Delete requires zero exact usages or an atomic replacement
across every usage. Concurrent edits to independent Styles may rebase, while
the same definition/usage conflicts under exact registry/style/block revisions.

### Typed Image, Embed, Chart and Metric blocks

- Image pins an exact same-Project ready FileVersion plus verified digest,
  media type and size. It owns caption, fit/crop/layout, and either bounded alt
  text or an explicit mutually exclusive decorative flag. Missing/denied media
  renders an accessible safe fallback and never follows “latest.”
- Embed accepts only an exact ready FileVersion or an admitted provider's
  immutable snapshot/version/digest. It stores provider-contract and sandbox-
  policy versions, title, dimensions and fallback label/link. Raw HTML,
  JavaScript, credentials and mutable SDK objects are invalid; unsupported or
  denied providers render fallback content under no weaker authority.
- Chart pins an exact Formula/DataObject definition plus dependency versions,
  expected public type/shape, a bounded closed chart spec, last-good typed
  value/digest, and a canonical accessibility summary/table.
- Metric pins the same exact typed binding discipline for a scalar/unit,
  bounded number format, accessible label and last-good typed value/digest.

Formula/provider work runs outside the Document transaction. Its candidate can
commit only if the exact definition, dependencies, payload revision and
Document head still match. A failed or stale evaluation never blanks last-good
presentation. Embed production adapters run under admitted origin/redirect,
sandbox, CSP, credential and egress policy; headless rendering uses the
canonical fallback rather than executing an embed.

### Prompt Output presentation revisions

Documents stores visible `PromptOutputRevision` values; Resolution stores
Resolvable, Result and Evidence truth. A revision is immutable and
origin-tagged as `result_applied`, `generated_proposal`, `user_edit`,
`canonicalized`, or `restored`, with exact optional Result/artifact version,
trusted actor/time and lineage. `CurrentOutputRevisionID` is rendered;
`LastGoodGeneratedRevisionID` identifies the newest validated generated
presentation.

Ordinary refresh replaces visible Output only when the expected current
presentation has not diverged. Otherwise it appends a generated proposal,
advances last-good-generated and preserves the current User edit. Dirty,
resolving, contradiction-awaiting, failed, cancelled and inaccessible states
retain both pointers. Restore appends a new revision that names its retained
source; it never mutates or makes an old row current in place. Retention pins
referenced, current and latest-user-edited revisions, and presentation history
cannot become Evidence.

## Operations

Register the exact Document operations from
[Documents](../capabilities/documents.md#commands-and-queries) and the five
`documents.templates.*.v1` operations from
[Translation and Templates](../capabilities/translation-and-templates.md#family-templates).
There is no stage-local alias or generic Template operation.

This includes the canonical `documents.styles.create.v1`,
`documents.styles.update.v1`, `documents.styles.apply.v1`,
`documents.styles.delete.v1`, `documents.styles.get.v1`,
`documents.styles.usages.list.v1`,
`documents.prompt_outputs.revisions.list.v1`,
`documents.prompt_outputs.revisions.get.v1`, and
`documents.prompt_outputs.revisions.restore.v1` surfaces. Typed Image/Embed/
Chart/Metric edits are closed native ChangeSet operations submitted through
`documents.submit_changes.v1`; they do not introduce generic block-payload or
provider-specific Product aliases.

### Lifecycle and reads

- create blank or from a trusted validated initial recipe atomically with
  Document identity and family-owned summary projection;
- duplicate one authorized exact head into a new independent same-Project
  Document identity/base/head with bounded source provenance;
- get metadata or bounded editor projection at exact/current head;
- load base plus retained tail, or canonical suffix from a retained anchor;
- rename, archive, restore, and deletion authorized by the current Project
  grant plus retention/deletion policy;
- bounded, read-only deterministic Markdown/plain-text/JSON render and
  structural outline through `documents.render.v1`; an over-bound render
  returns `document_render_async_required` without side effects, after which
  `documents.render_jobs.request.v1` admits the exact-head durable render and
  `documents.render_jobs.status.get.v1` observes its typed result metadata;
- exact-head semantic Style registry and bounded Style usage queries;
- cursor/byte-bounded Prompt Output revision list/get with current/last-good-
  generated flags and no Result/Evidence body leakage;
- extraction for Knowledge that identifies authored versus generated display.

### Editing

- insert/update/remove/move structure and inline atoms;
- create/update/remove/move structured table rows, columns and cells, validate
  spans/rectangular ownership, and edit cell-contained ordinary Blocks/Atoms;
- insert/replace/remove one exact-version MediaRef and update only its bounded
  Document-owned caption/alt/layout metadata under expected revision;
- replace text span under stable anchors and expected content/version;
- add/remove/update marks;
- create/update/apply/delete semantic styles under exact registry/style/block
  revisions and update print geometry under bounds;
- insert/update/remove typed Image/Embed/Chart/Metric payloads only after exact
  external reference/type/shape/access validation;
- validate and rebase bounded collaboration-anchor references without storing
  comment or private-Note content;
- create/update/clear Prompt Block definition, incorporate a sealed generated
  Output revision, preserve a divergent User presentation, and restore history
  by appending a new revision;
- undo/revert by producing a new domain-valid ChangeSet, never deleting history;
- checkpoint/compact without changing reconstructed head.

Documents owns its typed Template definition, publication, version and
instantiation rules. Workspace or Data Catalog may expose a cross-family
Template catalog projection over registered Document, Workbook, Deck and Board
operations, but that projection neither owns Template state nor introduces a
generic Template mutation API.

`documents.templates.instantiate.v1` validates the confirmed exact plan and
delegates one atomic canonical create using a trusted recipe plus lineage.
`documents.create.v1` does not independently accept caller-asserted Template
identity or skip Template requirements/stripping.

## Change and reconciliation contract

Native Document operations map into deterministic general operations where
Change Core is useful. Documents owns semantic meaning, live IDs, transforms,
and final minting.

- Existing canonical history is immutable.
- One submitted ChangeSet is atomic.
- Disjoint operations append regardless of arrival order after rebase.
- Compatible text/structure changes transform deterministically.
- Deleted targets, overlapping incompatible spans, broken anchors, or semantic
  special operations return constructive rejection/conflict.
- Missing/pruned anchor returns `not_synced` plus bounded recovery data.
- Commit returns canonical accepted suffix/head, not merely “saved.”
- Author/provenance comes from trusted execution, never request claims.

## Handler and repository contract

The handler:

1. validates bound Resource/Document/action;
2. loads one consistent base/tail/head/live-ID, StyleRegistry, typed-payload
   and Prompt Output-pointer view;
3. validates and folds it through the pure capability;
4. asks Documents to judge/rebase the proposal;
5. obtains a fresh one-use permit;
6. in one Project transaction consumes permit, appends exactly once against
   current head, updates catalog summary, stores idempotency/Audit/job fact;
7. retries only the bounded documented stale-head path; and
8. returns canonical head/projection or explicit conflict.

Repository methods never accept an untrusted Project identifier or generic
payload. Checkpoint swap is guarded against stale head and verifies identical
reconstruction.

Style, typed-block and Output-revision effects use the same single Document
transaction/permit/Audit boundary as content. Output revision append and its
current/last-good pointer update are atomic. External File/embed/Formula/
Resolution calls occur before that transaction; the commit rechecks every
exact normalized reference and expected version. Cursor queries are bounded
and read only the owning repositories/typed ports, never sibling tables.

The bounded render Query never writes or changes class. Its separate
idempotent durable request freezes the exact head, options and policy version
and commits Job/work receipt/idempotency/Audit under the ordinary durable-work
protocol; the status Query is read-only. Ask can use only the bounded Query and
cannot submit the durable request.

## Ports

- `PromptResolutionProvider` for Stage 06, expressed in Document terms;
- `FormulaEvaluationProvider` for later formula-bound atoms;
- `AssetMetadataProvider` for authorized exact-version File/asset metadata and
  rendering;
- `EmbedSnapshotProvider` for an admitted immutable normalized snapshot plus
  safe fallback and exact provider/sandbox-policy versions;
- deterministic ID/clock only where operation inputs cannot supply them.

Adapters live with handlers/wiring and call registered operations. Documents
does not import Knowledge, Resolution, Formula, Files, or provider SDKs.

## Stable failures

Invalid structure/mark/geometry; unsupported schema/kind; not found without
existence leak; forbidden/stale authority; stale/pruned anchor; fork/gap/digest
integrity failure; deleted/dead target; incompatible conflict; oversized
Document/ChangeSet/render; style in-use/revision conflict; unavailable exact
asset; unsafe/unsupported embed; typed-binding shape mismatch; Output revision/
pointer conflict or retention pin; unavailable provider; idempotency mismatch;
`document_render_async_required`; and temporarily unavailable persistence.
Stable public codes are exactly those
registered in the [Document capability](../capabilities/documents.md#security-failure-and-stable-errors).

## Proof matrix

Required headless journey:

```text
create D -> create Style S -> apply S -> update S -> historical heads differ
insert Image F@V3 + Embed Snapshot@R2 + Chart Formula@V7 + Metric Data@V4
resolve Prompt P -> R1 current/last-good; edit -> R2 current/diverged
refresh -> R3 generated proposal while R2 remains visible
list/get R1..R3 -> restore R1 -> append R4 restored-from R1
restart -> fold base/tail -> identical registry, blocks, pointers and render
revoke File/embed access -> same Document renders explicit accessible fallback
```

- table/property/fuzz tests for every structure and edit invariant;
- structured-table golden/property/fuzz proofs cover row/column/cell identity,
  complete rectangular ownership, span overlap/hole rejection, contained
  content, anchors, reconciliation, rendering and extraction;
- MediaRef proofs cover exact-version pinning, digest/type/size verification,
  quarantine/access failure, concurrent replacement, version drift, storage-
  identity redaction, and deterministic unavailable rendering;
- StyleRegistry proofs cover create/update/apply/delete, zero-usage or atomic
  replacement, independent/same-style races, historical reconstruction,
  unknown token/override and CSS/editor-class rejection;
- typed Image proofs cover exact FileVersion, no-current substitution, crop/
  dimensions, alt-versus-decorative and inaccessible accessible fallback;
- typed Embed proofs cover immutable snapshot/provider/sandbox versions,
  scheme/origin/redirect/CSP/credential/HTML rejection and headless fallback;
- Chart/Metric proofs cover exact Formula/DataObject definition/dependency
  versions, type/shape/spec bounds, stale result, last-good retention and
  accessibility summary/table/label;
- same inputs produce byte-identical change identity and render output;
- bounded render is side-effect-free; an over-bound render creates no Job or
  artifact and names the exact durable request; request replay is idempotent,
  status is read-only, and the ready result remains Document-owned typed render
  metadata rather than a File export;
- base + ordered ChangeSets reconstructs the recorded head;
- gaps/forks/duplicates/digest/schema corruption fail closed;
- disjoint and overlapping races across independent Cells/Hosts;
- stale compatible edit reconciles once; incompatible edit remains explicit;
- comment/Note test-double anchors rebase or become visibly orphaned, never
  silently move;
- Document state, render, extraction, and export contain no comment or private-
  Note record/content; Stage 12 proves their User visibility and persistence;
- checkpoint preserves exact content/history policy;
- all seven Document Template surfaces enforce preview/plan digests, immutable
  versions/current pointers, lifecycle, stripping, lineage and ordinary
  Document creation exactly once;
- crash/retry/idempotency/Audit/permit behavior around append;
- extraction excludes hidden prompt/formula source leakage and labels generated
  display to prevent feedback;
- Output revision list/get cursor and byte bounds, immutable origin/actor/
  Result lineage, concurrent User edit versus refresh proposal, exact append-
  only restore, current/last-good persistence, retention pins and no Result/
  Evidence body leakage;
- Markdown/JSON golden review from live MySQL canonical state; and
- operator Project-database backup/restore reconstructs exactly the same heads;
  Product archive/package import is separately validated and is not this
  recovery mechanism.

## Completion boundary

The full Document—including semantic versioned Styles, structured editable
Tables, exact-version Images, admitted immutable Embeds, typed Chart/Metric
blocks, and immutable Prompt Output presentation history—works headlessly and
collaboratively. None is a placeholder or deferred generic payload. Prompt
Blocks can be created, user-edited, listed, read and restored with last-good
semantics, but executing/refreshing them remains unavailable until Stage 06
provides Knowledge, Intelligence, Formula/Data and Resolution adapters.

## Source grounding

- [SOL X 26 — Document Model, Content, Styles & Revision](https://app.notion.com/p/39ab6410e5028138a2edf7db1214ad1e)
  is the exact construction source for StyleRegistry, typed Image/Embed/Chart/
  Metric blocks and Prompt Output presentation revision semantics.
- The pinned Nova `3df790b2` Document model/promptblock source and tests linked
  from the [capability contract](../capabilities/documents.md#nova-evidence-pinned)
  ground stable IDs, marks, prompt lifecycle, bounded history and last-good
  preservation. They do not prove Styles, typed block security, Output restore,
  MySQL durability or Product authority.

# Documents

## Purpose

Documents provides backend-owned structured authoring, deterministic
reconstruction, semantic multi-Cell reconciliation, prompt and Formula-backed
content, exact-version extraction, comments anchors, templates, and headless
rendering. A browser editor is a replaceable projection of this model.

### Owns

- Document identity, name, lifecycle, representation version and print/page
  settings.
- Stable Rows, Blocks, Atoms, marks, styles, order and family-native anchors.
- Authored text and structure plus last-good display state for prompt and
  Formula atoms.
- One verified base, a contiguous canonical Document ChangeSet stack, head,
  live-ID ledger and verified checkpoint metadata.
- Document-specific extraction, render, template and conflict semantics.

### Does not own

- Sessions, Project grants, entitlements, one-use permits, required Audit,
  repositories, SQL, object storage, jobs, logging, HTTP or editor state.
- Model/provider selection, knowledge retrieval, Formula evaluation, comments,
  Activity, search indexes or import/export codecs.
- A Project-wide history. Document ChangeSets apply only to one Document.

## Supported feature contract

| Feature | Required behavior | Canonical boundary |
| --- | --- | --- |
| Structured WYSIWYG | Paragraphs, headings, nested lists, horizontal block layout, tables, media, dividers and explicit page breaks use stable backend identities | Rows/Blocks/Atoms and print settings, not editor nodes |
| Rich text | Exact text, links and versioned marks over validated text ranges; unknown marks fail closed | Text atom plus family-native range anchors |
| Semantic styles | A versioned Document-owned StyleRegistry defines bounded semantic typography/spacing/appearance, applicability and usages; registry edits and block assignment are canonical ChangeSets | Style definitions and block StyleID/allowed overrides, never editor CSS |
| Print-first layout | Page size, orientation, margins, header/footer references and page-break behavior produce deterministic page geometry | Document print configuration |
| Prompt blocks/content | Store prompt source/mount identity, resolution state, immutable Output presentation revisions, current and last-good-generated pointers; refresh failure never erases visible or last-good content | Prompt atom, exact Result/artifact link and Document-owned presentation history |
| Formula content | Store expression, typed result/error, dependency versions and last-good display | Formula atom; evaluation is supplied through a port |
| Tables and columns | Structured cells and spans remain addressable; horizontal Rows express multi-column layout without flattening text | Document structure, not a screenshot |
| Images | Typed Image blocks pin an exact verified FileVersion/digest and own alt/decorative state, caption, crop/fit and layout; inaccessible media renders an explicit safe fallback | Image payload in Document; bytes/renditions remain Files-owned |
| Embeds | Typed Embed blocks accept only an admitted immutable provider snapshot or exact FileVersion plus sandbox policy and accessible fallback; mutable arbitrary HTML is never canonical | Versioned embed reference/policy, not an iframe or SDK object |
| Formula-driven blocks | Typed Chart and Metric blocks pin exact Formula/DataObject definition and dependency versions, expected public type/shape, presentation spec and last-good typed result | Document presentation with Formula-owned evaluation |
| Outline and sections | Headings and explicit section metadata yield deterministic outline/navigation | Derived from canonical structure |
| Sources/provenance | Authored and generated units retain server-stamped actor, delegation and exact source/artifact references | Document provenance; provider payloads excluded |
| Comments and notes | Stable anchors can be validated and rebased; thread content remains Collaboration-owned | Document defines anchor semantics only |
| History and undo | Canonical ChangeSets are inspectable; inverse/proposal operations are explicit new submissions, never history deletion | Base + stack + head |
| Templates | Any eligible canonical Document version can be marked/instantiated with declared parameters | Document version plus template metadata |
| Extraction | Display text, semantic Markdown and a bounded contribution omit hidden prompt/formula source unless explicitly requested and authorized | Exact Document head |
| Import/export | Markdown/JSON are deterministic core projections; DOCX/PDF/native package adapters are explicit versioned translators | Translation does not become canonical truth |

## Canonical domain model

Names below describe serializable domain values, not required Go field names.

| Type | Required content and invariant |
| --- | --- |
| `Document` | `DocumentID`, name, lifecycle, representation version, creator, created/updated attribution, print settings, base/head metadata; identity never changes |
| `DocumentBase` | Exact fold revision, canonical structure, live-ID summary and digest; verified against reconstructed content before activation |
| `DocumentHead` | Canonical revision, final ChangeSet ID/digest and representation version; agrees with the contiguous stack |
| `Row` | Stable `RowID`, layout attributes and ordered stable Block IDs; Row identity survives movement |
| `Block` | Stable `BlockID`, closed versioned kind, attributes, ordered Atom IDs and server provenance; identity survives movement |
| `Atom` | Stable `AtomID`, closed versioned kind and payload: text, Formula binding/result or prompt binding/result |
| `Table` | Stable table/row/cell identities, spans, ordered content and validated rectangular ownership; a cell contains ordinary document Blocks/Atoms through explicit containment |
| `MediaRef` | Opaque exact File/asset version, integrity metadata, alt text, caption, fit/crop and dimensions; no bucket key or presigned URL |
| `StyleRegistry` | Monotonic registry revision and bounded unique StyleDefinitions; it is part of the Document head and reconstructs deterministically with the ChangeSet stack |
| `StyleDefinition` | Stable StyleID, own revision/name, closed applicable BlockKinds, semantic typography/spacing/appearance tokens and allowed override keys; contains no CSS, font file or editor class |
| `BlockStyleRef` | Stable StyleID plus only explicitly supported overrides; unknown/deleted styles or overrides fail closed, and deletion requires zero usage or an atomic replacement |
| `ImageBlock` | Exact same-Project FileID/FileVersionID, verified digest/media type/size, alt text or explicit decorative flag, caption, fit/crop/intrinsic/requested dimensions, optional safe link and fallback label; never “latest,” bytes or a delivery URL |
| `EmbedBlock` | Closed source union of exact ready FileVersion or admitted immutable provider snapshot/version/digest, provider-contract and sandbox-policy versions, bounded dimensions/title/fallback label/link; no raw HTML, script, credential or mutable provider client |
| `ChartBlock` | Exact typed Formula/DataObject binding and definition/dependency versions, expected public shape, versioned chart spec, accessibility summary/table fallback, state and last-good typed value/digest |
| `MetricBlock` | Exact typed Formula/DataObject binding and definition/dependency versions, expected scalar/unit, number-format and accessible label, state and last-good typed value/digest |
| `Mark` | Stable `MarkID`, closed kind and attributes, start/end `(AtomID, UTF-8 byte offset)` at rune boundaries; range order and containment are validated |
| `PromptBinding` | Prompt source or exact ResolutionMount, binding revision, normalized evidence/provenance summary, state, CurrentOutputRevisionID, LastGoodGeneratedRevisionID and PresentationDiverged; Result/Evidence bodies remain Resolution-owned |
| `PromptOutputRevision` | Immutable Block-scoped presentation revision with stable ID/ordinal, origin (`result_applied`, `generated_proposal`, `user_edit`, `canonicalized`, `restored`), exact optional Result/artifact version, display content, source revision for restore, trusted actor/time and retention/reference pins |
| `FormulaBinding` | Expression, expected/render context, typed value/error, dependency versions, state and last-good display |
| `DocumentAnchor` | Document/head plus stable structural target and optional range; never an editor DOM position alone |
| `DocumentChangeSet` | Server-minted ID, prior/head revisions, canonical operation list, actor/delegation, time, client submission identity, digest and bounded summary |
| `Checkpoint` | Existing head revision, base digest, stack coverage and verification result; cannot invent a new semantic revision |
| `DocumentRenderResult` | Immutable request/result IDs, exact Document head/dependency lineage, closed semantic/Markdown/print kind, renderer/policy versions, digest, size, warnings and opaque family result reference; no delivery URL or mutable “latest” pointer |

Every closed kind carries an explicit representation version. Numeric and size
bounds are validated before allocation. IDs are unique for the life of a
Document and cannot be reused after deletion. Provenance is injected from the
trusted execution, never accepted from the client.

StyleRegistry is canonical content, not a browser preference. Creating,
updating, applying or deleting a Style advances the Document head through an
attributable ChangeSet. Updating a definition changes all blocks referring to
that Style at the new head while prior heads retain the prior definition.
Deleting a used Style is rejected unless the same atomic command names a live
replacement and rewrites every usage. A renderer receives semantic tokens and
maps them to its own versioned presentation rules; persisted CSS or editor
classes are forbidden.

Every typed block row contains exactly one payload matching its BlockKind.
Images never follow a mutable File “current version.” Embeds are inert domain
descriptions: production rendering selects an admitted adapter and sandbox
policy, while unsupported, denied, stale or unavailable content renders the
stored accessible fallback and safe link. External live URLs without an
immutable provider snapshot are Links, not Embed content. Chart and Metric
evaluation occurs outside the mutation transaction; stale/failing evaluation
retains the last-good value and visibly labels its dependency state. Their
accessible summary/table or label is canonical Document presentation, not
optional browser-only metadata.

Prompt presentation history is distinct from Resolution Result/Evidence
history. The current revision is what the Document renders. The last-good-
generated pointer is the newest validated generated presentation associated
with a successful exact Result, even when a later user edit remains current.
Ordinary refresh appends `result_applied` and advances both pointers only when
the current presentation still matches the expected generated revision. If a
User or concurrent change diverged, it appends `generated_proposal`, advances
last-good-generated, and preserves the visible current revision. Dirty,
resolving, contradiction-awaiting, failed, cancelled and inaccessible states
therefore never blank an existing Output.

Restoring history never moves a pointer backward to a mutable old row. It
appends a new `restored` revision that identifies the immutable source
revision, advances current under exact expected versions and preserves the
original. Retention always pins referenced revisions, current, and latest
user-edited; presentation history is never Evidence and cannot be cited as
factual support.

### Change operation vocabulary

A ChangeSet is an atomic ordered list of typed operations. Initial operation
families are:

- create, remove and move Row/Block/Atom using stable parent and before/after
  anchors;
- replace or splice authored text with an exact prior atom revision and range;
- set/remove one versioned Block, Row, table, media or print attribute;
- add/update/remove one Mark against validated atom ranges;
- bind, update, refresh-result or unbind one prompt/Formula atom;
- create/update/delete one Style definition, atomically replace its usages, or
  assign/remove a StyleRef under exact registry/block revisions;
- insert/update/remove typed Image, Embed, Chart or Metric payloads with exact
  external references and expected payload revision;
- append or restore one immutable PromptOutputRevision under the exact current
  presentation/binding revision;
- create/update/remove table rows, columns, cells and spans; and
- attach/detach family-native comment anchors without owning comment content.

There is no untyped JSON patch. Each operation declares the units it reads,
creates, updates, moves or removes. A ChangeSet is accepted or rejected as a
whole.

## Commands and queries

| Product operation | Kind | Capability behavior |
| --- | --- | --- |
| `documents.create.v1` | Idempotent command | Create blank or from a trusted already-validated initial recipe and produce base/head revision zero |
| `documents.duplicate.v1` | Idempotent command | Reconstruct one authorized exact source head and create an independent same-Project Document base/head with bounded provenance; comments, review state and private workspace state are not copied |
| `documents.rename.v1` | Command | Validate name and expected metadata revision |
| `documents.set_lifecycle.v1` | Command | Archive/restore or create a retention-governed deletion tombstone; never silently purge history |
| `documents.submit_changes.v1` | Idempotent command | Judge a submitted atomic ChangeSet against base/retained tail/head, semantically rebase if valid and return accepted canonical set or bounded conflict |
| `documents.styles.create.v1` | Idempotent command | Add one bounded semantic StyleDefinition under exact registry/head revision and append its canonical ChangeSet |
| `documents.styles.update.v1` | Idempotent command | Rename or change admitted tokens/applicability under exact Style/registry/head revisions without persisting editor CSS |
| `documents.styles.apply.v1` | Idempotent command | Assign/remove one StyleID and supported overrides across a bounded exact Block set as one atomic canonical ChangeSet |
| `documents.styles.delete.v1` | Idempotent command | Delete an unused Style or atomically replace every exact usage; otherwise return `document_style_in_use` |
| `documents.styles.get.v1` | Query | Return the exact-head registry and definitions with semantic tokens only |
| `documents.styles.usages.list.v1` | Query | Return a cursor-bounded authorized list/count of Blocks using one exact Style revision |
| `documents.checkpoint.v1` | Durable command | Verify reconstructed head, write a candidate base and conditionally activate only at that same head |
| `documents.resolve_prompt.v1` | Durable command | Resolve exact prompt input outside the mutation transaction, then conditionally append `result_applied` or `generated_proposal` presentation with exact Result/evidence summary and current/last-good pointer semantics through a ChangeSet |
| `documents.prompt_outputs.revisions.list.v1` | Query | Return cursor-bounded immutable presentation history for one Prompt Block; the default UI page is five but the API limit remains policy-bounded |
| `documents.prompt_outputs.revisions.get.v1` | Query | Return one authorized immutable Output revision, its origin/lineage and whether it is current/last-good-generated without Resolution evidence bodies |
| `documents.prompt_outputs.revisions.restore.v1` | Idempotent command | Append a new `restored` revision from one retained source revision under exact current output/binding/head versions; never rewrite history |
| `documents.refresh_formula.v1` | Durable command | Evaluate exact expression/dependencies, then conditionally commit typed result through a ChangeSet |
| `documents.get.v1` | Query | Return metadata and a bounded canonical projection at a requested supported head |
| `documents.load.v1` | Query | Return verified base plus contiguous tail, or a retained suffix after a known ChangeSet; unknown/pruned anchor returns explicit resync data |
| `documents.history.v1` | Query | Return bounded ChangeSet summaries and attribution without leaking content the caller cannot read |
| `documents.render.v1` | Query | Return a bounded deterministic semantic JSON, display-text, Markdown or print-model projection at one exact head; it never creates durable work or an artifact |
| `documents.render_jobs.request.v1` | Idempotent durable command | Freeze one exact head, render format/options and policy version and admit a durable render Job under the ordinary work-authority protocol |
| `documents.render_jobs.status.get.v1` | Query | Return bounded safe Job state and, when ready, typed Document-render result metadata for that exact request |
| `documents.extract.v1` | Query | Produce a bounded, deterministic, exact-head Knowledge contribution with stable anchors and provenance |
| `documents.validate_anchor.v1` | Query | Validate/rebase a comment or external reference anchor against a later exact head |

`documents.render.v1` has one fixed read-only request class. It succeeds only
when the exact-head projection fits the declared interactive byte, node and
time bounds; it cannot create a Job, WorkAuthority, render object,
idempotency record or Audit mutation. Work beyond those bounds returns
`document_render_async_required` with
`documents.render_jobs.request.v1` as the exact next operation, without side
effects. The durable request freezes the exact Document head, representation,
format, render options, dependency versions and policy version before it
commits its request, Job, receipt and Audit envelope through the ordinary
durable-work protocol. Its status query is read-only and returns a typed
Document render-result reference, media/semantic kind, digest, size, renderer
version and exact input lineage when ready. Creating an export File remains a
Translation operation. Ask may call the bounded render query when admitted,
but dispatch never auto-upgrades that query into the durable command.

Import/export remains a Translation operation, while the cross-family Template
catalog is a Workspace/Data projection. Documents supplies only its family-
specific Template representation and validation contracts. Import produces a
validated `create` or `submit_changes` input; export reads an exact head and
records its output File.

Document Template publication and instantiation use the seven family-owned
`documents.templates.*.v1` operations defined by
[Translation and Templates](translation-and-templates.md#family-templates).
`documents.templates.instantiate.v1` validates the confirmed exact
InstantiationPlan, then delegates the atomic canonical creation to
`documents.create.v1` with a trusted validated recipe and lineage. A caller
cannot bypass the Template plan by sending untrusted template metadata directly
to `documents.create.v1`; the two operations therefore do not compete as
public instantiation semantics.

## Capability API and ports

The pure API includes construction/validation, `Fold`, `JudgeAndRebase`,
`Apply`, `VerifyCheckpoint`, `Render`, `Extract`, `ValidateAnchor`, Style
registry create/update/apply/delete/usages, typed block validators, and builders
that convert normalized prompt/Formula results or restored presentation into
typed ChangeSets.

Only true external behavior becomes a capability-owned consumer port:

```go
// Illustrative names; persisted models contain only the plain request/result.
type PromptResolutionProvider interface {
    Resolve(context.Context, PromptResolutionRequest) (PromptResolutionResult, error)
}

type FormulaEvaluationProvider interface {
    Evaluate(context.Context, DocumentFormulaRequest) (DocumentFormulaResult, error)
}

type AssetMetadataProvider interface {
    ResolveExact(context.Context, DocumentAssetRequest) (DocumentAsset, error)
}

type EmbedSnapshotProvider interface {
    ResolveExact(context.Context, DocumentEmbedRequest) (DocumentEmbedSnapshot, error)
}
```

Requests carry exact Resource/head/binding/dependency references and bounded
content. Results are normalized Document vocabulary, not provider SDK values.
Handler adapters invoke Resolution/Formula/Files through nested dispatch.
`EmbedSnapshotProvider` returns only an admitted immutable normalized snapshot
reference and safe fallback metadata under a named sandbox-policy version; it
never returns HTML, a provider SDK value or executable handle. Formula results
for Chart/Metric are normalized typed values with exact definition/dependency
versions and a bounded accessibility projection.

The handler, not the capability, owns repository contracts for consistent
base/stack/head load, conditional append, checkpoint activation and lifecycle;
idempotency; Project transactions; permit consumption; required Audit; and job
submission.

## Persistence and concurrency

Canonical state is:

```text
verified base at B + contiguous ChangeSets (B -> ... -> H) = head H
```

One consistent read validates representation versions, digests, unique IDs,
contiguous prior/next revisions and deterministic folding. A gap, fork,
duplicate, unknown operation, digest mismatch or structurally invalid fold is
`document_integrity_failure`; no partial content is served.

Submission follows this protocol:

1. Load a consistent base, retained canonical tail and head.
2. Validate the submission against its observed anchor and live-ID ledger.
3. If the anchor is current, apply it deterministically.
4. If canonical work intervened, judge semantic read/write/create/remove sets.
   Independent siblings and different properties may rebase. Updates to a dead
   unit, duplicate births, dependency on a rejected birth, incompatible text
   spans, competing moves or different writes to one property conflict.
5. Resolve positional intent against stable neighbors. Concurrent inserts at
   one surviving anchor receive a deterministic canonical order by minted
   ChangeSet identity; arrival time is not content authority.
6. Obtain a fresh permit only after the candidate canonical suffix is known.
7. In one Project transaction, lock/validate head and authority fence, consume
   the permit, append the canonical set, advance head, record idempotency and
   required Audit, and enqueue follow-up facts.
8. If head advanced before the lock, retry bounded reconciliation from the new
   head. Never silently last-write-wins.

Checkpoint creation reconstructs and hashes an existing head before storing a
candidate. Activation conditionally changes the base pointer only if canonical
head still matches; later ChangeSets remain valid. Retention may prune served
suffixes only when reconstruction, Audit, legal hold and recovery obligations
remain satisfied.

The verified base and every folded head include the StyleRegistry, typed block
payload versions, PromptOutputRevision identities and current/last-good
pointers. Style definition updates, usage replacement, typed-block edits and
Output restoration therefore use the same semantic read/write sets as any
other ChangeSet. Concurrent edits to different Styles or Blocks may rebase;
competing edits to one Style definition, style assignment, typed payload,
Output pointer or restore source expectation conflict explicitly. A revision
row is immutable after append.

Image and Embed admission resolves the exact external reference before the
candidate ChangeSet is finalized, then the Project transaction rechecks the
trusted normalized reference and expected Document head. Chart/Metric
evaluation likewise occurs outside the transaction and can commit only when
its exact binding, definition, dependency, block and head versions still
match. Render/get/extract reauthorize referenced Files/provider snapshots and
return an explicit inaccessible/unsupported fallback without substituting
another version. Output history list/get reauthorizes the Document and Block,
uses an opaque cursor, enforces result/byte limits and never exposes hidden
prompt, Result or Evidence bodies.

Prompt/Formula provider calls occur outside the Project transaction. Their
commit input includes the exact binding and dependency/head versions. A stale
result is rejected or recorded as stale evidence; it never erases last-good
display. Durable jobs use leases and fencing, but their semantic commit is still
a normal Document ChangeSet.

Each effectful durable checkpoint, prompt-resolution or Formula-refresh request
preselects a stable workflow/request ID, `WorkAuthorityID` and `JobID`. Under a
current session, Control creates exact
`DurableWorkAuthority{PendingProjectReceipt}`; a fresh session-sourced permit
then commits the Document intent/queued ChangeSet, exact Job,
non-authoritative receipt, idempotency, required Audit/fact and the registered
`durable_job@1` terminal record. Trusted
acknowledgement of that exact Project receipt alone activates the work.

Pending authority and a bare receipt cannot issue an ordinary permit. Missing
Project state leaves an unusable expiring/revoked orphan; lost acknowledgement
reconciles only from the exact trusted receipt. Every later canonical
checkpoint activation or result-accepting ChangeSet consumes a fresh permit
sourced by the active WorkAuthority and matching Job/receipt/generation. No
permit is held during reconstruction, retrieval, evaluation or inference.

Current-family sign-out preserves explicitly admitted work; User-wide,
grant/policy/entitlement, cancel/expiry or explicit revocation denies and
fences later commits. `durable_job@1` can only terminalize exact Job
bookkeeping; success requires prebound proof that the ordinary effect already
settled. It cannot change Document/request state, activate a base, append a
ChangeSet, seal/accept output, invoke a provider, enqueue work or widen
authority. Capability state must commit under a fresh permit before revocation
or remain nonterminal.

## Security, failure and stable errors

All operations obey the shared [authority and permit contract](../architecture/control-and-project-boundary.md).
Read projections exclude hidden prompt source, provider evidence, comment
content and referenced File metadata unless the action explicitly permits
them. Export and extraction reauthorize every exact referenced asset.

Image references never expose object keys or delivery URLs. Alt text is
required unless `decorative=true`; a decorative image cannot simultaneously
carry semantic alt text. Embed adapters are allowlisted by provider/contract
version and run under a minimum sandbox/CSP with no inherited Taurus cookies,
credentials, top navigation, arbitrary script bridge or unrestricted network.
Redirects and origins are revalidated by the adapter, and canonical Document
state stores only the normalized immutable snapshot reference and safe
fallback. Chart/Metric specs use a closed rendering grammar, bounded labels/
series/points and inert text; they cannot inject executable formatters. Every
typed block has a deterministic accessible fallback in headless render.

| Family error | Kernel category | Meaning/retry |
| --- | --- | --- |
| `document_invalid_structure` | `invalid_argument` | Model/operation violates bounds or invariants; fix input |
| `document_unknown_kind` | `unsupported_version` | Persisted/requested kind or representation is unsupported; fail closed |
| `document_not_synced` | `precondition_failed` | Anchor is absent/pruned; reload supplied canonical base/tail |
| `document_conflict` | `conflict` | Semantic operation cannot rebase; bounded unit/property context is safe to show |
| `document_stale_binding` | `conflict` | Prompt/Formula result no longer matches binding/dependencies; recompute |
| `document_style_in_use` | `precondition_failed` | Style has live usages and no complete atomic replacement was supplied |
| `document_style_conflict` | `conflict` | Registry, Style definition or exact usage set advanced |
| `document_asset_unavailable` | `precondition_failed` | Exact Image/File or immutable Embed snapshot is inaccessible, unsafe, quarantined or absent |
| `document_embed_unsafe` | `invalid_argument` | Embed source/provider/sandbox/fallback violates the admitted contract |
| `document_binding_shape_mismatch` | `precondition_failed` | Chart/Metric binding public type or shape does not satisfy the typed block |
| `document_output_conflict` | `conflict` | Prompt binding/current/last-good Output revision advanced or restore source is invalid |
| `document_output_revision_retained` | `precondition_failed` | Retention/reference/legal-hold pin forbids pruning the presentation revision |
| `document_integrity_failure` | `integrity_failure` | Base/stack/digest/fold is corrupt or forked; quarantine and repair, do not retry blindly |
| `document_too_large` | `invalid_argument` | Declared or computed limits exceeded |
| `document_render_async_required` | `precondition_failed` | Exact render exceeds interactive bounds; call `documents.render_jobs.request.v1`; no Job, work or artifact was created |
| `document_render_unsupported` | `unsupported_version` | Requested render cannot represent an exact canonical kind without loss |

Infrastructure failures map to stable kernel categories and retain no SQL,
provider payload, prompt content, object URL or internal identifier.

## Cross-capability relationships

- Resolution/Knowledge/Intelligence satisfy `PromptResolutionProvider` without
  entering Document state; evidence is stored as normalized exact references.
- Resolution owns Resolvable, Result/Evidence and contradiction state;
  Documents owns only the mounted Prompt Block's visible immutable Output
  presentation revisions, current/last-good-generated pointers and restore
  semantics. Neither owner reads the other's tables.
- Formula satisfies `FormulaEvaluationProvider`; Documents supplies explicit
  exact binding/definition/dependency references and renders the typed Chart/
  Metric/inline result with last-good and accessibility state.
- Files supplies verified exact asset metadata/renditions; Documents stores
  opaque version references. An admitted Embed adapter supplies an immutable
  normalized snapshot and fallback; Documents never stores HTML or SDK state.
- Knowledge calls `documents.extract.v1` at an exact head. Generated prompt or
  Formula display is labeled and excluded from re-ingestion by default to
  prevent feedback.
- Collaboration stores threads but calls `validate_anchor` for Document-native
  anchors. Presence remains ephemeral.
- Translation consumes/produces the canonical model through explicit versioned
  adapters. Agents invoke ordinary commands or submit reviewable ChangeSets.
- Documents owns all seven Document Template operations and canonical recipe/
  version/lineage state; Translation may share only pure interchange helpers.

## Headless proofs and examples

`taurus-lab` acceptance must be able to create a Document, submit authored
changes, resolve a prompt with a deterministic fake, evaluate a Formula,
checkpoint, reload, render and extract without a browser.

```text
create "Quarterly plan"
  -> head 0
submit [heading "Priorities", paragraph "Ship safely"] at 0
  -> head 1
submit user-A edit and user-B independent insert from head 1
  -> canonical heads 2 and 3; both displays present
create style "Callout" -> registry 1/head 4; apply to paragraph -> head 5
insert Image F@V7, admitted Embed S@R2, Chart C@Formula9 and Metric M@Data4
  -> exact references plus accessible fallbacks at head 6
resolve Prompt P -> Output R1 current/last-good-generated at head 7
edit R1 -> R2/head 8; refresh -> R3 proposal/head 9, R2 stays visible
restore R1 -> append R4/head 10; R1/R2/R3 remain immutable
render --head 10 --format markdown
  -> byte-stable golden Markdown
reload base + tail
  -> same canonical JSON and digest as head 10
```

Required tests include:

- table/property/fuzz tests for every operation and invariant;
- byte-identical canonical encoding, digest, fold, render and extraction;
- legal concurrent sibling/property changes and every conflict class;
- stale/pruned anchors, idempotent replay and mismatched-key conflict;
- base/stack gaps, forks, duplicate IDs, unknown kinds and corrupt digests;
- checkpoint races and reconstruction before/after retention;
- bounded `documents.render.v1` proves zero Job/work/artifact/idempotency writes
  on success and `document_render_async_required`, while the exact durable
  request/status path proves frozen-input replay, typed metadata, lease loss
  and stale-result fencing;
- prompt/Formula timeout, stale result, last-good retention and feedback
  exclusion;
- StyleRegistry create/update/apply/delete and usage replacement under
  concurrent registry/block revisions, including deterministic historical
  render and rejection of CSS/editor-class payloads;
- Image exact-version/digest/access/quarantine/crop/alt/decorative tests and
  deterministic inaccessible fallback without “latest” substitution;
- Embed provider/snapshot/version/sandbox/CSP/redirect/credential negative
  tests plus unsupported/inaccessible accessible fallback;
- Chart/Metric exact Formula/DataObject definition/dependency/type/shape,
  bounded-spec, stale-result, last-good and accessible summary/table tests;
- Prompt Output list/get cursor/byte bounds, origin/actor lineage, concurrent
  user-edit versus refresh, generated-proposal preservation, append-only
  restore, retention pins and no Result/Evidence leakage;
- Unicode range boundaries, table/span validity and anchor rebasing;
- all seven Document Template preview/publish/get/list/plan/instantiate/lifecycle
  surfaces,
  including exact plan digest, stripping, immutable version, ordinary-create
  delegation, idempotency and lineage;
- multi-Host/multi-Cell live database races with caches/notifications disabled;
- crash before/after commit, permit revocation race and atomic effect/Audit; and
- Markdown/JSON golden output plus declared DOCX/PDF loss reports when those
  translators exist.

## Source grounding

- [SOL X 26 — Document Model, Content, Styles & Revision](https://app.notion.com/p/39ab6410e5028138a2edf7db1214ad1e)
  is the exact Taurus construction authority for the versioned StyleRegistry,
  typed Image/Embed/Chart/Metric payloads, PromptBlock-mounted visible Output,
  immutable origin-attributed presentation history, five-revision default
  view, retention pins, restore behavior and last-good preservation. Omega
  retains those product invariants while replacing its former event/service
  mechanics with pure capability logic, ChangeSets and explicit durable jobs.
- Verified original [Document construction](https://app.notion.com/p/377b6410e5028106bb2fc613a9218a27):
  Row/Block/Atom model, prompt/formula cached display, base/tail load, stable
  identity, extraction and collaboration obligations.
- Frozen original [Change Core provider](https://app.notion.com/p/37eb6410e5028183ab89c27ed3406af1):
  deterministic judge/mint, atomic set semantics, live-ID rules and constructive
  rejection. Omega adapts it as a pure library, not an event service.
- [Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0):
  print-first rich authoring, prompt blocks, sources, templates and export.
- Current Omega [capability](../architecture/capability-model.md),
  [persistence](../architecture/persistence-and-concurrency.md) and
  [experience](../product/experience-map.md) contracts supply the accepted
  handler, permit, Project Database and headless boundaries.

### Nova evidence (pinned)

- Taurus Nova evidence at `3df790b2` is concrete but bounded: its
  [`document/model.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/model.go)
  and [`model_atoms.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/model_atoms.go)
  prove stable Blocks, Marks, Anchors, provenance and forward display atoms;
  [`service_test.go`](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/service_test.go)
  characterizes versions, duplicate/stable IDs, restart, optimistic conflicts
  and prompt-excluding extraction; and the
  [`promptblock` tests](https://github.com/gccurtis/merkabah/blob/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/document/promptblock/service_test.go)
  prove lifecycle, grounded refresh, editable display, bounded history and
  stale preservation. Nova does not prove Omega's versioned Style registry,
  typed immutable Image/Embed/Chart/Metric contracts, append-only Output
  restore semantics or production sandbox/access boundaries. The
  implementation is file-backed and exposed only by the legacy
  `/dev/documents` surface, so it is evidence—not Omega persistence, Product
  authorization or compatibility authority.

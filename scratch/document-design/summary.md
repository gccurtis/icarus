# Document Capability — Design

## Summary

Document is a **regular capability** (`3-capabilities/document/`) that owns
editable, long-form, content-first resources. Its canonical state is a globally
styled content flow: one page-layout definition, one reusable style registry,
and an ordered array of Rows. Each Row contains one or more Blocks whose
positive width units determine their relative horizontal share.

Document has no persisted rendered pages, page coordinates, browser selection
paths, or pixel geometry. Exact pagination is intentionally deferred. The
canonical page size, orientation, and margins are retained now so a future
pagination projection can be added without changing the authored model.

### Key design principle: style overlay

Text is rendered from four layers:

1. Rich Text runtime defaults.
2. The Document Style registered as the base for the Block kind.
3. The reusable Document Style selected by the Block.
4. Inline Rich Text marks stored in the Block's `RichContent`.

The Block-kind base style and selected style resolve into one authoritative
Block overlay. The selected style overlays the kind base. Inline marks are
supplementary: they add properties not fixed by the resolved Block style and
provide range-specific treatments such as bold, italic, links, foreground
color, and background color. A Document Style is a reusable bundle of text
properties and whole-Block presentation properties; it is not hard-coded to a
heading kind.

Every text-bearing Block has a `styleId`. A default registry may ship with
styles named `Normal`, `Heading 1`, `Heading 2`, `Quote`, or `Code`, but all
visual recipes remain editable. Only the semantic roles behind Heading 1–6 are
protected: those six Styles cannot be deleted or reassigned. A Text Block
becomes a heading by selecting one of them; there is no fixed
`TextBlockSubKind` union. The outline level comes from the protected heading
role, not from the Style's display name or a free-form outline property.

Applying a reusable style to only part of a text range materializes one Rich
Text `style` mark containing the selected style's text properties. The Block's
`styleId` remains a live reference, so updating a Document Style changes every
Block that selects it. Materialized inline marks remain exact historical text
formatting and do not change when the source preset is later edited.

Rich Text already has references for navigation through `LinkMark`, but a Link
Mark is not a generic reference mechanism: it stores link targets, not a
Document `styleId`. Its current `StyleMark` stores concrete text properties.
Consequently, range application is a copied style preset in representation
version 1. Live-linked range Styles would require a deliberate Rich Text mark
extension and are not assumed here.

```text
DocumentSnapshot
  ├─ title, lifecycle, and revision
  ├─ one global pageLayout (width, height, margins, page numbering)
  ├─ one reusable StyleRegistry
  ├─ ordered DocumentRow[]
  │    ├─ ordered typed DocumentBlock[] (left-to-right)
  │    └─ RowLayout tracks (width proportions for each Block)
  └─ each Block carries RichContent, a DerivedOutputRef, or a typed payload
```

### What it is not

Document does **not** own:

- **Rich Content** — the Rich Text platform (`0-platform/rich-text/`) owns
  atoms, marks, positions, ranges, normalization, and inline operations.
  Document embeds `RichContent` in Blocks and wraps Rich Text operation batches
  in Document ChangeSets.
- **Derived Outputs** — the Derived Outputs capability
  (`3-capabilities/derived-outputs/`) owns prompt definitions, stabilization
  text, Context scope, grounding, immutable output revisions, freshness, and
  refresh. Document receives its runtime object and stores only exact
  `DerivedOutputRef` values in Prompt Blocks.
- **Formula semantics** — the Formula platform parses and evaluates formulas.
  Rich Text owns Formula atoms and Formula-atom operations. Document schedules
  evaluation and records the accepted Rich Text operation in Document history.
- **Activity feeds** — a future Activity capability owns feed projection and
  presentation. Document emits an accepted domain fact only after a mutation
  commits.

### Prerequisites

| Prerequisite | Document dependency |
|---|---|
| Platform — Rich Text | Supplies `RichContent`, atoms, marks, formula atoms, positions, ranges, operations, validation, style overlay, and formula-delimiter conversion. |
| Platform — Formula plus the existing resolver adapter | Evaluates Formula atoms against one immutable project resolver snapshot. |
| Capability — Derived Outputs | Supplies the injected runtime used to read revisions, update definitions and stabilization text, refresh output, and return exact references. |
| Runtime config, injected Internal Jobs runtime, Job registry, dual queues, Logger | Constructs the project-scoped store, dispatches typed continuation intents, registers their Jobs, and records structured outcomes. |

---

## Where it fits

```text
User opens a Document
  → Frontend loads the exact Row/Block snapshot
  → Text Blocks render from Block style + inline Rich Text marks
  → User edits text through RichTextOperations wrapped in DocumentOperations
  → Document reducer applies the operation batch and appends one ChangeSet

User types {{ revenue / units }}
  → Rich Text converts the delimited source into an atomic FormulaAtom
  → Document records that Rich Text operation in its ChangeSet
  → Document schedules Formula evaluation using the project resolver snapshot
  → Serial settlement applies a Rich Text formula-result operation if unchanged

User inserts a Prompt Block
  → Document declares a new dedicated Derived Output for that Block
  → Document stores only DerivedOutputRef(outputId, appliedRevision)
  → Prompt and stabilization text remain owned by Derived Outputs
  → Refresh may publish a new output revision
  → Document conditionally adopts that exact revision through a ChangeSet
```

### Prompt Block and Derived Outputs runtime

Document receives a narrow public Derived Outputs port during construction:

```ts
interface DocumentDerivedOutputs {
  declare(
    request: DeclareDerivedOutputRequest,
    options: { idempotencyKey: string },
  ): Promise<DerivedOutput>;
  get(id: string): Promise<DerivedOutput | null>;
  getRevision(id: string, revision: number): Promise<DerivedOutputRevision | null>;
  updateDefinition(
    id: string,
    request: UpdateDefinitionRequest,
    options: { idempotencyKey: string },
  ): Promise<DerivedOutput>;
  refresh(
    id: string,
    options: { idempotencyKey: string },
  ): Promise<DerivedRefreshResult>;
  delete(id: string): Promise<void>;
}
```

The Document application layer locates a Prompt Block and delegates definition
or stabilization-text edits to this runtime object. Those calls mutate Derived
Outputs state, not Document state. Document changes only when its exact
`DerivedOutputRef` changes.

Before a definition update crosses the database boundary, Document durably
claims `(documentId, requestId)` and freezes the Prompt Block's `outputId`.
Derived Outputs then executes under its own key derived from that command
identity. Exact retries therefore reuse the frozen target even if the Block is
later moved, replaced, or deleted; completion stores the local command receipt
atomically with the claim transition.

Every Prompt Block owns a different Derived Output. Inserting a Prompt Block is
therefore an application command rather than a generic `block.insert` carrying
an arbitrary existing reference. The command uses a durable attempt: declare
and refresh a dedicated output through Derived Outputs, then serially insert the
Block with its returned exact revision. The two databases do not pretend to
share an atomic transaction; stage receipts make the workflow resumable.

The Derived Outputs runtime provides keyed declaration, refresh, and definition
updates. Each operation durably replays its exact historical result for an
identical key and rejects divergent key reuse. Document derives those keys from
its durable attempts or command receipts, making the separate databases safe
to resume after a crash.

Deleting a Prompt Block detaches rather than immediately destroys the output,
because retained Document history may still reference it. Garbage collection
is allowed only after retained Bases and ChangeSets can no longer reach any of
its revisions. Representation version 1 defers duplication. The
[Templates and Context Variables addendum](templates-and-context-variables.md)
defines the version 2 copy workflow and the required Derived Outputs clone
contract; copied Prompt Blocks always receive new dedicated outputs.

### Formula delimiter handling

The `{{ ... }}` delimiter is an authoring convenience owned by Rich Text. Rich
Text converts the delimited range into a Formula atom through a Rich Text
operation or helper. Document neither parses the formula source nor directly
edits Formula atom fields. It persists the resulting `rich-text.apply`
operation and orchestrates evaluation through Formula.

Rich Text exposes `formulaFromDelimitedRange`, which returns the ordinary
atomic `replace-range-with-atom` operation used by Document history. Document
therefore never owns delimiter parsing.

---

## Where it lives

```text
apps/backend/src/
  3-capabilities/
    document/
      domain/
        model.ts           # snapshot, rows, blocks, styles, operations
        errors.ts          # typed domain/application errors
        reducer.ts         # pure operation reduction and touched IDs
        inverses.ts        # exact inverse generation
        validation.ts      # structure, styles, dimensions, and limits
        canonical.ts       # deterministic encoding and semantic digests
        rebase.ts          # conservative touched-ID rebase
        tree.ts            # recursive Row/Block traversal
      application/
        documentService.ts # command/query runtime, admission, async stages
        createService.ts   # blank creation
      ports/
        documentStore.ts   # project-scoped Document store interface
        derivedOutputs.ts  # narrow Derived Outputs runtime port
        formulaResolver.ts # immutable resolver-snapshot port
      persistence/
        sqliteDocumentStore.ts
        sqliteMappers.ts
        sqliteSchema.ts
      wire/
        commandSchemas.ts
        operationSchemas.ts
        querySchemas.ts
        valueSchemas.ts
      projections/
        dependencies.ts
        outline.ts
        plainText.ts
        styling.ts
      index.ts

  1-init/create/
    document.ts

  0-utils/jobs/
    internalRuntime.ts

  4-job-wiring/document/
    registerDocumentEndpoints.ts
    createDocumentJobs.ts
    registerDocumentInternalJobs.ts
    documentJobPayloads.ts
```

For the current repository, Document uses its own SQLite database file and
project-hashed table prefix, matching Structured Data and Context. A future
shared Database platform migration can consolidate physical files without
changing the Document domain or store port.

---

## Design decisions

1. `DocumentSnapshot` owns one `pageLayout`, one reusable style registry, and
   `rows: DocumentRow[]` in canonical vertical order.
2. Every Row contains at least one Block. Deleting or moving the last Block out
   of a Row deletes the empty Row atomically.
3. Rows are the horizontal layout primitive. Their tracks assign sibling
   Blocks positive relative widths. Most Rows contain one full-width Block.
4. Blocks are a closed discriminated union. Text Blocks have no fixed subkind;
   their selected `styleId` supplies their reusable presentation.
5. Image and Chart Blocks carry explicit intrinsic/render dimensions inside
   their typed payloads. A generic Embed Block is deferred until concrete,
   provider-specific embed kinds are designed.
6. Insertion and movement use stable IDs and explicit placement rules. Array
   indexes are transient projections and never appear in external references.
7. Revision history is Base + append-only ChangeSets. Every accepted mutation
   stores canonical forward and inverse operations and a semantic digest.
8. A durable identity ledger prevents deleted IDs from being reused. Exact
   compensation may reactivate only the same logical identity kind.
9. Every Prompt Block has one dedicated Derived Output and holds only its exact
   `DerivedOutputRef`. Prompt and stabilization text are mutated through the
   injected Derived Outputs runtime.
10. Formula atoms and their mutations belong to Rich Text. Document owns the
   durable evaluation attempt and the conditional ChangeSet settlement.
11. Exact pagination is deferred. Page layout is canonical now; future page
    breaks and pagination remain additive operations and projections.
12. Activity describes accepted domain facts, not raw endpoint traffic.
    Rejected commands and identical idempotent retries produce no new fact.
    Initial Document writes a transactional outbox; future wiring publishes it
    one-way to Activity and routes Activity undo through a generic owner-based
    compensation router, so neither capability constructs the other.

---

## Files to read next

Read [canonical model](canonical-model.md) for the full type definitions.
Read [operations](operations.md) for placement, styles, commands, endpoints,
and internal Jobs. Read [store](store.md) for SQLite persistence and
history retention. Read [file architecture](file-architecture.md) for module
responsibilities. Read [pagination](pagination.md) for the deliberately narrow
layout boundary retained in the initial implementation. Read
[Templates and Context Variables](templates-and-context-variables.md) for the
representation version 2 template-copy and Prompt-context extension.

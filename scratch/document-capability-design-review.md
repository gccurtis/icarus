# Document capability design review

Status: discussion draft  
Reviewed source: [`docs/capabilities/document.md`](../docs/capabilities/document.md)  
Review scope: domain and backend contract only; no implementation changes

## Verdict

The design has the right architectural center:

- Document owns its semantic state and SQL.
- Rendered pages and browser editor nodes are projections.
- Stable IDs and typed operations are the mutation boundary.
- Base + append-only ChangeSets is consistent with the other native Resources.
- Generated content settles through frozen preconditions instead of overwriting user edits.
- Capability, job-wiring, transport, and provider responsibilities are separated cleanly.

It is not implementation-ready yet. The remaining problems are concentrated in five
contracts that will be expensive to change after an editor exists:

1. the content tree is not a closed, validatable schema;
2. text positions and their transformation rules are underspecified;
3. stale submission, undo/redo, compaction, and historical-read semantics are ambiguous;
4. binding content is duplicated between the block and `lastGoodDisplay`, and operational
   refresh state is mixed into canonical document state;
5. sections, headers/footers, and deterministic layout inputs are not represented strongly
   enough for the stated print and DOCX goals.

My recommendation is one more design revision before implementation. Keep the architecture,
but narrow v1 where necessary: exact revision CAS, block-level comment anchors, explicit
document sections, a closed block union, and asynchronous refresh attempts outside the
Document Base.

## What should remain

### Semantic state is canonical

The decision that pages and pixels are projections is correct. Persisting pagination as
content would make font, renderer, and export changes mutate the document. The semantic
model should remain authoritative.

### Stable identity is the addressing model

Rows/containers, blocks, inline nodes, list items, table rows/columns/cells, styles, and
bindings should retain IDs across moves. Visible ordinals and editor paths should remain
revision-specific projections.

### One operation vocabulary for people and agents

Agent proposals should use exactly the same validated operations as direct edits. This
gives review, audit, undo, and authorization one boundary.

### Document owns accepted bound content

Upstream capabilities own their source values; Document should own the exact content it
accepted and displays. A source changing should not mutate a Document until a Document
ChangeSet accepts a refresh result.

### Async work is staged

The accept → compute → settle flow is sound. It fits the runtime's one-queue-per-job rule
and prevents a concurrent model call from writing directly into canonical state.

## Blocking design issues

### 1. Replace the open block shape with a closed union

The current `DocumentBlock` has a `kind`, a generic `data`, `atoms`, `marks`, and an
optional binding on every block. That permits meaningless or contradictory states:

- a divider with text atoms;
- an image with paragraph marks;
- a table without defined rows, columns, or cells;
- a heading whose level is absent or stored in untyped `data`;
- a list with no list-item identity or nesting model;
- a code block with marks that may not be valid for code;
- a block kind that disagrees with `DocumentBlockData`.

Lists and tables are not edge cases. They determine copy/paste, split/join, import/export,
anchors, undo, accessibility, and traversal. Their child types must be canonical before
operations can be specified.

Use a discriminated union whose payload is valid by construction. A representative shape:

```ts
interface BlockCommon {
  id: string;
  rank: string;
  styleId: string;
  provenance: ProvenanceLink[];
  binding?: ContentBinding;
}

type DocumentBlock =
  | (BlockCommon & {
      kind: "paragraph" | "quote" | "code";
      inline: InlineContent;
    })
  | (BlockCommon & {
      kind: "heading";
      level: 1 | 2 | 3 | 4 | 5 | 6;
      inline: InlineContent;
    })
  | (BlockCommon & {
      kind: "callout";
      tone: CalloutTone;
      icon?: MediaSnapshotRef;
      content: BlockContainer;
    })
  | (BlockCommon & {
      kind: "list";
      listKind: "bulleted" | "numbered" | "checklist";
      start?: number;
      items: ListItem[];
    })
  | (BlockCommon & { kind: "table"; table: DocumentTable })
  | (BlockCommon & { kind: "image"; image: ImageBlockData })
  | (BlockCommon & { kind: "chart"; chart: ChartBlockData })
  | (BlockCommon & { kind: "metric"; metric: MetricBlockData })
  | (BlockCommon & { kind: "embed"; embed: SafeEmbedData })
  | (BlockCommon & { kind: "divider" });

interface ListItem {
  id: string;
  rank: string;
  checked?: boolean;
  content: BlockContainer;
  children: ListItem[];
}

interface DocumentTable {
  columns: TableColumn[];
  rows: TableRow[];
  cells: TableCell[];
  merges: TableMerge[];
}

interface TableCell {
  id: string;
  rowId: string;
  columnId: string;
  content: BlockContainer;
}
```

The actual vocabulary can be smaller, but every admitted state needs a typed representation.
Recursive containers should have a maximum depth, and tables/callouts/list items should
state which block kinds they admit.

`prompt` should probably not be a visual block kind. Prompting is a way to produce or bind
content; the visible target should still be a paragraph, table, chart, metric, or another
ordinary block. If the product needs a visible prompt widget, name and type it as such.

### 2. Decide whether `Row` is semantic or only a layout group

Making every body item live inside a horizontal Row adds an extra identity and operation
level to ordinary paragraph editing. Splitting one paragraph may implicitly create a Row;
joining paragraphs may delete one. Lists and tables then sit inside Rows even though they
already own layout.

The recommended primitive is a linear block flow. Side-by-side composition should be an
explicit layout container:

```ts
type FlowNode =
  | { kind: "block"; block: DocumentBlock }
  | {
      kind: "layout-group";
      id: string;
      rank: string;
      tracks: LayoutTrack[];
      columns: BlockContainer[];
    };
```

If the product's editor is fundamentally row-based, retain `DocumentRow`, but define these
rules before building:

- whether a normal row contains exactly one block;
- whether a list/table can share a row with another block;
- what split/join does to row IDs and layout;
- whether blocks can move between headers, footers, body sections, cells, and callouts;
- whether row track rank/width normalization is a user-visible ChangeSet.

### 3. Add explicit document sections

One global header, footer, and `PrintSettings` cannot represent common word-processing
documents with:

- different page orientation or size later in the document;
- section-specific margins or columns;
- first-page or odd/even headers and footers;
- different page numbering or restart rules.

This matters because the design claims editable DOCX structure and high-fidelity print
projection. A better root is:

```ts
interface DocumentBase {
  representationVersion: "document/v1";
  styles: StyleRegistry;
  sections: DocumentSection[];
}

interface DocumentSection {
  id: string;
  rank: string;
  pageSetup: PageSetup;
  headerFooter: HeaderFooterSet;
  body: BlockContainer;
}
```

If section fidelity is intentionally out of v1, say so and require DOCX import to emit a
fidelity diagnostic when it flattens sections. Do not imply that the global model can
round-trip them.

### 4. Replace UTF-8 byte offsets with an editor-compatible position contract

The backend and frontend are TypeScript, while browser/editor text APIs generally expose
UTF-16 code-unit offsets. Requiring UTF-8 byte offsets creates conversion on every command
and selection. “Rune boundary” also does not protect a grapheme cluster such as an emoji
sequence or a base character plus combining mark.

Choose one wire convention and specify it completely. For this stack, UTF-16 offsets are
the pragmatic choice, validated so an endpoint cannot split a surrogate pair. If Unicode
scalar offsets are preferred, conversion must be explicit at the client boundary.

A position also needs affinity:

```ts
interface TextPosition {
  inlineId: string;
  offset: number;
  affinity: "before" | "after";
}

interface TextRange {
  start: TextPosition;
  end: TextPosition; // half-open
}
```

The design must define:

- the length and valid endpoints of formula/reference inline nodes;
- whether a mark can span a non-text inline node;
- how insertion at a mark boundary inherits marks;
- how deletion clips or removes marks;
- how split/join maps positions and anchors;
- whether adjacent equivalent marks are normalized;
- whether duplicate or zero-length marks are rejected;
- whether links may overlap other links;
- Unicode normalization policy, if any.

Without these rules, deterministic replay is not actually defined.

### 5. Narrow stale-write behavior in v1

“Accept stale operations when semantic footprints prove safe rebase” is a large feature,
especially for text offsets, split/join, table merges, style deletion, and subtree moves.
The document does not yet define footprints or a conflict matrix.

For v1:

- require `expectedRevision === currentRevision`;
- return a typed conflict containing the current revision and optionally the intervening
  ChangeSet summaries;
- let the client re-read, transform, and resubmit;
- record footprints for diagnostics and future work, but do not use them to admit stale
  writes.

Later semantic rebase should be enabled operation family by operation family only after
property tests prove:

```plain text
apply(B, A then transform(B-op over A))
  ==
apply(B, B-op then transform(A over B-op))
```

where the operations are declared disjoint. Structural disjointness is easier to support
first; text edits in the same inline node should remain exact-CAS until there is a formal
OT or CRDT decision.

### 6. Specify undo and redo eligibility

Stored inverse operations are guaranteed to apply to the state immediately after their
original ChangeSet. They are not automatically valid after later edits. Examples:

- undoing block insertion after someone edited that block;
- undoing table row deletion after the surrounding table changed;
- undoing text deletion after the target inline node was split;
- redoing an edit after a new non-redo edit.

The request should name the target ChangeSet and current expected revision. Settlement
should either:

- build and validate a current-head compensation and append it; or
- return `undo_conflict` without changing state.

Also decide whether undo is document-global or actor-local, and when a redo chain is
invalidated. “Append compensation” is the correct storage rule, but it is not by itself
an undo policy.

### 7. Make compaction and historical reads one coherent contract

The mutable `documents.base_json` stores one Base, while the text also promises revision
history and exact snapshots. Once the Base advances, loading a revision before `baseSeq`
requires reverse replay, an older checkpoint, or a declaration that old revisions are no
longer loadable. None is currently specified.

Choose one explicit guarantee:

1. **Current-head only:** history is audit metadata; arbitrary old snapshots are not
   promised. Exports and Sources persist their own immutable snapshot packages.
2. **Retained time travel:** write immutable checkpoints and replay from the nearest
   checkpoint at or before the requested revision.

If retained time travel is desired, add `document_checkpoints` with representation version,
through-revision/sequence, canonical digest, and immutable Base. Compaction creates a new
checkpoint and atomically advances a head pointer; it does not destroy the only older Base.

In either model, define:

- whether `seq === revision` and, if not, how they map;
- the Base's `throughRevision`, not only `baseSeq`;
- canonical JSON serialization used for digests and “byte-equivalent” replay;
- compaction CAS and crash recovery;
- ChangeSet/checkpoint retention;
- whether title and lifecycle are part of replayable state or only a current-head
  projection in `documents`.

### 8. Separate accepted content from refresh attempt state

The current block contains visible `data/atoms`, while its binding also contains
`lastGoodDisplay`. It is unclear which one renders and what an accepted refresh updates.
The binding also carries `refreshing`, `failed`, and `generationToken`, even though refresh
requests already have their own durable table.

Use these authorities:

- **Document Base:** source definition, update policy, accepted source manifest/digest,
  accepted visible content, accepted provenance, and target content revision.
- **Refresh attempt:** queued/running/failed/stale/proposed/settled state, frozen inputs,
  generation token, diagnostics, and durable result.
- **Derived projection:** whether the accepted binding is currently stale relative to
  observed upstream heads.

For example:

```ts
interface ContentBinding {
  id: string;
  source: ContentSourceRef;
  updatePolicy: "pinned" | "manual-refresh" | "auto-refresh";
  acceptedSource?: SourceManifest;
}

interface BoundTargetState<T> {
  contentRevision: number;
  acceptedContent: T;
  provenance: ProvenanceLink[];
  binding?: ContentBinding;
}

interface RefreshAttempt {
  id: string;
  target: StableDocumentTarget;
  frozenTargetRevision: number;
  frozenSource: SourceManifest;
  generationToken: string;
  state: "queued" | "running" | "failed" | "stale" | "proposed" | "settled";
  result?: ProposedDocumentOperations;
  diagnostic?: ContentDiagnostic;
  settledChangeSetId?: string;
}
```

`lastGoodDisplay` becomes unnecessary if accepted visible content remains untouched on
failure. Detaching a binding should remove future refresh behavior while preserving both
accepted content and its provenance.

An accepted source should be a manifest, not a single version string: a Knowledge query or
analysis result can depend on several exact sources, models, contexts, and parameters.

Auto-refreshing cross-Resource bindings also need a cycle rule. The safe v1 choice is to
disallow auto-refresh for `resource-target`, or reject dependency cycles at binding
creation.

## Important contract gaps

### Creation idempotency

`documents.create.v1` is idempotent before a Document ID exists, but
`document_change_sets` only deduplicates submissions within an existing Document. Add a
scoped creation receipt keyed by `(userId, projectId, clientRequestId)` plus request digest.
The same applies to duplicate/materialize commands that create a new identity.

### Refresh durability

The refresh table has no durable successful result, exact multi-source manifest,
settled ChangeSet link, or per-stage receipt. Add either refresh-attempt and stage tables or
equivalent columns for:

- source manifest JSON and digest;
- frozen target digest/revision;
- result operation JSON and digest;
- provider/model provenance and diagnostics;
- stage keys and request digests;
- settled ChangeSet ID;
- cancellation and terminal timestamps.

The dispatcher can only recover work after restart if the committed next stage is
discoverable from durable state.

### Revision-pinned reads

`load`, `render`, export projection, and native Source snapshot need an explicit revision
input or an atomic “resolve head and read that revision” rule. A query running concurrently
with a serial mutation must return one internally consistent revision.

Do not make the frontend consume a persistence-shaped “Base plus tail” unless offline
replay is an intentional public feature. A normal load response should be a validated
semantic snapshot plus `revision`; an optional sync endpoint can expose operation tails.

### Anchor contract

Stable IDs preserve a block anchor through a move, but not a text selection through
splice, split, join, or deletion. `validate-anchor` therefore needs a typed
`DocumentAnchor`, not only Collaboration's opaque `componentId/subpath/selectionHash`.

For v1, support block anchors only. If text-range comments are required in v1, define
stable endpoint positions, affinity, a selected-text hash/fallback quote, tombstone
behavior, and deterministic transformation through every text operation.

### Rendering determinism

Pagination depends on more than page size and a “layout policy.” Cache keys and render
receipts should include:

- renderer and layout-engine version;
- font manifest and exact font metrics;
- locale, line-breaking, and hyphenation policy;
- resolved media snapshot dimensions/digests;
- dependency manifest;
- render options.

“Exact” should mean exact for a pinned input manifest. Cross-platform pixel identity should
not be promised unless the renderer and fonts run in a controlled worker image.

### Resource bounds

`base_json` is described as bounded but no bounds are stated. Define limits for document
bytes, node count, nesting depth, table dimensions, inline text length, operations per
submission, ChangeSet bytes, render pages, and refresh result bytes. Reject over-limit
submissions atomically with typed diagnostics.

### Rank semantics

Arrays and `rank` both encode order. Specify `(rank, id)` as the total order, rank ownership,
neighbor-addressed insertion, duplicate handling, maximum rank length, and rebalancing.
Rank rebalancing must either be a logical operation or be excluded from canonical snapshot
equality.

### Provenance contract

`ProvenanceLink` is referenced by Document, Slides, and Spreadsheet but is not defined in
the capability references. Decide whether it is a small shared wire value or a
Document-owned value translated at each port. At minimum it needs exact source kind, ID,
version/digest, stable locator or citation, admission method, and timestamp. It must not
depend on expiring URLs or rebuildable indexes.

### Repository placement

The proposed path is `3-capabilities/document`, while the current repository and the
Structured Data/Spreadsheet references use `3-capabilities/built-in`. Choose one convention
before scaffolding so public aliases, imports, tests, and migrations do not begin with a
one-off layout.

### Accessibility and safe embeds

Typed payloads should require:

- heading levels;
- image alt text or explicit decorative state;
- table header semantics;
- link URL policy;
- immutable/sanitized embed references rather than arbitrary HTML;
- code language as metadata, not inferred presentation.

## Recommended v1 aggregate

This is a direction, not a final schema:

```plain text
Document head projection
  ├─ identity, title, lifecycle, revision
  └─ Base/checkpoint through revision N
       ├─ style registry
       └─ ordered Sections
            ├─ page setup
            ├─ header/footer variants
            └─ linear Block flow
                 ├─ rich-text blocks → inline nodes + marks
                 ├─ list block → stable recursive items
                 ├─ table block → stable rows/columns/cells
                 ├─ typed leaf blocks
                 └─ optional explicit layout groups
```

Each content-bearing target stores accepted visible content and provenance. An optional
binding says how a future replacement may be computed. Refresh attempts and render jobs
live outside the Base and can settle only by appending ordinary typed operations.

## Recommended v1 mutation rules

1. Creation produces revision `0`, including template materialization. This matches
   Document's SQL defaults and the Structured Data/Spreadsheet capability contracts.
2. Every accepted submission increments revision by exactly one and appends exactly one
   ChangeSet.
3. `seq` equals `revision` in v1 unless there is a demonstrated need for two counters.
4. All user operations require exact revision CAS.
5. The reducer is pure: clone/load state, apply ordered operations, normalize, validate the
   full result, generate inverses, then commit atomically.
6. Failed submissions append nothing.
7. Undo/redo name a ChangeSet, require current revision CAS, and may fail with an explicit
   conflict.
8. Async settlement submits ordinary operations with a frozen target content revision or
   target digest; unrelated Document edits need not invalidate it if target-level
   eligibility is proven.
9. Operational refresh/render state never changes the Document revision.
10. Compaction never changes logical revision or semantic digest.

The Templates reference currently says materialization returns Document revision `1`;
that should be reconciled with the revision-zero convention before either capability is
built.

## Suggested implementation gates

### Gate 1: domain closure

- closed block union;
- list/table/section/container schemas;
- position and mark laws;
- full-document validator;
- canonical serialization and digest.

### Gate 2: deterministic editor core

- typed operations and reducer;
- exact CAS and creation receipts;
- ChangeSet/inverse generation;
- replay, compensation, and compaction tests;
- block-level anchors.

### Gate 3: persistence and reads

- schema plus constraints;
- atomic load/submit;
- semantic snapshot responses;
- explicit historical-read policy;
- resource limits and windowing thresholds.

### Gate 4: bindings

- accepted content/provenance model;
- durable refresh attempts and stage recovery;
- proposal settlement;
- dependency-cycle policy.

### Gate 5: render/import/export

- versioned render manifest;
- section/header/footer behavior;
- DOCX fidelity diagnostics;
- deterministic PDF worker inputs.

## Questions to resolve together

1. Is side-by-side block composition a first-class product behavior? If yes, Rows/layout
   groups stay; if not, a linear block flow is substantially simpler.
2. Must v1 round-trip multi-section DOCX documents, or is section flattening with
   diagnostics acceptable?
3. Must v1 support text-range comments, or can comments initially target whole blocks?
4. Is concurrent co-editing in scope? If not, exact CAS is enough for v1.
5. Must users load arbitrary historical revisions, or only view history and undo while
   retained?
6. Should generated content replace an entire block, a selected range, or both?
7. Are cross-Resource bindings live transclusions or accepted snapshots with an explicit
   refresh action?

These answers determine the minimum schema. The first five should be settled before coding
the aggregate; the last two can be settled before the binding phase.

## Bottom-line recommendation

Proceed with the capability after revising the reference around the five blocking
contracts. Do not discard the current document: its ownership, runtime layering, typed
commands, stable IDs, and async settlement model are the correct foundation. The highest
leverage edit is to make the aggregate a closed tree and deliberately reduce v1
concurrency/history promises to behavior that can be proven by the reducer and schema.

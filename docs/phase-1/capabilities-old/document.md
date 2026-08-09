# Document

## Summary / Concept

<aside>
🧭

**Build position:** Resources 2 of 4. Document follows Knowledge and the Foundation services. It establishes the native rich-content and revision patterns reused by Slides.

</aside>

### Prerequisites

| Prerequisite | Document dependency |
| --- | --- |
| Runtime configuration, database, Job registry, dual queues, and Logger | Constructs the configuration-scoped store, registers jobs, and records structured outcomes. |
| Platform — Icarus Rich Text Runtime Model | Supplies canonical Rich Content, atoms, marks, links, ranges, codecs, validation, and pure text operations. |
| Platform Formula and Data resolution | Evaluates Formula atoms against immutable Data resolver snapshots. |
| Addendum — Icarus Knowledge Derived Output Runtime Model | Owns Prompt definitions, retrieved grounding, generated content, output revisions, freshness, and refresh. |
| Comments | Stores threads against Document or exact Rich Text range anchors supplied and transformed by Document. |

### Concept

Document is the authoritative backend capability for editable long-form Resources. It owns Document identity, Rows, Blocks, placement, semantic styles, Formula atoms and accepted Formula displays, Derived Output references, revision history, exact historical reads, and source-snapshot projections. Knowledge owns the definitions, grounding, content revisions, and refresh lifecycle of Prompt-derived content.

The canonical Document is one globally styled content flow. It has one page-layout definition and one ordered array of Rows. Each Row contains one or more Blocks whose positive width units determine their relative horizontal share. Pagination, browser editor nodes, rendered pixels, search text, outlines, and dependency lookups are projections of that state.

```
DocumentSnapshot
  ├─ title, lifecycle, and revision
  ├─ one global pageLayout
  ├─ semantic StyleRegistry
  └─ ordered DocumentRow[]
       └─ ordered typed DocumentBlock[] + relative Row tracks
            ├─ rich text, lists, and tables
            ├─ media, charts, embeds, and references
            ├─ Prompt Blocks pointing to exact Knowledge Derived Output revisions
            └─ Formula atoms + accepted evaluations
```

## Types & Interfaces

### Canonical aggregate

```tsx
interface DocumentHead {
  id: string;
  title: string;
  lifecycle: "active" | "archived" | "trashed";
  revision: number;
  baseSeq: number;
  semanticDigest: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: "active" | "archived" | "trashed";
  pageLayout: DocumentPageLayout;
  styles: StyleRegistry;
  rows: DocumentRow[];
}

interface DocumentPageLayout {
  page: {
    widthTwips: number;
    heightTwips: number;
    orientation: "portrait" | "landscape";
  };
  margins: {
    topTwips: number;
    rightTwips: number;
    bottomTwips: number;
    leftTwips: number;
  };
  pageNumber: {
    start: number;
    format: "decimal" | "roman-lower" | "roman-upper";
  };
}

interface DocumentRow {
  id: string;
  blocks: DocumentBlock[];
  layout: RowLayout;
}

interface RowLayout {
  tracks: RowTrack[];
}

interface RowTrack {
  blockId: string;
  widthUnits: number;
}
```

The `rows` array is top-to-bottom order. A Row's `blocks` array is left-to-right order. Each Row has one track for every sibling Block, in the same order, and every `widthUnits` value is positive. The Block's horizontal share is its width units divided by the sum of its sibling tracks. Most Rows contain one Block with one width unit.

Insertion and movement address stable neighboring IDs. Absence of an `afterRowId` or `afterBlockId` prepends. Array indexes are transient projections and are never stored in external references. Page width minus margins determines available Row width. Block presentation controls alignment, wrapping, and flow behavior inside that width.

### Closed Block model

```tsx
type RichContent = import("#platform/rich-text").RichContent;
type ReferenceAttachment = import("#platform/rich-text").ReferenceAttachment;
type DerivedOutputRef = import("#platform/knowledge/derived-output").DerivedOutputRef;

interface BlockBase {
  id: string;
  styleId: string;
  presentation?: BlockPresentationOverride;
  references: ReferenceAttachment[];
}

type DocumentBlock =
  | (BlockBase & { kind: "rich-text"; content: RichContent })
  | (BlockBase & {
      kind: "heading";
      level: 1 | 2 | 3 | 4 | 5 | 6;
      content: RichContent;
    })
  | (BlockBase & { kind: "quote"; content: RichContent })
  | (BlockBase & { kind: "code"; language?: string; content: RichContent })
  | (BlockBase & { kind: "prompt"; output: DerivedOutputRef })
  | (BlockBase & { kind: "callout"; tone: CalloutTone; rows: DocumentRow[] })
  | (BlockBase & { kind: "list"; list: DocumentList })
  | (BlockBase & { kind: "table"; table: DocumentTable })
  | (BlockBase & { kind: "image"; image: ImageBlockData })
  | (BlockBase & { kind: "chart"; chart: ChartBlockData })
  | (BlockBase & { kind: "embed"; embed: SafeEmbedData })
  | (BlockBase & { kind: "divider" });

type CalloutTone = "info" | "success" | "warning" | "danger" | "neutral";
```

Each admitted Block is valid by its discriminant and payload. Callouts are the Block that nests general Rows, and their descendants cannot contain another callout. Prompt Blocks are placement nodes: their visible content resolves from `outputId@appliedRevision`; the prompt, retrieval, grounding, and output content live in Knowledge.

#### Lists

```tsx
interface DocumentList {
  id: string;
  kind: "bulleted" | "numbered" | "checklist";
  start?: number;
  items: ListItem[];
}

interface ListItem {
  id: string;
  checked?: boolean;
  rows: DocumentRow[];
  children: ListItem[];
}
```

`start` is valid for numbered lists. `checked` is valid for checklist items. Item identity survives reorder and nesting changes. Item body Rows carry Rich Content.

#### Tables

```tsx
interface DocumentTable {
  id: string;
  columns: TableColumn[];
  rows: TableRow[];
  cells: TableCell[];
  merges: TableMerge[];
}

interface TableColumn {
  id: string;
  width?: { kind: "auto" } | { kind: "fixed"; twips: number };
}

interface TableRow {
  id: string;
  minHeightTwips?: number;
  header: boolean;
}

interface TableCell {
  id: string;
  rowId: string;
  columnId: string;
  rows: DocumentRow[];
  verticalAlign: "top" | "middle" | "bottom";
}

interface TableMerge {
  id: string;
  rootCellId: string;
  coveredCellIds: string[];
}
```

Every row-and-column pair has exactly one Cell. A merge describes one rectangular root-and-covered set. Nested tables are bounded by configured depth.

#### Media, charts, embeds, and references

```tsx
interface MediaSnapshotRef {
  fileId: string;
  version: string;
  digest: string;
  mimeType: string;
}

interface ImageBlockData {
  source: MediaSnapshotRef;
  alt: string;
  decorative: boolean;
  crop?: { left: number; top: number; right: number; bottom: number };
  fit: "contain" | "cover" | "stretch";
}

interface ChartBlockData {
  source: "literal" | "formula" | "analysis-result" | "structured-data";
  specification: Record<string, unknown>;
  snapshotDigest?: string;
}

interface SafeEmbedData {
  provider: "resource" | "video" | "iframe";
  source: string;
  title: string;
  sandbox: "strict" | "media";
}
```

Images require alt text unless explicitly decorative. Embeds are allowlisted descriptors. Explicit `ReferenceAttachment[]` entries connect a Block to resources, Evidence, Questions, Data, or URLs without creating a refresh dependency.

### Rich text and editor positions

Document imports the complete content contract from Platform — Icarus Rich Text Runtime Model.

```tsx
type RichContent = import("#platform/rich-text").RichContent;
type RichTextOperation = import("#platform/rich-text").RichTextOperation;
type TextPosition = import("#platform/rich-text").TextPosition;
type TextRange = import("#platform/rich-text").TextRange;

interface DocumentTextRangeAnchor {
  kind: "text-range";
  documentId: string;
  range: TextRange;
  observedRevision: number;
  quote: string;
  quoteDigest: string;
}

interface DocumentAnchor {
  kind: "document";
  documentId: string;
  assignedAtRevision: number;
  reason: "selected-text-deleted" | "selected-text-split";
}

type TextRangeResolution =
  | { kind: "current" | "rebased"; anchor: DocumentTextRangeAnchor }
  | { kind: "document"; anchor: DocumentAnchor };
```

Document wraps Rich Text operations in one Document ChangeSet and transforms comment anchors through the accepted operation batch. Insertion inside or at either boundary of selected text expands the range. Deleting selected text or splitting it across Blocks promotes the thread to a Document anchor. Collaboration stores and renders the returned typed anchor.

### Semantic styles

```tsx
interface StyleRegistry {
  defaults: {
    defaultParagraphStyleId: string;
    defaultCodeStyleId?: string;
  };
  styles: DocumentStyle[];
}

interface DocumentStyle {
  id: string;
  name: string;
  basedOn?: string;
  text?: TextStyleProperties;
  block?: BlockStyleProperties;
}

interface TextStyleProperties {
  font?: {
    family: string;
    sizeHalfPoints: number;
    weight?: number;
    italic?: boolean;
  };
  color?: string;
  background?: string;
}

interface BlockStyleProperties {
  spacing?: { beforeTwips: number; afterTwips: number; line: number };
  indentation?: {
    leftTwips: number;
    rightTwips: number;
    firstLineTwips: number;
  };
  alignment?: "left" | "center" | "right" | "justify";
  wrapping?: "wrap" | "no-wrap" | "break-word";
  keepWithNext?: boolean;
  keepTogether?: boolean;
  pageBreakBefore?: boolean;
}

type BlockPresentationOverride = Partial<BlockStyleProperties>;
```

Style inheritance is acyclic. A referenced Style can be removed only when the same operation supplies a replacement. Block application uses block properties. Selected-text application creates `document-style` Marks and uses text properties. Canonical styles are semantic values independent of frontend class names.

### Prompt Blocks and Derived Outputs

Prompt Blocks are Document-owned placement nodes containing one exact `DerivedOutputRef`.

```tsx
type DerivedOutputRef = import("#platform/knowledge/derived-output").DerivedOutputRef;

interface PromptBlockData {
  output: DerivedOutputRef;
}
```

Knowledge owns the instruction, Context entries, structured inputs, retrieval, grounding, generated Rich Content, dependency manifest, freshness, and immutable output revisions. Document reads `outputId@appliedRevision` and renders the returned Rich Content inside the Block.

Refreshing a Prompt Block calls the Knowledge Derived Output reader. When Knowledge returns a newer head revision, Document appends one `prompt.apply-derived-output` ChangeSet that advances `appliedRevision`. When the head is unchanged, Document state is unchanged.

```
read Prompt Block
  → read outputId@appliedRevision from Knowledge
  → render exact Rich Content revision

refresh Prompt Block
  → Knowledge.refresh(outputId)
  → compare Knowledge head with appliedRevision
  → unchanged: return current state
  → newer: append Document ChangeSet advancing the reference
```

This preserves exact historical snapshots, export determinism, collaboration history, undo, and redo while centralizing derived-content work in Knowledge.

### Formula Atoms and evaluation

```tsx
type FormulaWireValue = import("#formula").FormulaWireValue;
type FormulaObservedDependency = import("#formula").ObservedDependency;

interface FormulaItem {
  languageVersion: 1;
  expression: string;
  state: "pending" | "current" | "stale" | "error";
  evaluation?: FormulaEvaluationSnapshot;
}

interface FormulaEvaluationSnapshot {
  observedDependencies?: FormulaObservedDependency[];
  dependencyDigest?: string;
  value?: FormulaWireValue;
  displayText: string;
  diagnostics: Array<{
    code: string;
    message: string;
    span?: { startByte: number; endByte: number };
  }>;
  evaluationDigest?: string;
  evaluatorVersion?: string;
  evaluatedAt: string;
}

interface FormulaEvaluationAttempt {
  id: string;
  documentId: string;
  blockId: string;
  atomId: string;
  clientRequestId: string;
  requestDigest: string;
  frozenDocumentRevision: number;
  frozenExpressionDigest: string;
  languageVersion: 1;
  state:
    | "requested"
    | "evaluating"
    | "proposed"
    | "settled"
    | "failed"
    | "stale"
    | "canceled";
  evaluation?: FormulaEvaluationSnapshot;
  settledChangeSetId?: string;
}
```

`formula.set-expression` accepts the source into a pending Formula Atom and creates an evaluation attempt. A concurrent stage calls Formula parse and evaluate with the Document ID as Formula scope, encodes the returned wire value, and derives deterministic `displayText`. A serial stage confirms the Atom and expression digest are unchanged, then appends `formula.apply-evaluation`. A changed target makes the proposal stale and leaves canonical content untouched.

Formula owns language parsing, binding, evaluation, value encoding, dependencies, and diagnostics. The resolver adapter owns Data declaration-snapshot conversion and exact binding construction. Document owns placement, attempt lifecycle, accepted evaluation snapshot, display formatting, Mark transformation, and history. Errors remain Formula diagnostics attached to an error evaluation; the Atom keeps its Formula identity.

### Command and query contracts

```tsx
interface DocumentCommandRequest {
  requestId: string;
  command: DocumentCommand;
}

type DocumentCommand =
  | { type: "document.create"; documentId: string; title: string; recipe?: DocumentRecipe }
  | {
      type: "document.submit";
      documentId: string;
      expectedRevision: number;
      operations: DocumentOperation[];
    }
  | {
      type: "document.duplicate";
      sourceDocumentId: string;
      sourceRevision?: number;
      derivedOutputPolicy: "preserve-revisions" | "use-current-heads";
    }
  | {
      type: "document.compensate";
      documentId: string;
      targetChangeSetId: string;
      intent: "undo" | "redo";
      expectedRevision: number;
    }
  | {
      type: "document.refresh-derived-output";
      documentId: string;
      promptBlockId: string;
      expectedRevision: number;
    }
  | {
      type: "formula.evaluate.request";
      documentId: string;
      formulaAtomId: string;
    };

type DocumentCommandResult =
  | { type: "document.created"; head: DocumentHead }
  | { type: "document.changed"; changeSet: DocumentChangeSet }
  | { type: "derived-output.refreshed"; changed: boolean; output: DerivedOutputRef }
  | { type: "formula.evaluate.requested"; requestId: string };

interface DocumentQueryRequest {
  requestId: string;
  query: DocumentQuery;
}

type DocumentQuery =
  | { type: "document.list"; cursor?: string; lifecycle?: DocumentHead["lifecycle"] }
  | { type: "document.load"; documentId: string; revision?: number }
  | { type: "document.history"; documentId: string; cursor?: string; limit: number }
  | { type: "document.source-snapshot"; documentId: string; revision: number }
  | { type: "document.validate-text-range"; anchor: DocumentTextRangeAnchor };
```

### Store port

```tsx
interface DocumentStore {
  list(cursor?: string, lifecycle?: DocumentHead["lifecycle"]): Promise<DocumentPage>;
  getHead(documentId: string): Promise<DocumentHead | undefined>;
  load(documentId: string, revision?: number): Promise<DocumentSnapshot | undefined>;
  getChangeSets(documentId: string, fromExclusive: number, toInclusive: number): Promise<DocumentChangeSet[]>;
  getSubmission(documentId: string, clientRequestId: string): Promise<DocumentSubmissionReceipt | undefined>;
  commitMutation(commit: DocumentMutationCommit): Promise<void>;
  appendBase(documentId: string, base: DocumentBase): Promise<void>;
  pruneBases(documentId: string, retain: number): Promise<void>;
  pruneChangeSets(documentId: string, retain: number): Promise<void>;
  getFormulaRequest(requestId: string): Promise<FormulaEvaluationAttempt | undefined>;
  saveFormulaRequest(request: FormulaEvaluationAttempt): Promise<void>;
}
```

Document persistence contains Document state, history, idempotency receipts, Formula evaluation requests, and Activity outbox rows. Derived Output state and revisions remain in Knowledge.

## Runtime Objects

### Construction and scope

```tsx
const document = createDocumentCapability(
  store,
  {
    richText,
    formula,
    formulaResolver,
    derivedOutputs,
    logger,
  },
  {
    attribution,
    history: config.document.history,
    limits: config.document.limits,
  },
);
```

Document passes Rich Text operation batches to the pure Rich Text engine, Formula expressions to the Formula/Data resolver seam, and Derived Output reads or refreshes to Knowledge. It does not perform Context resolution, Knowledge retrieval, or Intelligence generation itself.

### Pure domain functions

```tsx
createBlankSnapshot(input): DocumentSnapshot;
createSnapshotFromRecipe(recipe, ids): DocumentSnapshot;
applyOperations(snapshot, operations): ApplyResult;
invertOperations(snapshot, operations): DocumentOperation[];
validateSnapshot(snapshot): ValidationResult;
normalizeSnapshot(snapshot): DocumentSnapshot;
computeTouchedIds(snapshot, operations): string[];
canRebase(touchedIds, interveningChangeSets): RebaseDecision;
resolveTarget(snapshot, target): ResolvedTarget | DocumentError;
validateTextRange(snapshot, range): TextRangeResolution;
canonicalizeSnapshot(snapshot): Uint8Array;
digestSnapshot(snapshot): string;
```

Domain functions are deterministic and side-effect free. `applyOperations` works on a copy and returns the normalized snapshot, canonical forward operations, exact inverse operations, sorted and deduplicated touched IDs, and semantic digest. Domain code does not access SQLite, jobs, HTTP, clocks, random ID generation, Logger, Knowledge, Formula, or Intelligence.

### Rebuildable projections and dependency indexes

- Resource summaries and word counts.
- Heading outline keyed by Document and heading Block ID.
- Plain-text search extraction keyed by Document revision.
- Style usage keyed by Style ID and target ID.
- Link and reference indexes keyed by explicit Rich Text targets.
- Derived Output references keyed by output ID and Prompt Block ID.
- Formula dependencies keyed by observed Formula dependency and Atom ID.
- Pagination and render caches keyed by semantic digest, exact media/font manifest, renderer version, locale, and render options.
- Native-Resource source-snapshot cache keyed by Document ID, exact revision, and semantic digest.

Deleting a rebuildable projection changes performance only. Document content, Derived Output references, Formula displays, revisions, and ChangeSets remain canonical.

### Structured logging

Every public command, public query, and internal stage emits one start entry and one terminal success, rejection, or failure entry through the injected Logger. Fields include operation type, request ID, Document ID when known, observed and result revisions, duration, operation count, semantic digest, idempotent-retry flag, and typed error code. Logs omit Document text, Derived Output content, Formula values, and other content payloads.

Activity is durable semantic history for accepted mutations. Structured logs additionally cover reads, rejected commands, retries, and failed internal stages without adding Document revisions.

## Change Operations

### Exact operation vocabulary

```tsx
type DocumentOperation =
  | { type: "document.rename"; title: string }
  | { type: "document.set-lifecycle"; lifecycle: DocumentHead["lifecycle"] }
  | { type: "layout.set-page"; layout: DocumentPageLayout }
  | { type: "style.create"; style: DocumentStyle }
  | { type: "style.update"; styleId: string; patch: DocumentStylePatch }
  | { type: "style.delete"; styleId: string; replacementStyleId: string }
  | { type: "row.insert"; row: DocumentRow; afterRowId?: string }
  | { type: "row.move"; rowId: string; afterRowId?: string }
  | { type: "row.delete"; rowId: string }
  | { type: "row.set-layout"; rowId: string; layout: RowLayout }
  | { type: "block.insert"; rowId: string; block: DocumentBlock; afterBlockId?: string }
  | { type: "block.move"; blockId: string; destinationRowId: string; afterBlockId?: string }
  | { type: "block.replace"; blockId: string; block: DocumentBlock }
  | { type: "block.delete"; blockId: string }
  | { type: "rich-text.apply"; blockId: string; operations: RichTextOperation[] }
  | { type: "image.set-source"; blockId: string; source: MediaSnapshotRef }
  | { type: "image.set-accessibility"; blockId: string; alt: string; decorative: boolean }
  | { type: "references.set"; blockId: string; references: ReferenceAttachment[] }
  | { type: "prompt.set-output"; blockId: string; output: DerivedOutputRef }
  | { type: "prompt.apply-derived-output"; blockId: string; output: DerivedOutputRef }
  | { type: "formula.set-expression"; blockId: string; atomId: string; expression: string }
  | { type: "formula.apply-evaluation"; blockId: string; atomId: string; evaluation: FormulaEvaluation };
```

Creating and duplicating a Document are application commands because there is no prior snapshot to reduce. A Derived Output refresh changes only the Prompt Block's exact reference. Formula evaluation settlements use typed reversible operations. Rich Text operations are reduced by the shared engine inside the containing Document mutation.

### Base, ChangeSets, and revision semantics

Creation writes revision zero as one Base with no ChangeSet. Every accepted mutation appends exactly one ChangeSet and increments revision by one. `seq` equals `revision`. A Base includes title, lifecycle, layout, styles, and content, so an exact historical load never combines historical content with current metadata.

```tsx
interface DocumentBase {
  representationVersion: 1;
  documentId: string;
  baseSeq: number;
  snapshot: DocumentSnapshot;
  semanticDigest: string;
  createdAt: string;
}

interface DocumentChangeSet {
  id: string;
  documentId: string;
  clientRequestId: string;
  requestDigest: string;
  authoredRevision: number;
  priorRevision: number;
  revision: number;
  seq: number;
  actorId: string;
  origin: "interactive" | "agent" | "automation";
  operations: DocumentOperation[];
  inverseOperations: DocumentOperation[];
  touchedIds: string[];
  compensation?: {
    intent: "undo" | "redo";
    targetChangeSetId: string;
  };
  semanticDigest: string;
  createdAt: string;
}

interface DocumentCommandReceipt {
  requestId: string;
  requestDigest: string;
  result: DocumentCommandResult;
  createdAt: string;
}

interface DocumentActivityContribution {
  id: string;
  kind: "document-created" | "document-changed";
  documentId: string;
  revision: number;
  actorId: string;
  semanticDigest: string;
  changeSetId?: string;
  operationType: "document.create" | "document.change";
  operationTypes?: DocumentOperation["type"][];
  origin: "interactive" | "agent" | "automation";
  occurredAt: string;
  compensation?: DocumentChangeSet["compensation"];
}
```

#### Idempotency

The dispatcher canonicalizes the complete command and computes `requestDigest`. An identical retry returns the original typed result. Reusing a request ID with a different digest returns `idempotency_mismatch`. The command receipt is committed in the same transaction as the created head, attempt, or ChangeSet.

#### Conservative semantic rebase

`expectedRevision` names the snapshot authored by the caller. At the current head, admission proceeds directly. For a retained stale revision, the service reconstructs the authored snapshot and reads every intervening ChangeSet. It computes incoming touched IDs and rejects when any touched ID intersects an intervening touched set. Otherwise it applies the operations unchanged to the current head.

Direct mutation targets, structural insertion and movement anchors, and a parent whose membership, order, or layout changes are touched. Deletion and wholesale replacement touch every ID in the affected subtree. Document-wide operations touch a reserved Document identity. A read-through parent is not touched, allowing edits to independent Atoms or Blocks to proceed. Missing retained history returns `revision_conflict`. A CAS race repeats the same intersection check against the new head.

#### Compensation

The reducer creates inverse operations from exact before-and-after state. Activity selects undo or redo across editable Resources and asks Document to compensate one retained ChangeSet at the current expected revision. Document validates and appends the stored inverse operations as a new ChangeSet. Redo compensates the ChangeSet that performed the undo. Invalid current-head compensation returns `compensation_conflict` without changing state.

#### Retained history and compaction

The active Base plus its contiguous ChangeSet tail reconstructs the head. Historical load selects the nearest retained Base at or before the requested revision, replays the contiguous tail, normalizes the result, and verifies the semantic digest. A revision without the required retained Base and tail returns `history_pruned`.

Compaction runs on the serial queue:

1. Load and replay the exact current head.
2. Append a new Base at that revision.
3. Advance active `baseSeq` only when the head revision remains unchanged.
4. Retain the configured number of recent Bases and ChangeSets while preserving the tail required for current-head replay.

Compaction changes neither logical revision nor semantic digest.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | <code>/documents</code> | Create a Document from a blank or typed recipe. |
| GET | <code>/documents</code> | List Document heads. |
| GET | <code>/documents/snapshot?id=&revision=</code> | Load the current or exact historical snapshot. |
| POST | <code>/documents/changes</code> | Apply one atomic operation batch with expected revision and idempotency key. |
| POST | <code>/documents/compensate</code> | Append undo or redo compensation. |
| GET | <code>/documents/history?id=</code> | Read retained ChangeSets. |
| POST | <code>/documents/derived-output-refresh</code> | Refresh a Prompt Block's Knowledge output and adopt a newer revision when available. |
| POST | <code>/documents/formula-evaluation</code> | Evaluate one Formula atom and settle the accepted display conditionally. |
| GET | <code>/documents/source-snapshot?id=&revision=</code> | Return the exact native-resource snapshot used by Sources and Knowledge. |

## Jobs

| Job | Queue path | Effect |
| --- | --- | --- |
| <code>documents.create</code> | serial | Validate recipe, persist revision zero Base, and publish Activity. |
| <code>documents.submit</code> | serial | Apply Document and Rich Text operations, append one ChangeSet, and publish Activity. |
| <code>documents.read</code> | concurrent | Load heads, snapshots, history, or source snapshots. |
| <code>documents.refresh-derived-output</code> | concurrent → serial | Ask Knowledge to refresh the output, then conditionally advance the Prompt Block reference through one ChangeSet. |
| <code>documents.formula.evaluate</code> | concurrent → serial | Evaluate against one Formula/Data snapshot, then conditionally apply the result. |
| <code>documents.compensate</code> | serial | Append undo or redo compensation. |
| <code>documents.compact</code> | serial | Append a Base and prune retained history without changing semantic state. |

Rich Text has no independent Job. Knowledge owns Derived Output generation and refresh jobs. Document only reads and adopts exact revisions.

## SQL Tables

### Logical schema and indexes

The SQLite adapter derives a safe table prefix from the configured storage scope during construction. The logical schema below is repeated inside that namespace and carries no scope columns.

```sql
CREATE TABLE documents (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  lifecycle        TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived', 'trashed')),
  revision         INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  base_seq         INTEGER NOT NULL DEFAULT 0 CHECK (base_seq >= 0),
  semantic_digest  TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX document_heads_lifecycle_updated
  ON documents(lifecycle, updated_at DESC, id);

CREATE TABLE document_command_receipts (
  request_id      TEXT PRIMARY KEY,
  request_digest  TEXT NOT NULL,
  result_type     TEXT NOT NULL,
  result_json     BLOB NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE TABLE document_bases (
  document_id            TEXT NOT NULL,
  base_seq               INTEGER NOT NULL CHECK (base_seq >= 0),
  representation_version INTEGER NOT NULL,
  snapshot_json          BLOB NOT NULL,
  semantic_digest        TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  PRIMARY KEY (document_id, base_seq),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX document_bases_lookup
  ON document_bases(document_id, base_seq DESC);

CREATE TABLE document_change_sets (
  id                                 TEXT PRIMARY KEY,
  document_id                        TEXT NOT NULL,
  client_request_id                  TEXT NOT NULL,
  request_digest                     TEXT NOT NULL,
  authored_revision                  INTEGER NOT NULL CHECK (authored_revision >= 0),
  prior_revision                     INTEGER NOT NULL CHECK (prior_revision >= 0),
  revision                           INTEGER NOT NULL CHECK (revision > 0),
  seq                                INTEGER NOT NULL CHECK (seq > 0),
  actor_id                           TEXT NOT NULL,
  origin                             TEXT NOT NULL CHECK (origin IN ('interactive', 'agent', 'automation')),
  operations_json                    BLOB NOT NULL,
  inverse_operations_json            BLOB NOT NULL,
  touched_ids_json                   BLOB NOT NULL,
  compensation_intent                TEXT CHECK (compensation_intent IN ('undo', 'redo')),
  compensation_target_change_set_id  TEXT,
  semantic_digest                    TEXT NOT NULL,
  created_at                         TEXT NOT NULL,
  UNIQUE (document_id, seq),
  UNIQUE (document_id, revision),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (compensation_target_change_set_id)
    REFERENCES document_change_sets(id)
);

CREATE INDEX document_changes_recent
  ON document_change_sets(document_id, seq DESC);

CREATE INDEX document_changes_compensation_target
  ON document_change_sets(compensation_target_change_set_id)
  WHERE compensation_target_change_set_id IS NOT NULL;

CREATE TABLE document_activity_outbox (
  id               TEXT PRIMARY KEY,
  document_id      TEXT NOT NULL,
  revision         INTEGER NOT NULL CHECK (revision >= 0),
  change_set_id    TEXT,
  actor_id         TEXT NOT NULL,
  operation_type   TEXT NOT NULL,
  payload_json     BLOB NOT NULL,
  semantic_digest  TEXT NOT NULL,
  occurred_at      TEXT NOT NULL,
  published_at     TEXT,
  UNIQUE (document_id, revision),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (change_set_id) REFERENCES document_change_sets(id)
);

CREATE INDEX document_activity_unpublished
  ON document_activity_outbox(occurred_at, id)
  WHERE published_at IS NULL;

CREATE TABLE document_formula_attempts (
  id                        TEXT PRIMARY KEY,
  document_id               TEXT NOT NULL,
  block_id                  TEXT NOT NULL,
  atom_id                   TEXT NOT NULL,
  client_request_id         TEXT NOT NULL,
  request_digest            TEXT NOT NULL,
  frozen_document_revision  INTEGER NOT NULL,
  frozen_expression_digest  TEXT NOT NULL,
  language_version          INTEGER NOT NULL,
  state                     TEXT NOT NULL,
  evaluation_json           BLOB,
  diagnostic_json           BLOB,
  settled_change_set_id     TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  UNIQUE (document_id, client_request_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (settled_change_set_id) REFERENCES document_change_sets(id)
);

CREATE INDEX document_formula_state
  ON document_formula_attempts(state, updated_at, id);

CREATE INDEX document_formula_atom
  ON document_formula_attempts(document_id, atom_id, updated_at DESC);

CREATE TABLE document_resolution_stages (
  attempt_kind     TEXT NOT NULL CHECK (attempt_kind = 'formula'),
  attempt_id       TEXT NOT NULL,
  stage            TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  request_digest   TEXT NOT NULL,
  state            TEXT NOT NULL,
  result_json      BLOB,
  error_json       BLOB,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (attempt_kind, attempt_id, stage)
);

CREATE INDEX document_resolution_stage_state
  ON document_resolution_stages(state, updated_at, attempt_kind, attempt_id);
```

Canonical JSON uses deterministic key ordering and a SHA-256 semantic digest. SQLite stores one complete bounded Base atomically. The adapter owns migrations, compare-and-swap statements, transaction boundaries, canonical mappers, and retention queries.

## Appendices

### Directory and module architecture

```
apps/backend/src/
  3-capabilities/
    document/
      domain/
        snapshot.ts
        content.ts
        styles.ts
        formulaItems.ts
        operations.ts
        reducer.ts
        inverses.ts
        textRanges.ts
        validation.ts
        canonical.ts
        errors.ts
      application/
        capability.ts
        commands.ts
        queries.ts
        callLogging.ts
        create.ts
        admission.ts
        history.ts
        compensation.ts
        formulaEvaluation.ts
        sourceSnapshot.ts
        activityContributions.ts
      ports/
        documentStore.ts
      persistence/
        migrations/
          001-document.ts
        sqliteDocumentStore.ts
        sqliteMappers.ts
      indexes/
        summaries.ts
        outline.ts
        searchText.ts
        derivedOutputReferences.ts
        formulaDependencies.ts
      index.ts

  1-init/create/
    document.ts

  4-job-wiring/document/
    registerDocumentEndpoints.ts
    createDocumentJobs.ts
    documentJobPayloads.ts
```

`domain` is pure. `application` owns sequencing, idempotency, admission, exact loads, attempts, and settlement. `ports` defines the configuration-scoped transaction contract. `persistence` owns Document SQL and mapping. `indexes` owns rebuildable projections. Initialization creates the scoped store and injects dependencies. Job wiring owns HTTP parsing, request-type registration, queue choice, and response mode.

Formula lives under `0-platform/formula/`; Knowledge under `0-platform/knowledge/`; Intelligence and observability remain platform services. Context and Data are regular capabilities with public aliases. Document imports only their public types or injected interfaces.

### Governing invariants

1. One global page layout and one ordered Row flow define each canonical Document.
2. Every Block payload is determined by its closed discriminant.
3. Rows, Blocks, Atoms, Marks, list items, table parts, Styles, and anchors use stable non-reused IDs.
4. Every accepted canonical mutation is one validated ChangeSet and one revision increment.
5. Creation starts at revision zero with one Base and no ChangeSet.
6. Identical command retries return the original typed result; divergent request-ID reuse is rejected.
7. Replay of a retained Base and contiguous ChangeSet tail reproduces the stored semantic digest.
8. Conservative rebase accepts only operations whose touched IDs are disjoint from all retained intervening changes.
9. Knowledge owns Derived Output computation; Document changes only when serial settlement advances a Prompt Block's exact output revision.
10. Prompt Blocks store only Derived Output references; Knowledge records exact grounding and dependency manifests.
11. Formula output records the exact expression, wire value or diagnostics, dependencies, display text, and evaluator metadata accepted by the Document.
12. Configuration scope is consumed during store construction; Document contracts and rows remain scope-free.
13. Accepted changes carry the configured `actorId`; other Document values do not carry attribution.
14. Derived indexes and caches can be discarded and rebuilt without losing accepted state or history.

### Acceptance tests

- Create a blank or recipe-backed Document at revision zero and load a byte-equivalent canonical snapshot.
- Insert, move, resize, and remove Rows and Blocks while preserving stable identity and validating track membership.
- Edit text, split and join Blocks, apply Marks and semantic Styles, and prove deterministic range transformation over Unicode and Formula display text.
- Insert, nest, reorder, and remove list items; mutate table axes and merges while retaining Cell identity and rectangular validity.
- Transform text-range comment anchors through insertion, deletion, split, join, and movement.
- Submit identical and divergent retries and verify receipt behavior.
- Admit disjoint stale edits and reject overlapping touched-ID edits.
- Replay, compensate, compact, retain, and prune history while preserving the exact current semantic digest.
- Refresh one Prompt Block and verify Knowledge owns retrieval and generation while Document changes only when adopting a newer Derived Output revision.
- Change the Prompt Block during refresh and verify Document settlement rejects advancing the reference at a stale expected revision.
- Evaluate a Formula Atom, accept typed display and diagnostics, transform its Marks, and reject settlement after its expression changes.
- Delete every rebuildable index and reconstruct summaries, outline, search text, Prompt dependencies, and Formula dependencies from canonical records.

### Related references

- Platform — Icarus Rich Text Runtime Model
- Addendum — Icarus Knowledge Derived Output Runtime Model
- Platform — Icarus Intelligence Runtime Model
- Platform — Icarus Formula Runtime Model
- Platform — Icarus Knowledge Runtime Model
- Capability — Icarus Context Runtime Model
# Capability — Icarus Document Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e50281dc8604e8466e48f3d8).

## Summary / Concept
<callout icon="🧭" color="blue_bg">
	**Build position:** Resources 2 of 4. Document follows Knowledge and the Foundation services. It establishes the native rich-content and revision patterns reused by Slides.
</callout>
### Prerequisites
<table fit-page-width="true" header-row="true">
<tr>
<td>Prerequisite</td>
<td>Status</td>
<td>Document dependency</td>
</tr>
<tr>
<td>Runtime configuration, database, job registry, dual queues, and Logger</td>
<td>Available</td>
<td>Constructs the configuration-scoped store, registers jobs, and records structured call outcomes.</td>
</tr>
<tr>
<td>Platform Intelligence</td>
<td>Available</td>
<td>Runs strict structured reasoning for Prompt planning and synthesis.</td>
</tr>
<tr>
<td>Formula, Data name resolution, and their resolver adapter</td>
<td>Formula and Data name resolution available; resolver adapter required</td>
<td>The adapter freezes name declarations and exact values into an immutable resolver snapshot; Formula parses, binds, evaluates, and explains against that snapshot.</td>
</tr>
<tr>
<td>Knowledge</td>
<td>Available; scoped retrieval update in progress</td>
<td>Returns exact lattice regions and one shared scope manifest for Prompt grounding.</td>
</tr>
<tr>
<td>Context</td>
<td>Implementation in progress</td>
<td>Owns `ContextEntry`, resolves named Contexts, and supplies the scope resolver injected into Knowledge.</td>
</tr>
</table>
### Concept
Document is the authoritative backend capability for editable long-form Resources. It owns Document identity, the semantic content snapshot, semantic styles, accepted Prompt and Formula results, provenance, revision history, exact historical reads, and source-snapshot projections.
The canonical Document is one globally styled content flow. It has one page-layout definition and one ordered array of Rows. Each Row contains one or more Blocks whose positive width units determine their relative horizontal share. Pagination, browser editor nodes, rendered pixels, search text, outlines, and dependency lookups are projections of that state.
```plain text
DocumentSnapshot
  ├─ title, lifecycle, and revision
  ├─ one global pageLayout
  ├─ semantic StyleRegistry
  └─ ordered DocumentRow[]
       └─ ordered typed DocumentBlock[] + relative Row tracks
            ├─ rich text, lists, and tables
            ├─ media, charts, embeds, and references
            ├─ Prompt content + accepted Knowledge grounding
            └─ Formula atoms + accepted evaluations
```
## Types & Interfaces
### Canonical aggregate
```typescript
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
```typescript
interface BlockBase {
  id: string;
  styleId: string;
  presentation?: BlockPresentationOverride;
  provenance: ProvenanceLink[];
}

type DocumentBlock =
  | (BlockBase & { kind: "paragraph"; content: InlineContent })
  | (BlockBase & {
      kind: "heading";
      level: 1 | 2 | 3 | 4 | 5 | 6;
      content: InlineContent;
    })
  | (BlockBase & { kind: "quote"; content: InlineContent })
  | (BlockBase & {
      kind: "code";
      language?: string;
      content: InlineContent;
    })
  | (BlockBase & {
      kind: "prompt";
      content: InlineContent;
      prompt: PromptDefinition;
    })
  | (BlockBase & {
      kind: "callout";
      tone: CalloutTone;
      rows: DocumentRow[];
    })
  | (BlockBase & { kind: "list"; list: DocumentList })
  | (BlockBase & { kind: "table"; table: DocumentTable })
  | (BlockBase & { kind: "image"; image: ImageBlockData })
  | (BlockBase & { kind: "chart"; chart: ChartBlockData })
  | (BlockBase & { kind: "embed"; embed: SafeEmbedData })
  | (BlockBase & { kind: "divider" });

type CalloutTone = "info" | "success" | "warning" | "danger" | "neutral";
```
Each admitted Block is valid by its discriminant and payload. Callouts are the Block that nests general Rows, and their descendants cannot contain another callout. The configured maximum Block depth, total node count, text length, and serialized snapshot size are enforced after every mutation.
#### Lists
```typescript
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
`start` is valid for numbered lists. `checked` is valid for checklist items. Item identity survives reorder and nesting changes. Nested `children` are the list hierarchy; item body Rows carry the item's rich content.
#### Tables
```typescript
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
Every row-and-column pair has exactly one Cell. Reordering retains row, column, and Cell identity. A merge describes one rectangular root-and-covered set, and merge rectangles cannot overlap. Table insertion supplies the complete new Cell set required by the opposite axis. Nested tables are bounded by configured depth.
#### Media, charts, embeds, and references
```typescript
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
  source: "literal" | "analysis-result" | "structured-data";
  specification: Record<string, unknown>;
  snapshotDigest?: string;
}

interface SafeEmbedData {
  provider: "resource" | "video" | "iframe";
  source: string;
  title: string;
  sandbox: "strict" | "media";
}

type DocumentReferenceTarget =
  | { kind: "source"; sourceVersionId: string }
  | { kind: "evidence"; evidenceId: string; revision?: number }
  | {
      kind: "resource-target";
      resourceKind: "document" | "slides" | "spreadsheet";
      resourceId: string;
      targetId?: string;
    };

interface ProvenanceLink {
  origin: {
    kind: string;
    id: string;
    version: string;
    digest?: string;
  };
  locator?: {
    kind: "text-range" | "resource-target" | "record";
    value: Record<string, unknown>;
  };
  relation: "quoted" | "derived" | "computed" | "transcluded" | "imported";
  admittedAt: string;
}
```
Images require alt text unless explicitly decorative. Embeds are allowlisted descriptors with a declared sandbox policy. They do not persist executable markup. References retain exact target identity and admitted provenance.
### Rich text and editor positions
```typescript
interface InlineContent {
  atoms: InlineAtom[];
  marks: InlineMark[];
}

type InlineAtom =
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "formula"; formula: FormulaItem }
  | {
      id: string;
      kind: "reference";
      target: DocumentReferenceTarget;
      provenance: ProvenanceLink[];
    };

interface TextPosition {
  atomId: string;
  offset: number;
  affinity: "before" | "after";
}

interface BlockTextRange {
  blockId: string;
  start: TextPosition;
  end: TextPosition;
}

type InlineMark =
  | {
      id: string;
      kind: "bold" | "italic" | "underline" | "strike" | "code" | "link";
      start: TextPosition;
      end: TextPosition;
      href?: string;
    }
  | {
      id: string;
      kind: "document-style";
      styleId: string;
      start: TextPosition;
      end: TextPosition;
    };
```
Offsets are UTF-16 code-unit offsets, matching TypeScript and browser editor APIs. Ranges are half-open. Validation rejects endpoints outside their Atom and offsets that split a surrogate pair. Link schemes are allowlisted.
Text replacement clips or removes affected Marks and normalizes adjacent equivalent Marks. A browser selection across Blocks is submitted as one normalized range per Block. Formula and reference Atoms remain atomic under ordinary text editing. Formula `displayText` participates in positioning and may receive Marks; only Formula operations may change its expression or accepted display.
`text.split-block` maps content and Marks to a following Block created with a supplied stable ID. `text.join-block` joins adjacent compatible rich-text Blocks and deterministically remaps positions. Stable IDs are never reused after removal.
#### Comment anchors
```typescript
interface DocumentTextPosition extends TextPosition {
  blockId: string;
}

interface DocumentTextRangeAnchor {
  kind: "text-range";
  documentId: string;
  start: DocumentTextPosition;
  end: DocumentTextPosition;
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
Insertion inside or at either boundary of selected text expands the range. Deleting selected text or splitting it across Blocks promotes the thread to a Document anchor. Collaboration stores and renders the returned typed anchor; Document owns deterministic anchor transformation.
### Semantic styles
```typescript
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
### Prompt Blocks and grounded refresh
```typescript
type ContextEntry = import("#context").ContextEntry;

interface PromptDefinition {
  instruction: string;
  contexts: ContextEntry[];
  persona?: { personaId: string; version: number };
  refreshPolicy: "manual" | "automatic";
  definitionRevision: number;
  contentRevision: number;
  lastResolution?: PromptResolution;
}

interface KnowledgeScopeManifest {
  inputEntries: ContextEntry[];
  resolvedEntries: ContextEntry[];
  resolvedSourceIds: string[];
  contextDigest: string;
  scopeDigest: string;
  resolvedAt: string;
}

interface PromptGroundingRegion {
  id: string;
  text: string;
  origin: ProvenanceLink["origin"];
  locator: ProvenanceLink["locator"];
}

interface PromptGroundingManifest {
  digest: string;
  regions: PromptGroundingRegion[];
  resolvedAt: string;
}

interface PromptResolution {
  status: "ok" | "insufficient" | "contradiction";
  resolutionKind: "initial" | "refresh";
  instructionDigest: string;
  baselineContentDigest: string;
  scopeManifest: KnowledgeScopeManifest;
  grounding: PromptGroundingManifest;
  promptDigest: string;
  schemaDigest: string;
  resolvedAt: string;
}

interface PromptTextPatch {
  atomId: string;
  start: number;
  end: number;
  text: string;
}
```
The Prompt Block's `content` is the editable canonical text. Its instruction and Context entries describe how to resolve that content. Current text is an editorial baseline for stable updates; retrieved lattice regions are the factual grounding.
Knowledge resolves the Prompt's Context entries once for the full query batch. It performs normal lattice descent, loads the candidate windows, removes windows whose `sourceId` is outside the resolved source set, and then assembles regions. `retrieveMany` returns one result per query, each carrying the same frozen `KnowledgeScopeManifest`. Document deterministically combines and deduplicates those regions before synthesis. An empty Context list uses the complete configuration-scoped lattice.
```plain text
serial request
  → load Prompt Block
  → freeze definition, content, revisions, Context entries, prompt, and schema digests
  → persist idempotent PromptRefreshAttempt

concurrent resolution
  → Intelligence.reasonStructured for bounded retrieval planning
  → Knowledge.retrieveMany with the frozen Context entries
  → remove out-of-scope windows and assemble grounded regions
  → Intelligence.reasonStructured for initial generation or stable refresh
  → validate structured output and protected inline tokens
  → derive minimal atom-local text patches
  → persist the proposal

serial settlement
  → reload the Prompt Block
  → compare definitionRevision and contentRevision with the frozen values
  → append prompt.apply-refresh ChangeSet when equal
  → mark the attempt stale without mutating the Document when different
```
Formula and reference Atoms are serialized as protected tokens during refresh. Every token must remain unchanged and in order. Accepted patches use ordinary text-range transformation rules. The accepted `PromptResolution` records exact scope, grounding, prompt, and schema digests.
```typescript
interface PromptRefreshAttempt {
  id: string;
  documentId: string;
  promptBlockId: string;
  clientRequestId: string;
  requestDigest: string;
  trigger: "manual" | "automatic";
  resolutionKind: "initial" | "refresh";
  frozenDocumentRevision: number;
  frozenDefinitionRevision: number;
  frozenContentRevision: number;
  frozenDefinitionDigest: string;
  frozenContexts: ContextEntry[];
  frozenContent: InlineContent;
  promptDigest: string;
  schemaDigest: string;
  state:
    | "requested"
    | "resolving"
    | "proposed"
    | "settled"
    | "failed"
    | "stale"
    | "canceled";
  queries?: string[];
  scope?: KnowledgeScopeManifest;
  grounding?: PromptGroundingManifest;
  patches?: PromptTextPatch[];
  diagnostic?: { code: string; message: string };
  settledChangeSetId?: string;
}
```
Prompt planning and synthesis use Intelligence casts whose purpose labels distinguish planning, initial generation, and refresh. Provider selection remains inside Intelligence.
### Formula Atoms and evaluation
```typescript
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
```typescript
interface DocumentCommandRequest {
  requestId: string;
  origin: "interactive" | "agent" | "automation";
  command: DocumentCommand;
}

type DocumentCommand =
  | { type: "document.create"; title: string; recipe?: DocumentCreationRecipe }
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
      promptCopyPolicy: "preserve" | "disable-automatic-refresh";
    }
  | {
      type: "document.compensate";
      documentId: string;
      targetChangeSetId: string;
      intent: "undo" | "redo";
      expectedRevision: number;
    }
  | {
      type: "prompt.refresh.request";
      documentId: string;
      promptBlockId: string;
      trigger: "manual" | "automatic";
    }
  | {
      type: "formula.evaluate.request";
      documentId: string;
      formulaAtomId: string;
    };

type DocumentCommandResult =
  | { type: "document.created"; head: DocumentHead }
  | { type: "document.changed"; changeSet: DocumentChangeSet }
  | { type: "prompt.refresh.requested"; attempt: PromptRefreshAttempt }
  | { type: "formula.evaluate.requested"; attempt: FormulaEvaluationAttempt };

interface DocumentQueryRequest {
  requestId: string;
  query: DocumentQuery;
}

type DocumentQuery =
  | {
      type: "document.list";
      cursor?: string;
      lifecycle?: DocumentHead["lifecycle"];
    }
  | { type: "document.get"; documentId: string }
  | { type: "document.load"; documentId: string; revision?: number }
  | {
      type: "document.history";
      documentId: string;
      cursor?: string;
      limit: number;
    }
  | { type: "prompt.refresh.status"; attemptId: string }
  | { type: "formula.evaluate.status"; attemptId: string }
  | {
      type: "document.source-snapshot";
      documentId: string;
      revision: number;
    }
  | {
      type: "document.validate-text-range";
      anchor: DocumentTextRangeAnchor;
    };
```
### Store port
```typescript
interface DocumentStore {
  transaction<T>(
    work: (tx: DocumentTransaction) => Promise<T>,
  ): Promise<T>;
}

interface DocumentTransaction {
  getCommandReceipt(requestId: string): Promise<DocumentCommandReceipt | undefined>;
  saveCommandReceipt(receipt: DocumentCommandReceipt): Promise<void>;
  createHead(
    head: DocumentHead,
    base: DocumentBase,
    receipt: DocumentCommandReceipt,
    activity: DocumentActivityContribution,
  ): Promise<void>;
  getHead(documentId: string): Promise<DocumentHead | undefined>;
  listHeads(query: DocumentListQuery): Promise<DocumentSummaryPage>;
  getBaseAtOrBefore(documentId: string, revision: number): Promise<DocumentBase>;
  listChangeSets(
    documentId: string,
    fromExclusive: number,
    throughInclusive?: number,
  ): Promise<DocumentChangeSet[]>;
  appendChangeSet(
    expectedRevision: number,
    changeSet: DocumentChangeSet,
    nextHead: DocumentHead,
    activity: DocumentActivityContribution,
  ): Promise<void>;
  appendBase(base: DocumentBase, expectedRevision: number): Promise<void>;
  pruneBases(documentId: string, retain: number): Promise<void>;
  pruneChangeSets(documentId: string, retain: number): Promise<void>;
  getRefreshAttempt(attemptId: string): Promise<PromptRefreshAttempt | undefined>;
  saveRefreshAttempt(attempt: PromptRefreshAttempt): Promise<void>;
  getFormulaAttempt(attemptId: string): Promise<FormulaEvaluationAttempt | undefined>;
  saveFormulaAttempt(attempt: FormulaEvaluationAttempt): Promise<void>;
  claimStage(receipt: ResolutionStageReceipt): Promise<StageClaim>;
  settleStage(receipt: ResolutionStageReceipt): Promise<void>;
}
```
`appendChangeSet` performs revision compare-and-swap and writes the ChangeSet, next head, Activity contribution, and command receipt atomically.
## Runtime Objects
### Construction and scope
The application configuration selects the storage scope when the backend starts. The top-level `projectId` is consumed by the Document store factory to derive a safe SQLite namespace; it does not enter Document values, requests, ChangeSets, repository methods, or table columns. Runtime attribution is also created from top-level configuration and copied only onto accepted changes and their Activity contributions.
```typescript
interface DocumentRuntimeConfig {
  history: {
    retainedBaseCount: number;
    retainedChangeSetCount: number;
  };
  limits: DocumentLimits;
}

interface DocumentDependencies {
  knowledge: Knowledge;
  intelligence: Intelligence;
  formula: Formula;
  formulaResolver: FormulaNameResolverAdapter;
  logger: Logger;
}

const store = createDocumentStoreFromRuntimeConfig(config, database);
const attribution = createRuntimeAttribution(config);
const documents = createDocumentCapability(
  store,
  { knowledge, intelligence, formula, formulaResolver, logger },
  {
    attribution,
    history: config.document.history,
    limits: config.document.limits,
  },
);
```
Document passes stored `ContextEntry[]` directly to Knowledge. Context resolution is injected into Knowledge during application initialization; Document does not call the Context capability while resolving a Prompt. Formula evaluation obtains one immutable resolver snapshot through the injected Formula/Data adapter, then passes the expression and snapshot to the pure Formula engine.
### Pure domain functions
```typescript
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
These values are derived from canonical Bases and ChangeSets:
- Document summaries and word counts.
- Heading outline keyed by Document and heading Block ID.
- Plain-text search extraction keyed by Document revision.
- Style usage keyed by Style ID and target ID.
- Prompt dependencies keyed by Context entry, resolved source identity, and Prompt Block ID.
- Formula dependencies keyed by observed Formula dependency and Atom ID.
- Refresh status projections.
- Pagination and render caches keyed by semantic digest, exact media/font manifest, renderer version, locale, and render options.
- Native-Resource source-snapshot cache keyed by Document ID, exact revision, and semantic digest.
Deleting a rebuildable projection changes performance only. Accepted content, exact grounding, provenance, revisions, and attempts remain in canonical and operational stores.
### Structured logging
Every public command, public query, and internal stage emits one start entry and one terminal success, rejection, or failure entry through the injected Logger. Fields include operation type, request or attempt ID, Document ID when known, observed and result revisions, duration, operation count, semantic digest, idempotent-retry flag, and typed error code. Logs omit Document text, Prompt instructions, lattice regions, Formula values, and other content payloads.
Activity is durable semantic history for accepted mutations. Structured logs additionally cover reads, rejected commands, retries, and failed internal stages without adding Document revisions.
## Change Operations
### Exact operation vocabulary
```typescript
type DocumentOperation =
  | { type: "document.rename"; title: string }
  | {
      type: "document.set-lifecycle";
      lifecycle: "active" | "archived" | "trashed";
    }
  | {
      type: "document.update-page-layout";
      pageLayout: DocumentPageLayout;
    }
  | { type: "style.create"; style: DocumentStyle }
  | {
      type: "style.update";
      styleId: string;
      patch: DocumentStylePatch;
    }
  | {
      type: "style.remove";
      styleId: string;
      replaceWithStyleId: string;
    }
  | { type: "block.apply-style"; blockId: string; styleId: string }
  | {
      type: "style.apply-text-range";
      styleId: string;
      ranges: TextStyleRange[];
    }
  | { type: "style.remove-text-range"; markIds: string[] }
  | {
      type: "row.insert";
      container: RowContainerAddress;
      row: DocumentRow;
      afterRowId?: string;
    }
  | {
      type: "row.move";
      rowId: string;
      to: RowContainerAddress;
      afterRowId?: string;
    }
  | { type: "row.remove"; rowId: string }
  | { type: "row.update-layout"; rowId: string; layout: RowLayout }
  | {
      type: "block.insert";
      rowId: string;
      block: DocumentBlock;
      afterBlockId?: string;
    }
  | {
      type: "block.move";
      blockId: string;
      toRowId: string;
      afterBlockId?: string;
    }
  | { type: "block.remove"; blockId: string }
  | {
      type: "text.splice";
      blockId: string;
      atomId: string;
      start: number;
      end: number;
      text: string;
    }
  | {
      type: "text.split-block";
      blockId: string;
      at: TextPosition;
      newBlockId: string;
    }
  | {
      type: "text.join-block";
      firstBlockId: string;
      secondBlockId: string;
    }
  | {
      type: "inline.insert";
      blockId: string;
      atom: InlineAtom;
      afterAtomId?: string;
    }
  | { type: "inline.remove"; blockId: string; atomId: string }
  | { type: "mark.add"; blockId: string; mark: InlineMark }
  | { type: "mark.remove"; blockId: string; markId: string }
  | {
      type: "list.insert-item";
      listId: string;
      parentItemId?: string;
      item: ListItem;
      afterItemId?: string;
    }
  | {
      type: "list.move-item";
      listId: string;
      itemId: string;
      parentItemId?: string;
      afterItemId?: string;
    }
  | { type: "list.remove-item"; listId: string; itemId: string }
  | {
      type: "list.set-checked";
      listId: string;
      itemId: string;
      checked: boolean;
    }
  | {
      type: "table.insert-row";
      tableId: string;
      row: TableRow;
      cells: TableCell[];
      afterRowId?: string;
    }
  | {
      type: "table.move-row";
      tableId: string;
      rowId: string;
      afterRowId?: string;
    }
  | { type: "table.remove-row"; tableId: string; rowId: string }
  | {
      type: "table.insert-column";
      tableId: string;
      column: TableColumn;
      cells: TableCell[];
      afterColumnId?: string;
    }
  | {
      type: "table.move-column";
      tableId: string;
      columnId: string;
      afterColumnId?: string;
    }
  | {
      type: "table.remove-column";
      tableId: string;
      columnId: string;
    }
  | { type: "table.merge"; tableId: string; merge: TableMerge }
  | { type: "table.unmerge"; tableId: string; mergeId: string }
  | {
      type: "image.set-source";
      blockId: string;
      source: MediaSnapshotRef;
    }
  | {
      type: "image.set-accessibility";
      blockId: string;
      alt: string;
      decorative: boolean;
    }
  | {
      type: "prompt.update-definition";
      blockId: string;
      prompt: PromptDefinition;
    }
  | {
      type: "prompt.apply-refresh";
      blockId: string;
      patches: PromptTextPatch[];
      resolution: PromptResolution;
    }
  | {
      type: "formula.set-expression";
      blockId: string;
      atomId: string;
      languageVersion: 1;
      expression: string;
    }
  | {
      type: "formula.apply-evaluation";
      blockId: string;
      atomId: string;
      evaluation: FormulaEvaluationSnapshot;
    };

type RowContainerAddress =
  | { kind: "body" }
  | { kind: "callout"; blockId: string }
  | { kind: "list-item"; listId: string; itemId: string }
  | { kind: "table-cell"; tableId: string; cellId: string };

interface TextStyleRange extends BlockTextRange {
  markId: string;
}
```
Creating and duplicating a Document are application commands because there is no prior snapshot to reduce. Prompt refresh and Formula evaluation requests create durable operational attempts. Accepted Prompt and Formula settlements use the same reversible Document operation vocabulary as direct edits.
### Base, ChangeSets, and revision semantics
Creation writes revision zero as one Base with no ChangeSet. Every accepted mutation appends exactly one ChangeSet and increments revision by one. `seq` equals `revision`. A Base includes title, lifecycle, layout, styles, and content, so an exact historical load never combines historical content with current metadata.
```typescript
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
<table fit-page-width="true" header-row="true">
<tr>
<td>Method and path</td>
<td>Request type</td>
<td>Queue</td>
<td>Response</td>
</tr>
<tr>
<td>`POST /documents/command`</td>
<td>`documents.command`</td>
<td>Serial</td>
<td>Inline typed command result</td>
</tr>
<tr>
<td>`POST /documents/query`</td>
<td>`documents.query`</td>
<td>Concurrent</td>
<td>Inline typed query result</td>
</tr>
</table>
Queue choice is fixed at endpoint registration. Command and query dispatchers decode their capability-owned discriminated unions after the dispatcher has selected the queue.
## Jobs
<table fit-page-width="true" header-row="true">
<tr>
<td>Endpoint or intent</td>
<td>Job</td>
<td>Queue</td>
<td>Response mode</td>
<td>Change operations emitted</td>
<td>Calls or durable writes</td>
</tr>
<tr>
<td>`POST /documents/command`</td>
<td>`documents.command`</td>
<td>Serial</td>
<td>Inline typed command result</td>
<td>Create writes Base revision 0; submit appends supplied `DocumentOperation[]`; compensate appends stored inverse operations; refresh and evaluation requests emit no Document operation yet.</td>
<td>Document transaction, command receipt, Activity outbox, or durable attempt</td>
</tr>
<tr>
<td>`POST /documents/query`</td>
<td>`documents.query`</td>
<td>Concurrent</td>
<td>Inline typed query result</td>
<td>None</td>
<td>Document store and rebuildable projections</td>
</tr>
<tr>
<td>Prompt resolution intent</td>
<td>`documents.prompt.resolve`</td>
<td>Concurrent</td>
<td>Persisted proposal followed by settlement intent</td>
<td>None</td>
<td>Knowledge scoped retrieval and Intelligence; updates the refresh attempt</td>
</tr>
<tr>
<td>Prompt settlement intent</td>
<td>`documents.prompt.settle`</td>
<td>Serial</td>
<td>Settled attempt and optional ChangeSet</td>
<td>`prompt.apply-refresh` when frozen preconditions still match</td>
<td>Document transaction, ChangeSet, receipt, and Activity outbox</td>
</tr>
<tr>
<td>Formula evaluation intent</td>
<td>`documents.formula.evaluate`</td>
<td>Concurrent</td>
<td>Persisted candidate followed by settlement intent</td>
<td>None</td>
<td>Immutable Data resolver snapshot and Platform Formula; updates the formula attempt</td>
</tr>
<tr>
<td>Formula settlement intent</td>
<td>`documents.formula.settle`</td>
<td>Serial</td>
<td>Settled attempt and optional ChangeSet</td>
<td>`formula.apply-evaluation` when frozen preconditions still match</td>
<td>Document transaction, ChangeSet, receipt, and Activity outbox</td>
</tr>
<tr>
<td>Retention intent</td>
<td>`documents.compact`</td>
<td>Serial</td>
<td>Inline completion</td>
<td>None; compaction preserves logical revision and semantic digest</td>
<td>Append Base and prune retained history transactionally</td>
</tr>
</table>
Internal work uses separate request types:
- `documents.prompt.resolve` — concurrent.
- `documents.prompt.settle` — serial.
- `documents.formula.evaluate` — concurrent.
- `documents.formula.settle` — serial.
- `documents.compact` — serial.
Request commands durably create attempts. Concurrent stages persist proposals. Serial settlement is the only asynchronous stage that may append a canonical ChangeSet.
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

CREATE TABLE document_refresh_attempts (
  id                          TEXT PRIMARY KEY,
  document_id                 TEXT NOT NULL,
  prompt_block_id             TEXT NOT NULL,
  client_request_id           TEXT NOT NULL,
  request_digest              TEXT NOT NULL,
  trigger                     TEXT NOT NULL CHECK (trigger IN ('manual', 'automatic')),
  resolution_kind             TEXT NOT NULL CHECK (resolution_kind IN ('initial', 'refresh')),
  frozen_document_revision    INTEGER NOT NULL,
  frozen_definition_revision  INTEGER NOT NULL,
  frozen_content_revision     INTEGER NOT NULL,
  frozen_definition_digest    TEXT NOT NULL,
  frozen_contexts_json        BLOB NOT NULL,
  frozen_content_json         BLOB NOT NULL,
  prompt_digest               TEXT NOT NULL,
  schema_digest               TEXT NOT NULL,
  state                       TEXT NOT NULL,
  queries_json                BLOB,
  scope_manifest_json         BLOB,
  grounding_manifest_json     BLOB,
  patches_json                BLOB,
  diagnostic_json             BLOB,
  settled_change_set_id       TEXT,
  created_at                  TEXT NOT NULL,
  updated_at                  TEXT NOT NULL,
  UNIQUE (document_id, client_request_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (settled_change_set_id) REFERENCES document_change_sets(id)
);

CREATE INDEX document_refresh_state
  ON document_refresh_attempts(state, updated_at, id);

CREATE INDEX document_refresh_prompt
  ON document_refresh_attempts(document_id, prompt_block_id, updated_at DESC);

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
  attempt_kind     TEXT NOT NULL CHECK (attempt_kind IN ('prompt', 'formula')),
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
```plain text
apps/backend/src/
  3-capabilities/
    document/
      domain/
        snapshot.ts
        content.ts
        styles.ts
        prompt.ts
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
        promptRefresh.ts
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
        promptDependencies.ts
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
9. Prompt and Formula computation cannot mutate canonical content; only serial settlement may append their typed operations.
10. Prompt output records the exact shared scope manifest and grounding regions used to synthesize it.
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
- Resolve one Prompt across multiple retrieval queries; verify all query results use the same scope manifest and that out-of-scope windows do not reach synthesis.
- Change Prompt text during concurrent resolution and verify serial settlement marks the result stale without a Document mutation.
- Evaluate a Formula Atom, accept typed display and diagnostics, transform its Marks, and reject settlement after its expression changes.
- Delete every rebuildable index and reconstruct summaries, outline, search text, Prompt dependencies, and Formula dependencies from canonical records.
### Related references
- [Platform — Icarus Intelligence Runtime Model](../platform/intelligence.md)
- [Platform — Icarus Formula Runtime Model](../platform/formula.md)
- [Platform — Icarus Knowledge Runtime Model](../platform/knowledge.md)
- [Capability — Icarus Context Runtime Model](context.md)

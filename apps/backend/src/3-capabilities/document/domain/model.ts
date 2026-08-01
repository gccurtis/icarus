import type { ContextEntry } from "#context";
import type {
  RichContent,
  RichTextOperation,
  TextRange,
  TextStyleProperties
} from "#rich-text";
import type {
  DerivedOutput,
  DerivedOutputRef,
  DerivedOutputRevision
} from "#derived-outputs";

export type DocumentLifecycle = "active" | "archived" | "trashed";
export type DocumentOrigin = "interactive" | "agent" | "automation";

export interface DocumentHead {
  id: string;
  title: string;
  lifecycle: DocumentLifecycle;
  revision: number;
  baseSeq: number;
  semanticDigest: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: DocumentLifecycle;
  pageLayout: DocumentPageLayout;
  styles: DocumentStyleRegistry;
  rows: DocumentRow[];
}

export interface DocumentPageLayout {
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

export type DocumentSystemStyleRole =
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6";

export interface DocumentStyleRegistry {
  defaultStyleIdByBlockKind: Record<DocumentBlockKind, string>;
  styles: DocumentStyle[];
}

export interface DocumentStyle {
  id: string;
  name: string;
  basedOnStyleId?: string;
  text: TextStyleProperties;
  block: BlockStyleProperties;
  systemRole?: DocumentSystemStyleRole;
}

export interface BlockStyleProperties {
  alignment?: "left" | "center" | "right" | "justify";
  wrapping?: "wrap" | "no-wrap" | "break-word";
  spacingBeforeTwips?: number;
  spacingAfterTwips?: number;
  lineHeight?: number;
  indentation?: {
    leftTwips: number;
    rightTwips: number;
    firstLineTwips: number;
  };
  keepWithNext?: boolean;
  keepTogether?: boolean;
}

export interface BlockPresentationOverride extends BlockStyleProperties {}

export interface DocumentRow {
  id: string;
  blocks: DocumentBlock[];
  layout: RowLayout;
}

export interface RowLayout {
  blockGapTwips: number;
  marginBeforeTwips: number;
  marginAfterTwips: number;
  tracks: RowTrack[];
}

export interface RowTrack {
  blockId: string;
  widthUnits: number;
}

export interface BlockBase {
  id: string;
  styleId: string;
  presentation?: BlockPresentationOverride;
}

export interface TextBlock extends BlockBase {
  kind: "text";
  content: RichContent;
}

export interface CodeBlock extends BlockBase {
  kind: "code";
  language?: string;
  content: RichContent;
}

export interface QuoteBlock extends BlockBase {
  kind: "quote";
  content: RichContent;
}

export interface PromptBlock extends BlockBase {
  kind: "prompt";
  output: DerivedOutputRef;
}

export interface DividerBlock extends BlockBase {
  kind: "divider";
}

export interface CalloutBlock extends BlockBase {
  kind: "callout";
  tone: "info" | "success" | "warning" | "danger" | "neutral";
  rows: DocumentRow[];
}

export interface ListBlock extends BlockBase {
  kind: "list";
  list: DocumentList;
}

export interface TableBlock extends BlockBase {
  kind: "table";
  table: DocumentTable;
}

export interface ImageBlock extends BlockBase {
  kind: "image";
  image: ImageBlockData;
}

export interface ChartBlock extends BlockBase {
  kind: "chart";
  chart: ChartBlockData;
}

export type DocumentBlock =
  | TextBlock
  | CodeBlock
  | QuoteBlock
  | PromptBlock
  | DividerBlock
  | CalloutBlock
  | ListBlock
  | TableBlock
  | ImageBlock
  | ChartBlock;

export type DocumentBlockKind = DocumentBlock["kind"];

export interface DocumentList {
  id: string;
  listKind: "bulleted" | "numbered" | "checklist";
  start?: number;
  items: ListItem[];
}

export interface ListItem {
  id: string;
  checked?: boolean;
  rows: DocumentRow[];
  children: ListItem[];
}

export interface DocumentTable {
  id: string;
  columns: TableColumn[];
  rows: TableRow[];
  cells: TableCell[];
  merges: TableMerge[];
}

export interface TableColumn {
  id: string;
  width: { kind: "auto" } | { kind: "fixed"; twips: number };
}

export interface TableRow {
  id: string;
  minHeightTwips?: number;
  header: boolean;
}

export interface TableCell {
  id: string;
  rowId: string;
  columnId: string;
  rows: DocumentRow[];
  verticalAlign: "top" | "middle" | "bottom";
}

export interface TableMerge {
  id: string;
  rootCellId: string;
  coveredCellIds: string[];
}

export interface VisualDimensions {
  widthTwips?: number;
  heightTwips: number;
  lockAspectRatio: boolean;
  horizontalAlign: "left" | "center" | "right" | "stretch";
}

export interface MediaSnapshotRef {
  fileId: string;
  version: string;
  digest: string;
  mimeType: string;
}

export interface ImageBlockData {
  source: MediaSnapshotRef;
  dimensions: VisualDimensions;
  alt: string;
  decorative: boolean;
  crop?: { left: number; top: number; right: number; bottom: number };
  fit: "contain" | "cover" | "stretch";
}

export interface ChartBlockData {
  source: "literal" | "formula" | "analysis-result" | "structured-data";
  specification: Record<string, unknown>;
  dimensions: VisualDimensions;
  snapshotDigest?: string;
  alt: string;
}

export type BlockPlacement =
  | {
      kind: "after-block";
      afterBlockId: string;
      /** Required when the anchor is the only Block in its Row. */
      newRowId?: string;
      widthUnits?: number;
    }
  | {
      kind: "between-blocks";
      beforeBlockId: string;
      afterBlockId: string;
      /** Required when the anchors are in different Rows. */
      newRowId?: string;
      widthUnits?: number;
    }
  | { kind: "in-row"; rowId: string; afterBlockId?: string; widthUnits?: number }
  | {
      kind: "new-row";
      afterRowId?: string;
      rowId: string;
      layout?: Omit<RowLayout, "tracks">;
      widthUnits?: number;
    };

export type DocumentOperation =
  | { type: "document.rename"; title: string }
  | { type: "document.set-lifecycle"; lifecycle: DocumentLifecycle }
  | { type: "layout.set-page"; layout: DocumentPageLayout }
  | { type: "style.create"; style: DocumentStyle }
  | { type: "style.update"; styleId: string; style: DocumentStyle }
  | { type: "style.delete"; styleId: string; replacementStyleId: string }
  | { type: "style.set-default"; blockKind: DocumentBlockKind; styleId: string }
  | {
      type: "style.apply-inline";
      blockId: string;
      styleId: string;
      markId: string;
      range: TextRange;
      resolvedProperties: TextStyleProperties;
    }
  | { type: "row.insert"; row: DocumentRow; afterRowId?: string }
  | { type: "row.move"; rowId: string; afterRowId?: string }
  | { type: "row.delete"; rowId: string }
  | { type: "row.set-layout"; rowId: string; layout: RowLayout }
  | { type: "block.insert"; block: DocumentBlock; placement: BlockPlacement }
  | { type: "block.move"; blockId: string; placement: BlockPlacement }
  | { type: "block.replace"; blockId: string; block: DocumentBlock }
  | { type: "block.delete"; blockId: string }
  | { type: "block.set-style"; blockId: string; styleId: string }
  | {
      type: "block.set-presentation";
      blockId: string;
      presentation?: BlockPresentationOverride;
    }
  | { type: "rich-text.apply"; blockId: string; operations: RichTextOperation[] }
  | { type: "prompt.apply-derived-output"; blockId: string; output: DerivedOutputRef }
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
  | { type: "list.delete-item"; listId: string; itemId: string }
  | { type: "list.set-checked"; listId: string; itemId: string; checked: boolean }
  | {
      type: "table.insert-row";
      tableId: string;
      row: TableRow;
      cells: TableCell[];
      afterRowId?: string;
    }
  | { type: "table.move-row"; tableId: string; rowId: string; afterRowId?: string }
  | { type: "table.delete-row"; tableId: string; rowId: string }
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
  | { type: "table.delete-column"; tableId: string; columnId: string }
  | { type: "table.merge"; tableId: string; merge: TableMerge }
  | { type: "table.unmerge"; tableId: string; mergeId: string }
  | { type: "image.set-source"; blockId: string; source: MediaSnapshotRef }
  | {
      type: "image.set-accessibility";
      blockId: string;
      alt: string;
      decorative: boolean;
    }
  | { type: "visual.set-dimensions"; blockId: string; dimensions: VisualDimensions };

export interface DocumentBase {
  representationVersion: 1;
  documentId: string;
  baseSeq: number;
  snapshot: DocumentSnapshot;
  semanticDigest: string;
  createdAt: string;
}

export interface DocumentChangeSet {
  id: string;
  documentId: string;
  clientRequestId: string;
  requestDigest: string;
  authoredRevision: number;
  priorRevision: number;
  revision: number;
  seq: number;
  origin: DocumentOrigin;
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

export interface DocumentCommittedFact {
  /**
   * The stable Activity transaction ID. It is allocated with the accepted
   * Document mutation and is reused for every outbox delivery attempt.
   */
  factId: string;
  /** The accepted Document command that produced this outbox record. */
  sourceRequestId: string;
  kind: "document.created" | "document.changed" | "document.compensated";
  documentId: string;
  revision: number;
  /**
   * A copied source ChangeSet ID, deliberately independent of the historical
   * ChangeSet foreign key. Document compaction must not make an outbox row
   * incomplete before Activity has consumed it.
   */
  sourceChangeSetId?: string;
  actorId?: string;
  /** Document keeps its own origin vocabulary; the integration adapter maps it. */
  origin: DocumentOrigin;
  operationTypes: string[];
  /** The Document snapshot digest, not the Activity transaction digest. */
  sourceSemanticDigest: string;
  /** Immutable compensation information needed by future Activity undo/redo. */
  compensation?: {
    intent: "undo" | "redo";
    targetChangeSetId: string;
  };
  occurredAt: string;
}

export interface DocumentSubmissionReceipt {
  documentId: string;
  requestId: string;
  requestDigest: string;
  result: DocumentCommandResult;
  createdAt: string;
}

/**
 * Durable local half of a command delegated to another capability store.
 * The target is frozen before the external side effect starts so an exact
 * retry never retargets after the canonical Document changes.
 */
export interface DocumentDelegatedCommandClaim {
  documentId: string;
  requestId: string;
  requestDigest: string;
  kind: "prompt.update-definition";
  targetOutputId: string;
  state: "pending" | "completed";
  createdAt: string;
  updatedAt: string;
}

export type DocumentAttemptState =
  | "requested"
  | "computing"
  | "proposed"
  | "settled"
  | "unchanged"
  | "stale"
  | "failed";

export interface AttemptBase {
  id: string;
  documentId: string;
  clientRequestId: string;
  requestDigest: string;
  blockId: string;
  frozenDocumentRevision: number;
  state: DocumentAttemptState;
  settledChangeSetId?: string;
  diagnostic?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

export interface PromptCreationAttempt extends AttemptBase {
  kind: "prompt-create";
  styleId: string;
  presentation?: BlockPresentationOverride;
  placement: BlockPlacement;
  definition: {
    prompt: string;
    contextEntries: ContextEntry[];
    stabilisationText: string;
  };
  candidateOutputId?: string;
  candidateHeadRevision?: number;
}

export interface PromptRefreshAttempt extends AttemptBase {
  kind: "prompt-refresh";
  promptBlockId: string;
  outputId: string;
  frozenAppliedRevision: number;
  candidateHeadRevision?: number;
}

export interface FormulaEvaluationAttempt extends AttemptBase {
  kind: "formula-evaluation";
  atomId: string;
  originChangeSetId?: string;
  frozenExpression: string;
  frozenExpressionDigest: string;
  resolverSnapshotDigest?: string;
  candidateOperations?: RichTextOperation[];
}

export type DocumentAttempt =
  | PromptCreationAttempt
  | PromptRefreshAttempt
  | FormulaEvaluationAttempt;

export interface DocumentStageReceipt {
  attemptId: string;
  stage: "compute" | "settle";
  idempotencyKey: string;
  requestDigest: string;
  state: "running" | "completed" | "failed";
  result?: unknown;
  diagnostic?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

export interface PromptOutputOwnership {
  outputId: string;
  documentId: string;
  blockId: string;
  creationAttemptId?: string;
  state: "pending" | "attached" | "detached";
  attachedRevision?: number;
  detachedRevision?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCommandRequest {
  requestId: string;
  origin: DocumentOrigin;
  actorId?: string;
  command: DocumentCommand;
}

export type DocumentCommand =
  | {
      type: "document.create";
      documentId: string;
      title: string;
      pageLayout?: DocumentPageLayout;
      styles?: DocumentStyleRegistry;
    }
  | {
      type: "document.submit";
      documentId: string;
      expectedRevision: number;
      operations: DocumentOperation[];
    }
  | {
      type: "document.compensate";
      documentId: string;
      targetChangeSetId: string;
      intent: "undo" | "redo";
      expectedRevision: number;
    }
  | {
      type: "prompt.create.request";
      documentId: string;
      expectedRevision: number;
      blockId: string;
      styleId: string;
      presentation?: BlockPresentationOverride;
      placement: BlockPlacement;
      prompt: string;
      contextEntries: ContextEntry[];
      stabilisationText: string;
    }
  | {
      type: "prompt.update-definition";
      documentId: string;
      promptBlockId: string;
      expectedDefinitionRevision: number;
      prompt: string;
      contextEntries: ContextEntry[];
      stabilisationText: string;
    }
  | {
      type: "prompt.refresh.request";
      documentId: string;
      promptBlockId: string;
      expectedRevision: number;
    }
  | {
      type: "formula.evaluate.request";
      documentId: string;
      blockId: string;
      formulaAtomId: string;
    };

export type DocumentCommandResult =
  | { type: "document.created"; head: DocumentHead }
  | { type: "document.changed"; changeSet: DocumentChangeSet }
  | { type: "prompt.create-requested"; attemptId: string }
  | { type: "prompt.definition-updated"; output: DerivedOutput }
  | { type: "prompt.refresh-requested"; attemptId: string }
  | { type: "formula.evaluate-requested"; attemptId: string };

export interface DocumentQueryRequest {
  requestId: string;
  query: DocumentQuery;
}

export type DocumentQuery =
  | { type: "document.list"; cursor?: string; lifecycle?: DocumentLifecycle }
  | { type: "document.load"; documentId: string; revision?: number }
  | { type: "document.history"; documentId: string; cursor?: string; limit: number }
  | { type: "document.attempt"; documentId: string; attemptId: string };

export type DocumentQueryResult =
  | { type: "document.listed"; items: DocumentHead[]; nextCursor?: string }
  | {
      type: "document.loaded";
      head: DocumentHead;
      snapshot: DocumentSnapshot;
      promptRevisions: DerivedOutputRevision[];
    }
  | { type: "document.history"; items: DocumentChangeSet[]; nextCursor?: string }
  | { type: "document.attempt"; attempt: DocumentAttempt };

export type DocumentInternalJobIntent =
  | {
      type: "document.compact";
      documentId: string;
      idempotencyKey: string;
    }
  | {
      type: "document.prompt.create.compute";
      attemptId: string;
      idempotencyKey: string;
    }
  | {
      type: "document.prompt.create.settle";
      attemptId: string;
      idempotencyKey: string;
    }
  | {
      type: "document.prompt.refresh.compute";
      attemptId: string;
      idempotencyKey: string;
    }
  | {
      type: "document.prompt.refresh.settle";
      attemptId: string;
      idempotencyKey: string;
    }
  | {
      type: "document.formula.evaluate.compute";
      attemptId: string;
      idempotencyKey: string;
    }
  | {
      type: "document.formula.evaluate.settle";
      attemptId: string;
      idempotencyKey: string;
    };

export interface DocumentHistoryRetention {
  retainedBaseCount: number;
  retainedChangeSetCount: number;
  retainedTerminalAttemptCount: number;
}

export interface DocumentLimits {
  maxRowsPerDocument: number;
  maxBlocksPerRow: number;
  maxStylesPerDocument: number;
  maxNestingDepth: number;
  maxAtomsPerBlockContent: number;
  maxTableRows: number;
  maxTableColumns: number;
}

export interface DocumentOptions {
  history: DocumentHistoryRetention;
  limits: DocumentLimits;
}

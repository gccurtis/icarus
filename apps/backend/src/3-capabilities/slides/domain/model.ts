import type { ContextEntry } from "#context";
import type {
  RichContent,
  RichTextOperation,
  TextStyleProperties
} from "#rich-text";
import type {
  DerivedOutput,
  DerivedOutputRef,
  DerivedOutputRevision
} from "#derived-outputs";

export type DeckLifecycle = "active" | "archived" | "trashed";
export type SlideOrigin = "interactive" | "agent" | "automation";

export interface DeckHead {
  id: string;
  title: string;
  lifecycle: DeckLifecycle;
  revision: number;
  baseSeq: number;
  semanticDigest: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeckSnapshot {
  representationVersion: 1;
  revision: number;
  title: string;
  lifecycle: DeckLifecycle;
  canvas: SlideCanvas;
  theme: DeckTheme;
  styles: SlideStyleRegistry;
  masters: Record<string, Master>;
  layouts: Record<string, Layout>;
  slideOrder: string[];
  slides: Record<string, Slide>;
}

/**
 * Dimensions only. What a renderer does with them is not our concern; this is
 * the analogue of Document's `pageLayout`, held as data.
 */
export interface SlideCanvas {
  widthPt: number;
  heightPt: number;
}

// ── Theme ────────────────────────────────────────────────────────────────

/** A CSS-style colour string, matching Rich Text's `TextStyleProperties.color`. */
export type SlideColor = string;

export interface DeckTheme {
  name: string;
  tokens: Record<string, DeckDesignToken>;
  palette: DeckThemePalette;
  typography: DeckThemeTypography;
}

export type DeckDesignToken =
  | { id: string; kind: "color"; name: string; value: SlideColor }
  | { id: string; kind: "font"; name: string; family: string }
  | { id: string; kind: "length"; name: string; valuePt: number };

export type DeckDesignTokenKind = DeckDesignToken["kind"];

/**
 * Either a literal or a live reference to a token of the matching kind. Tokens
 * never alias other tokens, so resolution cannot cycle.
 */
export type ThemeValue<T> =
  | { kind: "literal"; value: T }
  | { kind: "token"; tokenId: string };

export interface DeckThemePalette {
  background: ThemeValue<SlideColor>;
  surface: ThemeValue<SlideColor>;
  text: ThemeValue<SlideColor>;
  accent: ThemeValue<SlideColor>;
}

export interface DeckThemeTypography {
  headingFontFamily: ThemeValue<string>;
  bodyFontFamily: ThemeValue<string>;
  baseFontSizePt: ThemeValue<number>;
}

// ── Styles ───────────────────────────────────────────────────────────────

/** Only `normal` exists for now, and only it is protected. */
export type SlideSystemStyleRole = "normal";

export interface SlideStyleRegistry {
  defaultStyleIdByElementKind: Record<SlideElementKind, string>;
  styles: SlideStyle[];
}

export interface SlideStyle {
  id: string;
  name: string;
  basedOnStyleId?: string;
  systemRole?: SlideSystemStyleRole;
  text?: TextStyleProperties;
  box?: BoxAppearance;
}

export interface BoxAppearance {
  fill?: SlideFill;
  border?: SlideBorder;
  paddingPt?: number;
  cornerRadiusPt?: number;
  shadow?: boolean;
  textAlign?: "left" | "center" | "right" | "justify";
  verticalAlign?: "top" | "middle" | "bottom";
}

export type SlideFill =
  | { kind: "none" }
  | { kind: "solid"; color: ThemeValue<SlideColor> };

export interface SlideBorder {
  widthPt: number;
  style: "solid" | "dashed" | "dotted";
  color: ThemeValue<SlideColor>;
}

export type SlideBackground =
  | { kind: "inherit" }
  | { kind: "solid"; color: ThemeValue<SlideColor> }
  | { kind: "image"; source: MediaSnapshotRef; fit: "contain" | "cover" | "stretch" };

// ── Masters, Layouts and slots ───────────────────────────────────────────

export interface Master {
  id: string;
  name: string;
  background: SlideBackground;
  /** Painted behind every Slide whose Layout names this Master. */
  elements: Record<string, SlideElement>;
}

export interface Layout {
  id: string;
  name: string;
  masterId: string;
  /** Overrides the Master's when present. */
  background?: SlideBackground;
  elements: Record<string, SlideElement>;
  /** Named placeholders a Slide fills. Placement metadata only — never painted. */
  slots: Record<string, LayoutSlot>;
}

export interface LayoutSlot {
  id: string;
  name: string;
  frame: ElementFrame;
  /** Which element kinds may bind here. Empty means any framed kind. */
  accepts: SlideElementKind[];
}

/** Which of the three planes an element lives in. */
export type ElementContainerRef =
  | { kind: "slide"; slideId: string }
  | { kind: "master"; masterId: string }
  | { kind: "layout"; layoutId: string };

export type ElementContainerKind = ElementContainerRef["kind"];

// ── Slides and elements ──────────────────────────────────────────────────

export interface Slide {
  id: string;
  layoutId: string;
  /** Plain metadata, not Rich Content. */
  title?: string;
  /** Overrides the Layout's when present. */
  background?: SlideBackground;
  /** Authored only. Notes are the author's own aside, never generated. */
  notes: RichContent;
  elements: Record<string, SlideElement>;
}

export interface ElementFrame {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

/**
 * A slot-bound element has exactly one frame authority — the slot's — so it
 * follows slot edits live. Moving it detaches it to a free frame at the slot's
 * then-current position.
 */
export type ElementPlacement =
  | { kind: "free"; frame: ElementFrame }
  | { kind: "slot"; slotId: string };

export interface SlideElementBase {
  id: string;
  parentGroupId?: string;
  /** Sole sibling-order authority: unique and contiguous 0..n-1, back to front. */
  zIndex: number;
  placement: ElementPlacement;
  rotationDegrees?: number;
  locked: boolean;
  hidden: boolean;
  styleId?: string;
}

/**
 * Text is a source, not an element kind. A Slide element is a positioned box,
 * and its frame, order, rotation, lock, style, group membership and slot
 * binding are all indifferent to whether its text was authored or generated.
 *
 * A `prompt` source holds only a reference: generated text never enters the
 * snapshot, and `deck.load` resolves it on read the way `document.load` does.
 */
export type SlideTextSource =
  | { kind: "rich"; content: RichContent }
  | { kind: "prompt"; output: DerivedOutputRef };

export type SlideTextSourceKind = SlideTextSource["kind"];

export interface GroupElement extends SlideElementBase {
  kind: "group";
  /** Membership is carried by each member's `parentGroupId`; no child array. */
  name?: string;
}

export interface TextElement extends SlideElementBase {
  kind: "text";
  body: SlideTextSource;
}

export interface TableElement extends SlideElementBase {
  kind: "table";
  table: SlideTable;
}

export interface ChartElement extends SlideElementBase {
  kind: "chart";
  chart: SlideChartData;
}

export interface ImageElement extends SlideElementBase {
  kind: "image";
  image: SlideImageData;
}

export interface GeometryElement extends SlideElementBase {
  kind: "geometry";
  geometry: SlideGeometry;
}

export interface LineElement extends SlideElementBase {
  kind: "line";
  line: SlideLine;
}

export type SlideElement =
  | GroupElement
  | TextElement
  | TableElement
  | ChartElement
  | ImageElement
  | GeometryElement
  | LineElement;

export type SlideElementKind = SlideElement["kind"];

// ── Tables ───────────────────────────────────────────────────────────────

export interface SlideTable {
  id: string;
  columns: SlideTableColumn[];
  rows: SlideTableRow[];
  cells: SlideTableCell[];
  merges: SlideTableMerge[];
}

export interface SlideTableColumn {
  id: string;
  width: { kind: "auto" } | { kind: "fixed"; widthPt: number };
}

export interface SlideTableRow {
  id: string;
  minHeightPt?: number;
  header: boolean;
}

export interface SlideTableCell {
  id: string;
  rowId: string;
  columnId: string;
  body: SlideTextSource;
  verticalAlign: "top" | "middle" | "bottom";
  styleId?: string;
}

export interface SlideTableMerge {
  id: string;
  rootCellId: string;
  coveredCellIds: string[];
}

// ── Charts, images, geometry, lines ──────────────────────────────────────

export interface MediaSnapshotRef {
  fileId: string;
  version: string;
  digest: string;
  mimeType: string;
}

export interface SlideChartData {
  /** Literal series only; formula-backed series are deferred. */
  source: "literal";
  specification: Record<string, unknown>;
  labels: SlideChartLabel[];
  alt: string;
}

export interface SlideChartLabel {
  id: string;
  role: string;
  content: RichContent;
}

export interface SlideImageData {
  source: MediaSnapshotRef;
  alt: string;
  decorative: boolean;
  crop?: { left: number; top: number; right: number; bottom: number };
  fit: "contain" | "cover" | "stretch";
}

export interface SlideGeometry {
  shape:
    | "rectangle"
    | "rounded-rectangle"
    | "ellipse"
    | "triangle"
    | "diamond"
    | "arrow"
    | "chevron";
  appearance: BoxAppearance;
}

export interface SlideLine {
  /** Relative to the element frame, so a Line moves with its frame. */
  start: { xPt: number; yPt: number };
  end: { xPt: number; yPt: number };
  widthPt: number;
  style: "solid" | "dashed" | "dotted";
  color: ThemeValue<SlideColor>;
  startCap: "none" | "arrow" | "dot";
  endCap: "none" | "arrow" | "dot";
}

// ── Addressing ───────────────────────────────────────────────────────────

export interface ElementRef {
  container: ElementContainerRef;
  elementId: string;
}

/**
 * Every surface holding Rich Content. Document addresses content by `blockId`
 * because a block has exactly one content; a Slide element can hold many.
 */
export type RichContentTarget =
  | { kind: "element-body"; container: ElementContainerRef; elementId: string }
  | {
      kind: "table-cell";
      container: ElementContainerRef;
      elementId: string;
      cellId: string;
    }
  | {
      kind: "chart-label";
      container: ElementContainerRef;
      elementId: string;
      labelId: string;
    }
  | { kind: "slide-notes"; slideId: string };

/**
 * Every surface that may hold a `prompt` source: a Text element's body and a
 * table cell, in any of the three planes. A generated element on a Master or
 * Layout is a live prompt like any other — the backdrop is as much authored
 * content as a Slide is.
 *
 * Narrower than `RichContentTarget` in two places. Chart labels are too small
 * to be worth generating, and Slide notes are the author's own aside rather
 * than something to hand to a model.
 */
export type PromptSite =
  | { kind: "element-body"; container: ElementContainerRef; elementId: string }
  | {
      kind: "table-cell";
      container: ElementContainerRef;
      elementId: string;
      cellId: string;
    };

export type PromptSiteKind = PromptSite["kind"];

/**
 * Where generated text will land. A caller names placement, never an
 * identifier: the service allocates the element ID at freeze and returns it.
 */
export type PromptCreateTarget =
  | {
      kind: "new-text-element";
      container: ElementContainerRef;
      placement: ElementPlacement;
      styleId?: string;
      parentGroupId?: string;
    }
  | { kind: "existing"; site: PromptSite };

// ── Operations ───────────────────────────────────────────────────────────

export type SlideOperation =
  | { type: "deck.rename"; title: string }
  | { type: "deck.set-lifecycle"; lifecycle: DeckLifecycle }
  | { type: "canvas.set"; canvas: SlideCanvas }
  | { type: "theme.rename"; name: string }
  | { type: "theme.set-palette"; palette: DeckThemePalette }
  | { type: "theme.set-typography"; typography: DeckThemeTypography }
  | { type: "token.create"; token: DeckDesignToken }
  | { type: "token.update"; tokenId: string; token: DeckDesignToken }
  | { type: "token.delete"; tokenId: string; replacementTokenId: string }
  | { type: "style.create"; style: SlideStyle }
  | { type: "style.update"; styleId: string; style: SlideStyle }
  | { type: "style.delete"; styleId: string; replacementStyleId: string }
  | { type: "style.set-default"; elementKind: SlideElementKind; styleId: string }
  | { type: "master.insert"; master: Master }
  | { type: "master.rename"; masterId: string; name: string }
  | { type: "master.set-background"; masterId: string; background: SlideBackground }
  | { type: "master.delete"; masterId: string; replacementMasterId: string }
  | { type: "layout.insert"; layout: Layout }
  | { type: "layout.rename"; layoutId: string; name: string }
  | { type: "layout.set-master"; layoutId: string; masterId: string }
  | {
      type: "layout.set-background";
      layoutId: string;
      background?: SlideBackground;
    }
  | { type: "layout.delete"; layoutId: string; replacementLayoutId: string }
  | { type: "slot.insert"; layoutId: string; slot: LayoutSlot }
  | { type: "slot.update"; layoutId: string; slot: LayoutSlot }
  | { type: "slot.delete"; layoutId: string; slotId: string }
  | { type: "slide.insert"; slide: Slide; afterSlideId?: string }
  | { type: "slide.move"; slideId: string; afterSlideId?: string }
  | { type: "slide.delete"; slideId: string }
  | { type: "slide.set-layout"; slideId: string; layoutId: string }
  | { type: "slide.set-title"; slideId: string; title?: string }
  | { type: "slide.set-background"; slideId: string; background?: SlideBackground }
  | {
      type: "element.insert";
      container: ElementContainerRef;
      element: SlideElement;
    }
  | {
      type: "element.replace";
      container: ElementContainerRef;
      element: SlideElement;
    }
  | {
      type: "element.reorder";
      container: ElementContainerRef;
      elementId: string;
      parentGroupId?: string;
      zIndex: number;
    }
  | { type: "element.delete"; container: ElementContainerRef; elementId: string }
  | {
      type: "element.set-placement";
      container: ElementContainerRef;
      elementId: string;
      placement: ElementPlacement;
    }
  | {
      type: "element.set-style";
      container: ElementContainerRef;
      elementId: string;
      styleId?: string;
    }
  | {
      type: "element.set-rotation";
      container: ElementContainerRef;
      elementId: string;
      rotationDegrees?: number;
    }
  | {
      type: "element.set-flags";
      container: ElementContainerRef;
      elementId: string;
      locked: boolean;
      hidden: boolean;
    }
  | {
      type: "element.group";
      container: ElementContainerRef;
      group: GroupElement;
      memberIds: string[];
    }
  | { type: "element.ungroup"; container: ElementContainerRef; groupId: string }
  | { type: "text-source.set"; target: PromptSite; source: SlideTextSource }
  | { type: "rich-text.apply"; target: RichContentTarget; operations: RichTextOperation[] }
  | { type: "prompt.apply-derived-output"; site: PromptSite; output: DerivedOutputRef }
  | {
      type: "table.insert-row";
      container: ElementContainerRef;
      elementId: string;
      row: SlideTableRow;
      cells: SlideTableCell[];
      afterRowId?: string;
    }
  | {
      type: "table.move-row";
      container: ElementContainerRef;
      elementId: string;
      rowId: string;
      afterRowId?: string;
    }
  | {
      type: "table.delete-row";
      container: ElementContainerRef;
      elementId: string;
      rowId: string;
    }
  | {
      type: "table.insert-column";
      container: ElementContainerRef;
      elementId: string;
      column: SlideTableColumn;
      cells: SlideTableCell[];
      afterColumnId?: string;
    }
  | {
      type: "table.move-column";
      container: ElementContainerRef;
      elementId: string;
      columnId: string;
      afterColumnId?: string;
    }
  | {
      type: "table.delete-column";
      container: ElementContainerRef;
      elementId: string;
      columnId: string;
    }
  | {
      type: "table.merge";
      container: ElementContainerRef;
      elementId: string;
      merge: SlideTableMerge;
    }
  | {
      type: "table.unmerge";
      container: ElementContainerRef;
      elementId: string;
      mergeId: string;
    }
  | {
      type: "image.set-source";
      container: ElementContainerRef;
      elementId: string;
      source: MediaSnapshotRef;
    }
  | {
      type: "image.set-accessibility";
      container: ElementContainerRef;
      elementId: string;
      alt: string;
      decorative: boolean;
    };

export type SlideOperationType = SlideOperation["type"];

// ── History ──────────────────────────────────────────────────────────────

export interface DeckBase {
  representationVersion: 1;
  deckId: string;
  baseSeq: number;
  snapshot: DeckSnapshot;
  semanticDigest: string;
  createdAt: string;
}

export interface DeckChangeSet {
  id: string;
  deckId: string;
  clientRequestId: string;
  requestDigest: string;
  authoredRevision: number;
  priorRevision: number;
  revision: number;
  seq: number;
  origin: SlideOrigin;
  operations: SlideOperation[];
  inverseOperations: SlideOperation[];
  touchedIds: string[];
  compensation?: {
    intent: "undo" | "redo";
    targetChangeSetId: string;
  };
  semanticDigest: string;
  createdAt: string;
}

export interface DeckCommittedTransaction {
  /**
   * The idempotency key Activity derives its transaction ID from. It is
   * allocated with the accepted mutation and reused for every delivery attempt.
   */
  sourceTransactionId: string;
  sourceRequestId: string;
  kind: "deck.created" | "deck.changed" | "deck.compensated" | "deck.deleted";
  deckId: string;
  revision: number;
  /**
   * A copied source ChangeSet ID, deliberately independent of the historical
   * ChangeSet foreign key: compaction must not make an outbox row incomplete
   * before Activity has consumed it.
   */
  sourceChangeSetId?: string;
  actorId?: string;
  /** Slides keeps its own origin vocabulary; the 1-init adapter maps it. */
  origin: SlideOrigin;
  operationTypes: string[];
  /** The Deck snapshot digest, not the Activity transaction digest. */
  sourceSemanticDigest: string;
  compensation?: {
    intent: "undo" | "redo";
    targetChangeSetId: string;
  };
  occurredAt: string;
}

export interface DeckSubmissionReceipt {
  deckId: string;
  requestId: string;
  requestDigest: string;
  result: SlideCommandResult;
  createdAt: string;
}

/**
 * Replay record for `deck.create`, keyed by request ID alone.
 *
 * Every other command addresses an existing Deck, so its receipt can be keyed
 * `(deck_id, request_id)`. A create has no Deck ID until the service allocates
 * one, so a retry would have nothing to look up with and would create a second
 * Deck. `deckId` is carried only so the row can cascade on deletion.
 */
export interface DeckCreateReceipt {
  requestId: string;
  deckId: string;
  requestDigest: string;
  result: SlideCommandResult;
  createdAt: string;
}

// ── Attempts ─────────────────────────────────────────────────────────────

export type SlideAttemptState =
  | "requested"
  | "computing"
  | "proposed"
  | "settled"
  | "unchanged"
  | "stale"
  | "failed";

export interface AttemptBase {
  id: string;
  deckId: string;
  clientRequestId: string;
  requestDigest: string;
  frozenDeckRevision: number;
  state: SlideAttemptState;
  settledChangeSetId?: string;
  diagnostic?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

export interface PromptCreationAttempt extends AttemptBase {
  kind: "prompt-create";
  target: PromptCreateTarget;
  /**
   * The site the settled source will occupy. For `new-text-element` this holds
   * the element ID the service allocated at freeze, so settlement and the
   * ownership row agree on an address before the element exists.
   */
  site: PromptSite;
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
  site: PromptSite;
  outputId: string;
  frozenAppliedRevision: number;
  candidateHeadRevision?: number;
}

export interface FormulaEvaluationAttempt extends AttemptBase {
  kind: "formula-evaluation";
  target: RichContentTarget;
  atomId: string;
  originChangeSetId?: string;
  frozenExpression: string;
  frozenExpressionDigest: string;
  resolverSnapshotDigest?: string;
  candidateOperations?: RichTextOperation[];
}

export type SlideAttempt =
  | PromptCreationAttempt
  | PromptRefreshAttempt
  | FormulaEvaluationAttempt;

export interface SlideStageReceipt {
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
  deckId: string;
  site: PromptSite;
  creationAttemptId?: string;
  state: "pending" | "attached" | "detached";
  attachedRevision?: number;
  detachedRevision?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Commands and queries ─────────────────────────────────────────────────

export interface SlideCommandRequest {
  requestId: string;
  origin: SlideOrigin;
  actorId?: string;
  command: SlideCommand;
}

export type SlideCommand =
  | {
      /**
       * The Deck ID and its first Slide are allocated by the service. A caller
       * has no basis on which to name a resource that does not exist yet.
       */
      type: "deck.create";
      title: string;
      canvas?: SlideCanvas;
    }
  | {
      type: "deck.submit";
      deckId: string;
      expectedRevision: number;
      operations: SlideOperation[];
    }
  | {
      type: "deck.compensate";
      deckId: string;
      targetChangeSetId: string;
      intent: "undo" | "redo";
      expectedRevision: number;
    }
  | {
      /** Logical deletion; retained history remains revision-loadable. */
      type: "deck.delete";
      deckId: string;
      expectedRevision: number;
    }
  | { type: "deck.purge"; deckId: string }
  | {
      type: "prompt.create.request";
      deckId: string;
      expectedRevision: number;
      target: PromptCreateTarget;
      prompt: string;
      contextEntries: ContextEntry[];
      stabilisationText: string;
    }
  | {
      type: "prompt.update-definition";
      deckId: string;
      site: PromptSite;
      expectedDefinitionRevision: number;
      prompt: string;
      contextEntries: ContextEntry[];
      stabilisationText: string;
    }
  | {
      type: "prompt.refresh.request";
      deckId: string;
      site: PromptSite;
      expectedRevision: number;
    }
  | {
      type: "formula.evaluate.request";
      deckId: string;
      target: RichContentTarget;
      formulaAtomId: string;
    };

export type SlideCommandResult =
  | { type: "deck.created"; head: DeckHead }
  | { type: "deck.changed"; changeSet: DeckChangeSet }
  | { type: "deck.deleted"; deckId: string; revision: number }
  | { type: "deck.purged"; deckId: string }
  | { type: "prompt.create-requested"; attemptId: string; site: PromptSite }
  | { type: "prompt.definition-updated"; output: DerivedOutput }
  | { type: "prompt.refresh-requested"; attemptId: string }
  | { type: "formula.evaluate-requested"; attemptId: string };

export interface SlideQueryRequest {
  requestId: string;
  query: SlideQuery;
}

export type SlideQuery =
  | { type: "deck.list"; cursor?: string; lifecycle?: DeckLifecycle }
  | { type: "deck.load"; deckId: string; revision?: number }
  | { type: "deck.history"; deckId: string; cursor?: string; limit: number }
  | { type: "deck.attempt"; deckId: string; attemptId: string };

export type SlideQueryResult =
  | { type: "deck.listed"; items: DeckHead[]; nextCursor?: string }
  | {
      type: "deck.loaded";
      head: DeckHead;
      snapshot: DeckSnapshot;
      promptRevisions: DerivedOutputRevision[];
    }
  | { type: "deck.history"; items: DeckChangeSet[]; nextCursor?: string }
  | { type: "deck.attempt"; attempt: SlideAttempt };

export type SlideInternalJobIntent =
  | { type: "slides.compact"; deckId: string; idempotencyKey: string }
  | { type: "slides.prompt.create.compute"; attemptId: string; idempotencyKey: string }
  | { type: "slides.prompt.create.settle"; attemptId: string; idempotencyKey: string }
  | { type: "slides.prompt.refresh.compute"; attemptId: string; idempotencyKey: string }
  | { type: "slides.prompt.refresh.settle"; attemptId: string; idempotencyKey: string }
  | { type: "slides.formula.evaluate.compute"; attemptId: string; idempotencyKey: string }
  | { type: "slides.formula.evaluate.settle"; attemptId: string; idempotencyKey: string };

// ── Options ──────────────────────────────────────────────────────────────

export interface SlideHistoryRetention {
  retainedBaseCount: number;
  retainedChangeSetCount: number;
  retainedTerminalAttemptCount: number;
}

export interface SlideLimits {
  maxSlidesPerDeck: number;
  maxElementsPerContainer: number;
  maxMastersPerDeck: number;
  maxLayoutsPerDeck: number;
  maxSlotsPerLayout: number;
  maxStylesPerDeck: number;
  maxTokensPerTheme: number;
  maxGroupDepth: number;
  maxTableRows: number;
  maxTableColumns: number;
}

export interface SlideOptions {
  history: SlideHistoryRetention;
  limits: SlideLimits;
}

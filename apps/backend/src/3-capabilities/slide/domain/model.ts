import type { ContextEntry } from "#context";
import type {
  DerivedOutput,
  DerivedOutputRef,
  DerivedOutputRevision
} from "#derived-outputs";
import type { FormulaWireValue } from "#formula";
import type {
  RichContent,
  RichTextOperation,
  TextStyleProperties
} from "#rich-text";

export type DeckId = string;
export type SlideId = string;
export type SlideElementId = string;
export type SlideGroupId = SlideElementId;
export type ShapeId = SlideElementId;

export type SlideLifecycle = "active" | "archived" | "trashed";
export type SlideOrigin = "interactive" | "agent" | "automation";

export interface DeckHead {
  id: DeckId;
  title: string;
  lifecycle: SlideLifecycle;
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
  lifecycle: SlideLifecycle;
  canvas: SlideCanvas;
  styles: SlideStyleRegistry;
  slideOrder: SlideId[];
  slides: Record<SlideId, Slide>;
}

export interface SlideCanvas {
  widthPt: number;
  heightPt: number;
}

export type SlideShapeKind = SlideShape["shapeKind"];

export interface SlideStyleRegistry {
  defaultStyleIdByShapeKind: Record<SlideShapeKind, string>;
  styles: SlideStyle[];
}

export interface SlideStyle {
  id: string;
  name: string;
  basedOnStyleId?: string;
  visual: SlideVisualStyleProperties;
  text: TextStyleProperties;
}

export interface SlideVisualStyleProperties {
  opacity?: number;
  fill?: FillStyle;
  stroke?: StrokeStyle;
  shadow?: ShadowStyle;
}

export type SlideColor = string;

export type FillStyle =
  | { kind: "none" }
  | { kind: "solid"; color: SlideColor };

export type StrokeStyle =
  | { kind: "none" }
  | {
      kind: "stroke";
      color: SlideColor;
      widthPt: number;
      dash: "solid" | "dashed" | "dotted";
    };

export type ShadowStyle =
  | { kind: "none" }
  | {
      kind: "drop";
      color: SlideColor;
      offsetXPt: number;
      offsetYPt: number;
      blurPt: number;
    };

export interface ShapePresentationOverride {
  visual?: SlideVisualStyleProperties;
  text?: TextStyleProperties;
}

export interface Slide {
  id: SlideId;
  title?: string;
  background: SlideBackground;
  notes: RichContent;
  rootElementIds: SlideElementId[];
  elements: Record<SlideElementId, SlideElement>;
}

export type SlideBackground =
  | { kind: "transparent" }
  | { kind: "solid"; color: SlideColor }
  | {
      kind: "image";
      source: ImageSnapshotRef;
      fit: "contain" | "cover" | "stretch";
    };

export interface SlideElementBase {
  id: SlideElementId;
  locked: boolean;
  hidden: boolean;
}

export interface SlideGroup extends SlideElementBase {
  elementKind: "group";
  childElementIds: SlideElementId[];
}

export interface ShapeBase extends SlideElementBase {
  elementKind: "shape";
  frame: ShapeFrame;
  transform: ShapeTransform;
  styleId: string;
  presentation?: ShapePresentationOverride;
}

export interface ShapeFrame {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

export interface ShapeTransform {
  rotationDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface TextBoxPresentation {
  paddingPt: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  horizontalAlign: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "middle" | "bottom";
  overflow: "clip" | "shrink";
}

export interface TextShape extends ShapeBase {
  shapeKind: "text";
  content: RichContent;
  textBox: TextBoxPresentation;
}

export interface PromptContentShape extends ShapeBase {
  shapeKind: "prompt-content";
  output: DerivedOutputRef;
  textBox: TextBoxPresentation;
}

export type GeometryDefinition =
  | { kind: "rectangle" }
  | { kind: "rounded-rectangle"; cornerRadiusPt: number }
  | { kind: "ellipse" }
  | { kind: "triangle" }
  | { kind: "diamond" }
  | { kind: "arrow" };

export interface GeometryShape extends ShapeBase {
  shapeKind: "geometry";
  geometry: GeometryDefinition;
}

export interface UnitPoint {
  x: number;
  y: number;
}

export type LineDecoration = "none" | "arrow" | "circle" | "diamond";

export interface LineDefinition {
  start: UnitPoint;
  end: UnitPoint;
  startDecoration: LineDecoration;
  endDecoration: LineDecoration;
}

export interface LineShape extends ShapeBase {
  shapeKind: "line";
  line: LineDefinition;
}

export interface ImageSnapshotRef {
  fileId: string;
  version: string;
  digest: string;
  mimeType: string;
}

export interface NormalizedCrop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ImageShapeData {
  source: ImageSnapshotRef;
  crop?: NormalizedCrop;
  fit: "contain" | "cover" | "stretch";
  alt: string;
  decorative: boolean;
}

export interface ImageShape extends ShapeBase {
  shapeKind: "image";
  image: ImageShapeData;
}

export interface AcceptedSlideValue {
  value: FormulaWireValue;
}

export interface TablePresentation {
  headerRow: boolean;
  bandedRows: boolean;
  firstColumnHeader: boolean;
  lastColumnFooter: boolean;
  columnWidthsPt?: number[];
}

export interface TableShapeData {
  accepted: AcceptedSlideValue;
  presentation: TablePresentation;
}

export interface TableShape extends ShapeBase {
  shapeKind: "table";
  table: TableShapeData;
}

export interface AxisSpecification {
  label?: string;
  min?: number;
  max?: number;
}

export interface ChartSpecification {
  kind: "bar" | "line" | "pie" | "scatter" | "area";
  title?: string;
  xAxis?: AxisSpecification;
  yAxis?: AxisSpecification;
  legend: { position: "top" | "bottom" | "left" | "right" | "none" };
  colors?: SlideColor[];
}

export interface ChartShapeData {
  accepted: AcceptedSlideValue;
  specification: ChartSpecification;
}

export interface ChartShape extends ShapeBase {
  shapeKind: "chart";
  chart: ChartShapeData;
}

export type SlideShape =
  | TextShape
  | PromptContentShape
  | GeometryShape
  | LineShape
  | ImageShape
  | TableShape
  | ChartShape;

export type SlideElement = SlideGroup | SlideShape;

export interface ElementPlacement {
  parentGroupId?: SlideGroupId;
  afterElementId?: SlideElementId;
}

export type SlideOperation =
  | { type: "deck.rename"; title: string }
  | { type: "deck.set-lifecycle"; lifecycle: SlideLifecycle }
  | { type: "deck.set-canvas"; canvas: SlideCanvas }
  | { type: "style.create"; style: SlideStyle }
  | { type: "style.update"; styleId: string; style: SlideStyle }
  | { type: "style.delete"; styleId: string; replacementStyleId: string }
  | { type: "style.set-default"; shapeKind: SlideShapeKind; styleId: string }
  | { type: "slide.insert"; slide: Slide; afterSlideId?: SlideId }
  | { type: "slide.move"; slideId: SlideId; afterSlideId?: SlideId }
  | { type: "slide.delete"; slideId: SlideId }
  | { type: "slide.set-title"; slideId: SlideId; title?: string }
  | { type: "slide.set-background"; slideId: SlideId; background: SlideBackground }
  | { type: "notes.apply"; slideId: SlideId; operations: RichTextOperation[] }
  | { type: "group.create"; slideId: SlideId; group: SlideGroup }
  | { type: "group.ungroup"; slideId: SlideId; groupId: SlideGroupId }
  | { type: "shape.insert"; slideId: SlideId; shape: SlideShape; placement: ElementPlacement }
  | {
      /** Exact inverse primitive. Public submit must reject this operation. */
      type: "element.restore-subtree";
      slideId: SlideId;
      rootElementId: SlideElementId;
      elements: SlideElement[];
      placement: ElementPlacement;
      /** Existing element atomically adopted by a restored pruned Group chain. */
      adoptedElementId?: SlideElementId;
    }
  | { type: "element.move"; slideId: SlideId; elementId: SlideElementId; placement: ElementPlacement }
  | { type: "element.delete"; slideId: SlideId; elementId: SlideElementId }
  | { type: "element.set-locked"; slideId: SlideId; elementId: SlideElementId; locked: boolean }
  | { type: "element.set-hidden"; slideId: SlideId; elementId: SlideElementId; hidden: boolean }
  | { type: "shape.set-frame"; slideId: SlideId; shapeId: ShapeId; frame: ShapeFrame }
  | { type: "shape.set-transform"; slideId: SlideId; shapeId: ShapeId; transform: ShapeTransform }
  | { type: "shape.set-style"; slideId: SlideId; shapeId: ShapeId; styleId: string }
  | {
      type: "shape.set-presentation";
      slideId: SlideId;
      shapeId: ShapeId;
      presentation?: ShapePresentationOverride;
    }
  | { type: "text-box.set-presentation"; slideId: SlideId; shapeId: ShapeId; textBox: TextBoxPresentation }
  | { type: "text.apply"; slideId: SlideId; shapeId: ShapeId; operations: RichTextOperation[] }
  | {
      /** Internal settlement only; output identity cannot change. */
      type: "prompt-content.apply-derived-output";
      slideId: SlideId;
      shapeId: ShapeId;
      output: DerivedOutputRef;
    }
  | { type: "geometry.set"; slideId: SlideId; shapeId: ShapeId; geometry: GeometryDefinition }
  | { type: "line.set"; slideId: SlideId; shapeId: ShapeId; line: LineDefinition }
  | { type: "image.set"; slideId: SlideId; shapeId: ShapeId; image: ImageShapeData }
  | { type: "table.set"; slideId: SlideId; shapeId: ShapeId; table: TableShapeData }
  | { type: "chart.set"; slideId: SlideId; shapeId: ShapeId; chart: ChartShapeData };

export interface SlideBase {
  representationVersion: 1;
  deckId: DeckId;
  baseSeq: number;
  snapshot: DeckSnapshot;
  semanticDigest: string;
  createdAt: string;
}

export interface SlideChangeSet {
  id: string;
  deckId: DeckId;
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

export interface SlideCommittedFact {
  factId: string;
  kind: "slide.created" | "slide.changed" | "slide.compensated";
  deckId: DeckId;
  revision: number;
  changeSetId?: string;
  actorId?: string;
  origin: SlideOrigin;
  operationTypes: string[];
  semanticDigest: string;
  occurredAt: string;
}

export interface SlideSubmissionReceipt {
  deckId: DeckId;
  requestId: string;
  requestDigest: string;
  result: SlideCommandResult;
  createdAt: string;
}

export interface SlideDelegatedCommandClaim {
  deckId: DeckId;
  requestId: string;
  requestDigest: string;
  kind: "prompt-content.update-definition";
  targetOutputId: string;
  state: "pending" | "completed";
  createdAt: string;
  updatedAt: string;
}

export type SlideAttemptState =
  | "requested"
  | "computing"
  | "proposed"
  | "settled"
  | "unchanged"
  | "stale"
  | "failed";

export interface SlideAttemptBase {
  id: string;
  deckId: DeckId;
  clientRequestId: string;
  requestDigest: string;
  slideId: SlideId;
  shapeId: ShapeId;
  frozenDeckRevision: number;
  state: SlideAttemptState;
  settledChangeSetId?: string;
  diagnostic?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

export interface PromptContentCreationAttempt extends SlideAttemptBase {
  kind: "prompt-content-create";
  frame: ShapeFrame;
  transform: ShapeTransform;
  styleId: string;
  presentation?: ShapePresentationOverride;
  textBox: TextBoxPresentation;
  placement: ElementPlacement;
  definition: {
    prompt: string;
    contextEntries: ContextEntry[];
    stabilisationText: string;
  };
  candidateOutputId?: string;
  candidateHeadRevision?: number;
}

export interface PromptContentRefreshAttempt extends SlideAttemptBase {
  kind: "prompt-content-refresh";
  outputId: string;
  frozenAppliedRevision: number;
  candidateHeadRevision?: number;
}

export type SlideAttempt =
  | PromptContentCreationAttempt
  | PromptContentRefreshAttempt;

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

export interface PromptContentOutputOwnership {
  outputId: string;
  deckId: DeckId;
  slideId: SlideId;
  shapeId: ShapeId;
  creationAttemptId?: string;
  state: "pending" | "attached" | "detached";
  attachedRevision?: number;
  detachedRevision?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SlideCommandRequest {
  requestId: string;
  origin: SlideOrigin;
  command: SlideCommand;
}

export type SlideCommand =
  | {
      type: "deck.create";
      deckId: DeckId;
      title: string;
      initialSlideId: SlideId;
      canvas?: SlideCanvas;
      styles?: SlideStyleRegistry;
    }
  | {
      type: "deck.submit";
      deckId: DeckId;
      expectedRevision: number;
      operations: SlideOperation[];
    }
  | {
      type: "deck.compensate";
      deckId: DeckId;
      targetChangeSetId: string;
      intent: "undo" | "redo";
      expectedRevision: number;
    }
  | {
      type: "prompt-content.create.request";
      deckId: DeckId;
      expectedRevision: number;
      slideId: SlideId;
      shapeId: ShapeId;
      frame: ShapeFrame;
      transform?: ShapeTransform;
      styleId: string;
      presentation?: ShapePresentationOverride;
      textBox: TextBoxPresentation;
      placement: ElementPlacement;
      prompt: string;
      contextEntries: ContextEntry[];
      stabilisationText: string;
    }
  | {
      type: "prompt-content.update-definition";
      deckId: DeckId;
      promptContentShapeId: ShapeId;
      expectedDefinitionRevision: number;
      prompt: string;
      contextEntries: ContextEntry[];
      stabilisationText: string;
    }
  | {
      type: "prompt-content.refresh.request";
      deckId: DeckId;
      promptContentShapeId: ShapeId;
      expectedRevision: number;
    };

export type SlideCommandResult =
  | { type: "deck.created"; head: DeckHead }
  | { type: "deck.changed"; changeSet: SlideChangeSet }
  | { type: "prompt-content.create-requested"; attemptId: string }
  | { type: "prompt-content.definition-updated"; output: DerivedOutput }
  | { type: "prompt-content.refresh-requested"; attemptId: string };

export interface SlideQueryRequest {
  requestId: string;
  query: SlideQuery;
}

export type SlideQuery =
  | { type: "deck.list"; cursor?: string; lifecycle?: SlideLifecycle }
  | { type: "deck.load"; deckId: DeckId; revision?: number }
  | { type: "deck.history"; deckId: DeckId; cursor?: string; limit: number }
  | { type: "deck.attempt"; deckId: DeckId; attemptId: string };

export type SlideQueryResult =
  | { type: "deck.listed"; items: DeckHead[]; nextCursor?: string }
  | {
      type: "deck.loaded";
      head: DeckHead;
      snapshot: DeckSnapshot;
      promptContentRevisions: DerivedOutputRevision[];
    }
  | { type: "deck.history"; items: SlideChangeSet[]; nextCursor?: string }
  | { type: "deck.attempt"; attempt: SlideAttempt };

export type SlideInternalJobIntent =
  | { type: "slide.compact"; deckId: DeckId; idempotencyKey: string }
  | { type: "slide.prompt-content.create.compute"; attemptId: string; idempotencyKey: string }
  | { type: "slide.prompt-content.create.settle"; attemptId: string; idempotencyKey: string }
  | { type: "slide.prompt-content.refresh.compute"; attemptId: string; idempotencyKey: string }
  | { type: "slide.prompt-content.refresh.settle"; attemptId: string; idempotencyKey: string };

export interface SlideHistoryRetention {
  retainedBaseCount: number;
  retainedChangeSetCount: number;
  retainedTerminalAttemptCount: number;
}

export interface SlideLimits {
  maxSlidesPerDeck: number;
  maxElementsPerSlide: number;
  maxGroupNestingDepth: number;
  maxStylesPerDeck: number;
  maxAtomsPerRichContent: number;
  maxAcceptedValueNodes: number;
  maxFrameDimensionPt: number;
}

export interface SlideOptions {
  history: SlideHistoryRetention;
  limits: SlideLimits;
}

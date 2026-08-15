import type {
  ActiveLifecycle,
  BinaryContent,
  BoxStyle,
  Color,
  ContentSourceRef,
  Diagnostic,
  Digest,
  EntityId,
  Frame,
  Insets,
  ISODateTime,
  JsonObject,
  Lifecycle,
  Metadata,
  OrderedChild,
  PersistedRecord,
  ResourceKind,
  ResourceRef,
  Size,
  StructuredDataRef,
  Transform,
} from './core.js';
import type {
  BlockPlacement,
  PinnedRichBlockRef,
  RichBlock,
  RichBlockKind,
  RichBlockRef,
} from './rich-blocks.js';

export interface ResourceRecord<Kind extends ResourceKind, State>
  extends PersistedRecord<Kind> {
  kind: Kind;
  title: string;
  lifecycle: Lifecycle;
  deletedAt?: ISODateTime;
  metadata: Metadata;
  state: State;
}

// Documents: rows place universal RichBlocks.

export interface DocumentPageLayout {
  pageSize: Size;
  orientation: 'portrait' | 'landscape';
  margins: Insets;
  columns?: number;
  pageGap?: number;
}

export interface DocumentRowLayout {
  columns: number;
  gap: number;
  minHeight?: number;
  keepTogether?: boolean;
}

export interface DocumentBlockLayout {
  widthUnits: number;
  minHeight?: number;
  padding?: Insets;
  horizontalAlign?: 'start' | 'center' | 'end' | 'stretch';
  verticalAlign?: 'start' | 'center' | 'end' | 'stretch';
  overflow?: 'visible' | 'clip' | 'scroll';
  style?: BoxStyle;
}

export type DocumentBlockPlacement<Kind extends RichBlockKind = RichBlockKind> =
  BlockPlacement<DocumentBlockLayout, Kind>;

export interface DocumentRow extends OrderedChild<'document_row'> {
  layout: DocumentRowLayout;
  blocks: DocumentBlockPlacement[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DocumentState {
  pageLayout: DocumentPageLayout;
  styleRegistry: Record<string, BoxStyle>;
  settings: JsonObject;
  semanticDigest: Digest;
  rows: DocumentRow[];
}

export type Document = ResourceRecord<'document', DocumentState>;

// Slides: visual objects are containers whose content is RichBlocks.

export interface SlideTheme {
  colors: Record<string, Color>;
  fonts: Record<string, string>;
  spacing?: Record<string, number>;
  defaults?: JsonObject;
}

export interface SlideElementBase<Kind extends string>
  extends OrderedChild<'slide_element'> {
  kind: Kind;
  parentGroupId?: EntityId<'slide_element'>;
  locked: boolean;
  hidden: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SlideGroupElement extends SlideElementBase<'group'> {
  name?: string;
}

export interface SlideBlockLayout {
  frame?: Frame;
  padding?: Insets;
  overflow?: 'visible' | 'clip' | 'scroll';
  fit?: 'contain' | 'cover' | 'fill';
}

export interface SlideVisualElement extends SlideElementBase<'visual'> {
  frame: Frame;
  transform?: Transform;
  shape: 'plain' | 'rectangle' | 'ellipse';
  style?: BoxStyle;
  blocks: Array<BlockPlacement<SlideBlockLayout>>;
}

export interface SlideConnectorElement extends SlideElementBase<'connector'> {
  from: { elementId?: EntityId<'slide_element'>; point: { x: number; y: number } };
  to: { elementId?: EntityId<'slide_element'>; point: { x: number; y: number } };
  style?: JsonObject;
  labelBlocks: Array<BlockPlacement<SlideBlockLayout, 'text'>>;
}

export type SlideElement =
  | SlideGroupElement
  | SlideVisualElement
  | SlideConnectorElement;

export interface Slide extends OrderedChild<'slide'> {
  title?: string;
  size: Size;
  background: BoxStyle;
  notes: RichBlockRef<'text'>[];
  elements: SlideElement[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SlideDeckState {
  theme: SlideTheme;
  deckMetadata: JsonObject;
  presentationSettings: JsonObject;
  slides: Slide[];
}

export type SlideDeck = ResourceRecord<'slides', SlideDeckState>;

// Spreadsheets: every populated cell contains one or more RichBlocks.

export interface SheetAxis extends OrderedChild<'sheet_axis'> {
  axis: 'row' | 'column';
  size?: number;
  hidden: boolean;
  metadata: Metadata;
}

export interface SheetRange {
  rowIds: EntityId<'sheet_axis'>[];
  columnIds: EntityId<'sheet_axis'>[];
}

export interface SheetCellCalculation {
  /** FormulaAtom inside a text block listed in this cell's blocks. */
  formula: {
    block: PinnedRichBlockRef<'text'>;
    atomId: EntityId<'text_atom'>;
  };
  state: 'ready' | 'pending' | 'error';
  dependencies: ContentSourceRef[];
  diagnostics: Diagnostic[];
  /** Ties the cell index to the canonical projection in the text block. */
  acceptedDisplayDigest?: Digest;
  evaluatedAt?: ISODateTime;
}

export interface SheetCell {
  id: EntityId<'sheet_cell'>;
  anchorRowId: EntityId<'sheet_axis'>;
  anchorColumnId: EntityId<'sheet_axis'>;
  span: SheetRange;
  blocks: RichBlockRef[];
  calculation?: SheetCellCalculation;
  style: BoxStyle & {
    numberFormat?: string;
    horizontalAlign?: 'left' | 'center' | 'right';
  };
  validation?: {
    kind: 'list' | 'number_range' | 'custom_formula';
    allowBlank: boolean;
    payload: JsonObject;
    message?: string;
  };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface NamedRangeObject {
  id: EntityId<'sheet_object'>;
  kind: 'named_range';
  name: string;
  targetRange: SheetRange;
}

export interface SheetTableObject {
  id: EntityId<'sheet_object'>;
  kind: 'table';
  name?: string;
  targetRange: SheetRange;
  headerRowCount: number;
  style?: JsonObject;
}

export interface SheetChartObject {
  id: EntityId<'sheet_object'>;
  kind: 'chart';
  name?: string;
  targetRange: SheetRange;
  chartType: 'bar' | 'line' | 'scatter';
  frame: Frame;
  specification: JsonObject;
}

export type SheetObject = NamedRangeObject | SheetTableObject | SheetChartObject;

export interface Sheet extends OrderedChild<'sheet'> {
  title: string;
  freezeState: { rowCount: number; columnCount: number };
  defaults: JsonObject;
  rules: JsonObject[];
  overlays: JsonObject[];
  axes: SheetAxis[];
  /** Sparse: an empty coordinate has no cell object. */
  cells: SheetCell[];
  objects: SheetObject[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WorkbookState {
  calculationSettings: {
    mode: 'automatic' | 'manual';
    iterative?: boolean;
    maxIterations?: number;
  };
  workbookMetadata: JsonObject;
  sheets: Sheet[];
}

export type Workbook = ResourceRecord<'spreadsheet', WorkbookState>;

// Files and templates.

export interface GeneralFileState {
  fileName: string;
  extension?: string;
  mimeType: string;
  fileMetadata: Metadata;
  byteSize: number;
  contentHash: Digest;
  content: BinaryContent;
}

export type GeneralFile = ResourceRecord<'file', GeneralFileState>;

export type AuthoredResource = Document | SlideDeck | Workbook | GeneralFile;

export interface TemplateSlotBase<Kind extends string> {
  id: EntityId<'template_slot'>;
  name: string;
  description?: string;
  valueKind: Kind;
  required: boolean;
}

export interface TextBlockTemplateSlot extends TemplateSlotBase<'text_block'> {
  defaultValue?: RichBlockRef<'text'>;
}

export interface ResourceTemplateSlot extends TemplateSlotBase<'resource'> {
  defaultValue?: ResourceRef;
}

export interface StructuredDataTemplateSlot
  extends TemplateSlotBase<'structured_data'> {
  defaultValue?: StructuredDataRef;
}

export type TemplateSlot =
  | TextBlockTemplateSlot
  | ResourceTemplateSlot
  | StructuredDataTemplateSlot;

export type ResourceStateSnapshot =
  | { kind: 'document'; state: DocumentState }
  | { kind: 'slides'; state: SlideDeckState }
  | { kind: 'spreadsheet'; state: WorkbookState };

export interface TemplateBase<Target extends string, Snapshot>
  extends PersistedRecord<'template'> {
  name: string;
  description: string;
  lifecycle: ActiveLifecycle;
  deletedAt?: ISODateTime;
  targetKind: Target;
  sourceResourceId?: EntityId<ResourceKind>;
  slots: TemplateSlot[];
  snapshot: Snapshot;
  /** Self-contained, template-owned blocks referenced by snapshot and slots. */
  blocks: RichBlock[];
  payloadDigest: Digest;
}

export type Template =
  | TemplateBase<'document', { kind: 'document'; state: DocumentState }>
  | TemplateBase<'slides', { kind: 'slides'; state: SlideDeckState }>
  | TemplateBase<'spreadsheet', { kind: 'spreadsheet'; state: WorkbookState }>
  | TemplateBase<'board', { kind: 'board'; state: JsonObject }>;

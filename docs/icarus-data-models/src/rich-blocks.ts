import type {
  ActiveLifecycle,
  Color,
  ContentSourceRef,
  Diagnostic,
  Digest,
  DomainValue,
  EntityId,
  ISODateTime,
  JsonObject,
  Metadata,
  MutationId,
  OrderedChild,
  PersistedRecord,
  ProjectId,
} from './core.js';

/**
 * RichBlock is Icarus's universal content aggregate. Surfaces own placement,
 * dimensions, and overflow; blocks own semantic content.
 */
export type RichBlockKind = 'text' | 'image' | 'table' | 'link';

export interface LiveRichBlockRef<Kind extends RichBlockKind = RichBlockKind> {
  refKind: 'live';
  blockKind: Kind;
  blockId: EntityId<'rich_block'>;
}

export interface PinnedRichBlockRef<Kind extends RichBlockKind = RichBlockKind> {
  refKind: 'pinned';
  blockKind: Kind;
  blockId: EntityId<'rich_block'>;
  revision: number;
}

export type RichBlockRef<Kind extends RichBlockKind = RichBlockKind> =
  | LiveRichBlockRef<Kind>
  | PinnedRichBlockRef<Kind>;

/**
 * A block has one canonical owner. Other objects may reference it, but copying
 * content into a new owner creates new block, atom, mark, and placement IDs.
 */
export type RichBlockOwnerRef =
  | { ownerKind: 'project'; ownerId: ProjectId }
  | { ownerKind: 'rich_block'; ownerId: EntityId<'rich_block'> }
  | { ownerKind: 'document'; ownerId: EntityId<'document'> }
  | { ownerKind: 'slides'; ownerId: EntityId<'slides'> }
  | { ownerKind: 'spreadsheet'; ownerId: EntityId<'spreadsheet'> }
  | { ownerKind: 'board'; ownerId: EntityId<'board'> }
  | { ownerKind: 'template'; ownerId: EntityId<'template'> }
  | { ownerKind: 'derived_output'; ownerId: EntityId<'derived_output'> }
  | { ownerKind: 'question'; ownerId: EntityId<'question'> }
  | { ownerKind: 'hypothesis'; ownerId: EntityId<'hypothesis'> }
  | { ownerKind: 'finding'; ownerId: EntityId<'finding'> }
  | { ownerKind: 'research_message'; ownerId: EntityId<'research_message'> }
  | { ownerKind: 'persona'; ownerId: EntityId<'persona'> }
  | { ownerKind: 'agent_task'; ownerId: EntityId<'agent_task'> }
  | { ownerKind: 'agent_task_message'; ownerId: EntityId<'agent_task_message'> }
  | { ownerKind: 'agent_task_request'; ownerId: EntityId<'agent_task_request'> }
  | { ownerKind: 'automation'; ownerId: EntityId<'automation'> }
  | { ownerKind: 'comment'; ownerId: EntityId<'comment'> }
  | { ownerKind: 'memory_entry'; ownerId: EntityId<'memory_entry'> };

export interface RichBlockBase<Kind extends RichBlockKind, State>
  extends PersistedRecord<'rich_block'> {
  blockKind: Kind;
  owner: RichBlockOwnerRef;
  lifecycle: ActiveLifecycle;
  deletedAt?: ISODateTime;
  metadata: Metadata;
  state: State;
  /** Owner-supplied ID used to deduplicate block mutations. */
  lastMutationId?: MutationId;
}

export interface BlockPlacement<
  Layout,
  Kind extends RichBlockKind = RichBlockKind,
> extends OrderedChild<'block_placement'> {
  block: RichBlockRef<Kind>;
  layout: Layout;
}

// Text blocks: raw editor structure plus accepted display projection.

export interface TextPosition {
  atomId: EntityId<'text_atom'>;
  offset: number;
}

export interface TextRange {
  from: TextPosition;
  to: TextPosition;
}

export interface TextAtom {
  id: EntityId<'text_atom'>;
  kind: 'text';
  text: string;
}

export interface FormulaAtom {
  id: EntityId<'text_atom'>;
  kind: 'formula';
  expression: string;
  language: 'icarus_formula';
}

export interface ReferenceAtom {
  id: EntityId<'text_atom'>;
  kind: 'reference';
  target: ContentSourceRef;
  label?: string;
}

export type RawTextAtom = TextAtom | FormulaAtom | ReferenceAtom;

export interface TextStyleMark {
  id: EntityId<'text_mark'>;
  kind: 'text_style';
  range: TextRange;
  styles: Array<'bold' | 'italic' | 'underline' | 'strikethrough' | 'code'>;
}

export interface LinkMark {
  id: EntityId<'text_mark'>;
  kind: 'link';
  range: TextRange;
  target: ContentSourceRef;
  title?: string;
}

export interface AnnotationMark {
  id: EntityId<'text_mark'>;
  kind: 'annotation';
  range: TextRange;
  threadId: EntityId<'comment_thread'>;
}

export type RawTextMark = TextStyleMark | LinkMark | AnnotationMark;

export interface RawTextContent {
  baseStyle?: {
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    color?: Color;
    textAlign?: 'start' | 'center' | 'end' | 'justify';
    direction?: 'ltr' | 'rtl' | 'auto';
  };
  atoms: RawTextAtom[];
  marks: RawTextMark[];
  digest: Digest;
}

export interface DisplayTextSegmentBase<Kind extends string> {
  sourceAtomId: EntityId<'text_atom'>;
  kind: Kind;
  /** Location of this segment in the accepted display string. */
  range: DisplayTextRange;
  text: string;
}

export type DisplayLiteralSegment = DisplayTextSegmentBase<'text'>;

export interface DisplayFormulaSegment
  extends DisplayTextSegmentBase<'resolved_value'> {
  value: DomainValue;
  dependencies: ContentSourceRef[];
  diagnostics: Diagnostic[];
  resolvedAt: ISODateTime;
}

export interface DisplayReferenceSegment
  extends DisplayTextSegmentBase<'resolved_reference'> {
  target: ContentSourceRef;
  dependencies: ContentSourceRef[];
  diagnostics: Diagnostic[];
  resolvedAt: ISODateTime;
}

export type DisplayTextSegment =
  | DisplayLiteralSegment
  | DisplayFormulaSegment
  | DisplayReferenceSegment;

export interface DisplayTextRange {
  /** UTF-16 offset into DisplayTextContent.text, matching JavaScript slicing. */
  from: number;
  /** Exclusive UTF-16 offset. */
  to: number;
}

export type DisplayTextMark =
  | {
      sourceMarkId: EntityId<'text_mark'>;
      kind: 'text_style';
      range: DisplayTextRange;
      styles: TextStyleMark['styles'];
    }
  | {
      sourceMarkId: EntityId<'text_mark'>;
      kind: 'link';
      range: DisplayTextRange;
      target: ContentSourceRef;
      title?: string;
    }
  | {
      sourceMarkId: EntityId<'text_mark'>;
      kind: 'annotation';
      range: DisplayTextRange;
      threadId: EntityId<'comment_thread'>;
    };

export interface DisplayTextContent {
  text: string;
  segments: DisplayTextSegment[];
  /** Raw marks projected onto the accepted display string. */
  marks: DisplayTextMark[];
  sourceRawDigest: Digest;
  digest: Digest;
  acceptedAt: ISODateTime;
}

export type TextBlockDisplay =
  | {
      state: 'pending';
      sourceRawDigest: Digest;
      previous?: DisplayTextContent;
    }
  | {
      state: 'accepted';
      content: DisplayTextContent;
    }
  | {
      state: 'stale';
      currentRawDigest: Digest;
      content: DisplayTextContent;
    }
  | {
      state: 'failed';
      sourceRawDigest: Digest;
      diagnostics: Diagnostic[];
      previous?: DisplayTextContent;
    };

export interface TextBlockState {
  raw: RawTextContent;
  display: TextBlockDisplay;
}

export type TextRichBlock = RichBlockBase<'text', TextBlockState>;

// Image, table, and link blocks.

export interface ImageBlockState {
  fileId: EntityId<'file'>;
  altText: string;
  caption?: RichBlockRef<'text'>;
  crop?: { x: number; y: number; width: number; height: number };
  focalPoint?: { x: number; y: number };
}

export type ImageRichBlock = RichBlockBase<'image', ImageBlockState>;

export interface RichTableCell {
  id: EntityId<'rich_table_cell'>;
  rowSpan: number;
  columnSpan: number;
  blocks: RichBlockRef[];
  style?: JsonObject;
}

export interface RichTableRow extends OrderedChild<'rich_table_row'> {
  cells: RichTableCell[];
}

export interface TableBlockState {
  rows: RichTableRow[];
  headerRows: number;
  columnWidths?: number[];
  style?: JsonObject;
}

export type TableRichBlock = RichBlockBase<'table', TableBlockState>;

export interface LinkBlockState {
  target: ContentSourceRef;
  label: RichBlockRef<'text'>;
  presentation: 'inline' | 'card' | 'embed';
  description?: RichBlockRef<'text'>;
  preview?: JsonObject;
}

export type LinkRichBlock = RichBlockBase<'link', LinkBlockState>;

export type RichBlock =
  | TextRichBlock
  | ImageRichBlock
  | TableRichBlock
  | LinkRichBlock;

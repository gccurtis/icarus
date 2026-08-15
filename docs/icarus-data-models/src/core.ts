/** Shared, storage-neutral primitives for persisted Icarus objects. */

export type Brand<Value, Name extends string> = Value & {
  readonly __brand: Name;
};

export type EntityId<Kind extends string = string> = Brand<string, `${Kind}Id`>;
export type ProjectId = EntityId<'project'>;
export type ActorId = EntityId<'actor'>;
export type UserId = EntityId<'user'>;
export type ISODateTime = Brand<string, 'ISODateTime'>;
export type Rank = Brand<string, 'Rank'>;
export type Digest = Brand<string, 'Digest'>;
export type MutationId = Brand<string, 'MutationId'>;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type Metadata = JsonObject;
export type Lifecycle = 'active' | 'archived' | 'deleted';
export type ActiveLifecycle = 'active' | 'deleted';

export interface ProjectScoped {
  /** Retained even when a physical database is project-bound. */
  projectId: ProjectId;
}

export interface Revisioned {
  /** Compare-and-swap value. Every accepted aggregate mutation increments once. */
  revision: number;
  /** Version of the serialized object shape, used by upcasters. */
  schemaVersion: number;
}

export interface Timestamped {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PersistedRecord<Kind extends string>
  extends ProjectScoped,
    Revisioned,
    Timestamped {
  id: EntityId<Kind>;
  createdBy: ActorId;
  updatedBy: ActorId;
}

export interface SoftDeleted {
  lifecycle: Lifecycle;
  deletedAt?: ISODateTime;
}

export interface OrderedChild<Kind extends string> {
  id: EntityId<Kind>;
  rank: Rank;
}

export interface ActorRef {
  kind: 'user' | 'agent_task' | 'automation' | 'system';
  id: ActorId;
  label?: string;
}

export interface EntityRef<Kind extends string = string> {
  entityKind: Kind;
  entityId: EntityId<Kind>;
}

export type ResourceKind =
  | 'document'
  | 'slides'
  | 'spreadsheet'
  | 'file'
  | 'board';

export interface LiveResourceRef<Kind extends ResourceKind = ResourceKind> {
  refKind: 'live';
  resourceKind: Kind;
  resourceId: EntityId<Kind>;
}

export interface PinnedResourceRef<Kind extends ResourceKind = ResourceKind> {
  refKind: 'pinned';
  resourceKind: Kind;
  resourceId: EntityId<Kind>;
  revision: number;
}

export type ResourceRef<Kind extends ResourceKind = ResourceKind> =
  | LiveResourceRef<Kind>
  | PinnedResourceRef<Kind>;

export interface ExternalUrlRef {
  refKind: 'url';
  url: string;
  capturedAt?: ISODateTime;
  contentDigest?: Digest;
}

export interface StructuredDataRef {
  refKind: 'structured_data';
  entryId: EntityId<'structured_entry'>;
  revision?: number;
  rowId?: EntityId<'structured_row'>;
  columnId?: EntityId<'structured_column'>;
}

export interface AnalysisResultRef {
  refKind: 'analysis_result';
  analysisId: EntityId<'analysis'>;
  executionId: EntityId<'analysis_execution'>;
  resultId: EntityId<'analysis_result'>;
}

export interface DerivedOutputRef {
  refKind: 'derived_output';
  outputId: EntityId<'derived_output'>;
  revision: number;
}

export interface RichBlockSourceRef {
  refKind: 'rich_block';
  blockId: EntityId<'rich_block'>;
  revision?: number;
  atomId?: EntityId<'text_atom'>;
}

export interface SpreadsheetCellSourceRef {
  refKind: 'spreadsheet_cell';
  workbookId: EntityId<'spreadsheet'>;
  sheetId: EntityId<'sheet'>;
  cellId: EntityId<'sheet_cell'>;
  workbookRevision?: number;
}

export interface ResourceRegionSourceRef {
  refKind: 'resource_region';
  resource: ResourceRef;
  /** Owner-defined stable locator, such as a document row or slide element. */
  locator: JsonObject;
}

export type ContentSourceRef =
  | ResourceRef
  | ExternalUrlRef
  | StructuredDataRef
  | AnalysisResultRef
  | DerivedOutputRef
  | RichBlockSourceRef
  | SpreadsheetCellSourceRef
  | ResourceRegionSourceRef;

export type ScalarValue = string | number | boolean | null;

export interface DateValue {
  kind: 'date';
  value: string;
}

export interface DateTimeValue {
  kind: 'datetime';
  value: ISODateTime;
}

export interface DurationValue {
  kind: 'duration';
  milliseconds: number;
}

export type DomainValue = ScalarValue | DateValue | DateTimeValue | DurationValue;

export interface Diagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  locator?: JsonObject;
}

export interface FailureDetail {
  code: string;
  message: string;
  retryable: boolean;
  details?: JsonObject;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Frame extends Point, Size {}

export interface Transform {
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  skewY?: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Color {
  value: string;
  opacity?: number;
}

export interface BorderStyle {
  color: Color;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
}

export interface BoxStyle {
  fill?: Color;
  border?: BorderStyle;
  radius?: number;
  opacity?: number;
}

export type BinaryContent =
  | {
      storageKind: 'inline';
      base64: string;
    }
  | {
      storageKind: 'object';
      objectKey: string;
      bucket?: string;
      region?: string;
    };

export interface IdempotentCommand {
  idempotencyKey: string;
  inputDigest: Digest;
}

export interface AcceptedMutation {
  mutationId: MutationId;
  expectedRevision: number;
}

import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type {
  DocumentChangeTier,
  DocumentSnapshotRole
} from "$representation/data/types/documents/snapshot";
import type { PresentationBody } from "$representation/data/types/presentations/body";
import type { PresentationOp } from "$representation/data/types/presentations/op";
import type {
  PresentationChangeTier,
  PresentationSnapshotRole
} from "$representation/data/types/presentations/snapshot";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { SheetCell as SheetCellData } from "$representation/data/types/spreadsheets/cell";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type {
  SpreadsheetChangeTier,
  SpreadsheetSnapshotRole
} from "$representation/data/types/spreadsheets/snapshot";

export type DocumentSnapshotFields = {
  projectId: Id<"projects">;
  resourceId: Id<"documents">;
  revision: number;
  role: DocumentSnapshotRole;
  part: number;
  body: DocumentBody;
  at: number;
};
export type DocumentSnapshot = Row<"documentSnapshots"> & DocumentSnapshotFields;

export type DocumentChangeSetFields = {
  projectId: Id<"projects">;
  resourceId: Id<"documents">;
  revision: number;
  baseRevision: number;
  tier: DocumentChangeTier;
  ops: DocumentOp[];
  touched: string[];
  actor: Actor;
  at: number;
};
export type DocumentChangeSet = Row<"documentChangeSets"> & DocumentChangeSetFields;

export type PresentationSnapshotFields = {
  projectId: Id<"projects">;
  resourceId: Id<"presentations">;
  revision: number;
  role: PresentationSnapshotRole;
  part: number;
  body: PresentationBody;
  at: number;
};
export type PresentationSnapshot = Row<"presentationSnapshots"> & PresentationSnapshotFields;

export type PresentationChangeSetFields = {
  projectId: Id<"projects">;
  resourceId: Id<"presentations">;
  revision: number;
  baseRevision: number;
  tier: PresentationChangeTier;
  ops: PresentationOp[];
  touched: string[];
  actor: Actor;
  at: number;
};
export type PresentationChangeSet = Row<"presentationChangeSets"> & PresentationChangeSetFields;

export type SpreadsheetSnapshotFields = {
  projectId: Id<"projects">;
  resourceId: Id<"spreadsheets">;
  revision: number;
  role: SpreadsheetSnapshotRole;
  part: number;
  body: SpreadsheetBody;
  at: number;
};
export type SpreadsheetSnapshot = Row<"spreadsheetSnapshots"> & SpreadsheetSnapshotFields;

export type SpreadsheetChangeSetFields = {
  projectId: Id<"projects">;
  resourceId: Id<"spreadsheets">;
  revision: number;
  baseRevision: number;
  tier: SpreadsheetChangeTier;
  ops: SpreadsheetOp[];
  touched: string[];
  actor: Actor;
  at: number;
};
export type SpreadsheetChangeSet = Row<"spreadsheetChangeSets"> & SpreadsheetChangeSetFields;

export type DocumentFields = {
  projectId: Id<"projects">;
  title: string;
  summary?: string;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
};
export type Document = Row<"documents"> & DocumentFields;

export type PresentationFields = {
  projectId: Id<"projects">;
  title: string;
  summary?: string;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
};
export type Presentation = Row<"presentations"> & PresentationFields;

export type SpreadsheetFields = {
  projectId: Id<"projects">;
  title: string;
  summary?: string;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
};
export type Spreadsheet = Row<"spreadsheets"> & SpreadsheetFields;

export type SheetCellFields = SheetCellData & {
  projectId: Id<"projects">;
  resourceId: Id<"spreadsheets">;
  rowOrder: number;
};
export type SheetCell = Row<"sheetCells"> & SheetCellFields;

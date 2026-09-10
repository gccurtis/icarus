import type { Id, Row } from "$representation/data/types/core/id";
import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { TabId, TabRecord, TabView } from "$representation/data/types/workspace/tab";

export type WorkspaceSnapshotFields = {
  projectId: Id<"projects">;
  userId: Id<"users">;
  revision: number;
  tabs: TabRecord[];
  activeId: TabId;
  views: Record<TabId, TabView>;
  at: number;
};
export type WorkspaceSnapshot = Row<"workspaceSnapshots"> & WorkspaceSnapshotFields;

export type WorkspaceRevisionFields = {
  projectId: Id<"projects">;
  userId: Id<"users">;
  revision: number;
  baseRevision: number;
  ops: WorkspaceOp[];
  at: number;
};
export type WorkspaceRevision = Row<"workspaceRevisions"> & WorkspaceRevisionFields;

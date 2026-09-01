import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { TabId, TabRecord, TabView } from "$representation/data/types/workspace/tab";

export type SubmitWorkspaceChangesInput = {
  readonly baseRevision: number;
  readonly ops: readonly WorkspaceOp[];
  readonly tabs: readonly TabRecord[];
  readonly activeId: TabId;
  readonly views: Record<TabId, TabView>;
};

export type SubmitWorkspaceChangesResult = { readonly revision: number };

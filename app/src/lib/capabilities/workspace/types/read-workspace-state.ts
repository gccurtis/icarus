import type { TabId, TabRecord, TabView } from "$representation/data/types/workspace/tab";

export type ReadWorkspaceStateResult = {
  readonly revision: number;
  readonly tabs: readonly TabRecord[];
  readonly activeId: TabId;
  readonly views: Record<TabId, TabView>;
} | null;

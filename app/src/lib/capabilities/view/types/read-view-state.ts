import type { TabId, TabRecord, TabView } from "$representation/data/types/views/tab";

export type ReadViewStateResult = {
  readonly revision: number;
  readonly tabs: readonly TabRecord[];
  readonly activeId: TabId;
  readonly views: Record<TabId, TabView>;
} | null;

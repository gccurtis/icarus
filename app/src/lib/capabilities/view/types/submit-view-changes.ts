import type { ViewOp } from "$representation/data/types/views/op";
import type { TabId, TabRecord, TabView } from "$representation/data/types/views/tab";

export type SubmitViewChangesInput = {
  readonly baseRevision: number;
  readonly ops: readonly ViewOp[];
  readonly tabs: readonly TabRecord[];
  readonly activeId: TabId;
  readonly views: Record<TabId, TabView>;
};

export type SubmitViewChangesResult = { readonly revision: number };

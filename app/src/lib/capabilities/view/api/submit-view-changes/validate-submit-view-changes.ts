import type { ViewOp } from "$representation/data/types/views/op";
import type { TabId, TabRecord, TabView } from "$representation/data/types/views/tab";
import type { SubmitViewChangesInput } from "$capabilities/view/types/submit-view-changes";

const refuse = (what: string): never => {
  throw new Error(`view/submit-view-changes: ${what}`);
};

export const validateSubmitViewChanges = (input: unknown): SubmitViewChangesInput => {
  if (input === null || typeof input !== "object") refuse("an input is an object");

  const { baseRevision, ops, tabs, activeId, views } = input as Record<string, unknown>;

  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) {
    refuse("baseRevision is a revision number");
  }
  if (!Array.isArray(ops) || ops.length === 0) refuse("ops is a non-empty array");
  if (!Array.isArray(tabs) || tabs.length === 0) refuse("tabs is a non-empty array");
  if (typeof activeId !== "string" || activeId.length === 0) refuse("activeId names a tab");
  if (views === null || typeof views !== "object" || Array.isArray(views)) {
    refuse("views is a mapping from tab id to view");
  }

  return {
    baseRevision: baseRevision as number,
    ops: ops as readonly ViewOp[],
    tabs: tabs as readonly TabRecord[],
    activeId: activeId as TabId,
    views: views as Record<TabId, TabView>
  };
};

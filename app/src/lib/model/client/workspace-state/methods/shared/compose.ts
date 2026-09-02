import type { TabRecord, TabView } from "$representation/data/types/workspace/tab";
import type { Tab } from "$model/client/workspace-state/types";

export const compose = (record: TabRecord, view: TabView): Tab => ({
  id: record.id,
  category: record.category,
  resourceId: record.resourceId,
  content: view.content,
  contextId: view.contextId ?? undefined,
  focus: view.focus ?? undefined,
  inspected: view.inspected,
  selection: view.selection ?? undefined,
  frame: view.frame
});

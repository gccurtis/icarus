import type { TabRecord, TabView } from "$representation/data/types/views/tab";
import type { Tab } from "$model/client/view-state/types";

export const compose = (record: TabRecord, view: TabView): Tab => ({
  id: record.id,
  screen: record.screen,
  resourceId: record.resourceId,
  subscreen: view.subscreen,
  contextId: view.contextId ?? undefined,
  focus: view.focus ?? undefined,
  inspected: view.inspected,
  selection: view.selection ?? undefined,
  frame: view.frame
});

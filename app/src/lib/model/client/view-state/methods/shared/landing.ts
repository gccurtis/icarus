import type { Landing, TabView } from "$representation/data/types/views/tab";

export const landing = (view: TabView): Landing => ({
  subscreen: view.subscreen,
  focus: view.focus,
  contextId: view.contextId,
  inspected: view.inspected,
  selection: view.selection
});

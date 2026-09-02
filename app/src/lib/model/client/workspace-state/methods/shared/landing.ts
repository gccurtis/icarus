import type { Landing, TabView } from "$representation/data/types/workspace/tab";

export const landing = (view: TabView): Landing => ({
  content: view.content,
  focus: view.focus,
  contextId: view.contextId,
  inspected: view.inspected,
  selection: view.selection
});

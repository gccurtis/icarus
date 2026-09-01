import type { TabId, TabView } from "$representation/data/types/workspace/tab";
import type { TabViewsData } from "$model/client/tab-views/definition";

export const of = (state: TabViewsData, id: TabId): TabView => {
  const view = state.views.get(id);
  if (view === undefined) throw new Error(`no view for '${id}'`);
  return view;
};

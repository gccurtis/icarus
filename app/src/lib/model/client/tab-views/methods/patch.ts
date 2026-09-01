import type { TabId, TabView } from "$representation/data/types/views/tab";
import type { TabViewsData } from "$model/client/tab-views/definition";
import { of } from "$model/client/tab-views/methods/of";

export const patch = (state: TabViewsData, id: TabId, change: Partial<TabView>): void => {
  state.views.set(id, { ...of(state, id), ...change });
};

import { TabViews } from "$model/client/tab-views/definition";
import type { TabViewsModel } from "$model/client/tab-views/types";

export const createTabViews = (): TabViewsModel => new TabViews();

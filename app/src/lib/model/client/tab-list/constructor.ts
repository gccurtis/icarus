import { TabList } from "$model/client/tab-list/definition.svelte";
import type { TabListModel } from "$model/client/tab-list/types";

export const createTabList = (): TabListModel => new TabList();

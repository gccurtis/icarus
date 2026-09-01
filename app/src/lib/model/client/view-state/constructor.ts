import type { ConfigurationModel } from "$model/client/configuration";
import { requiredNumber } from "$model/client/configuration";
import type { TabListModel } from "$model/client/tab-list";
import type { TabViewsModel } from "$model/client/tab-views";
import { ViewState } from "$model/client/view-state/definition.svelte";
import type { ViewStateModel } from "$model/client/view-state/types";

const FLUSH_AFTER_OPS = "views.changeSets.flushAfterOps";
const FLUSH_AFTER_MS = "views.changeSets.flushAfterMs";

export const createViewState = (
  project: string,
  tabs: TabListModel,
  views: TabViewsModel,
  configuration: ConfigurationModel
): ViewStateModel =>
  new ViewState(project, tabs, views, {
    afterOps: requiredNumber(configuration, FLUSH_AFTER_OPS),
    afterMs: requiredNumber(configuration, FLUSH_AFTER_MS)
  });

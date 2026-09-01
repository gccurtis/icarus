import { getContext, hasContext, setContext } from "svelte";

import { createConfiguration } from "$model/client/configuration";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createViewState } from "$model/client/view-state/constructor";
import type { ViewStateModel } from "$model/client/view-state/types";

export { createViewState } from "$model/client/view-state/constructor";

export type { Screen, Subscreen } from "$representation/data/types/views/screens";
export { SCREENS, SUBSCREENS, isScreen } from "$representation/data/behavior/views/screens";

export type { ContextId, InspectionKey } from "$representation/data/types/views/panels";
export {
  CONTEXT_IDS,
  INSPECTION_KEYS,
  isContextId,
  isInspectionKey
} from "$representation/data/behavior/views/panels";

export type {
  Frame,
  Inspected,
  Selection,
  TabId,
  Target
} from "$representation/data/types/views/tab";

export type { Tab, ViewStateModel } from "$model/client/view-state/types";

export type { Singleton } from "$model/client/view-state/methods/shared/defaults";
export {
  DEFAULT_FRAME,
  SINGLETONS,
  isSingleton
} from "$model/client/view-state/methods/shared/defaults";

export {
  DEFAULT_SUBSCREEN,
  RAILS,
  defaultContext,
  defaultSubscreen,
  offersContext,
  railFor
} from "$model/client/view-state/methods/shared/rails";

const KEY = Symbol.for("icarus.view-state");

const UNPERSISTED = { views: { changeSets: { flushAfterOps: 0, flushAfterMs: 0 } } };

export const provideViewState = (model: ViewStateModel): ViewStateModel => {
  setContext(KEY, model);
  return model;
};

export const viewState = (): ViewStateModel =>
  hasContext(KEY)
    ? getContext<ViewStateModel>(KEY)
    : createViewState(
        "dev-project",
        createTabList(),
        createTabViews(),
        createConfiguration(UNPERSISTED)
      );

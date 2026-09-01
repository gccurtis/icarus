import { getContext, hasContext, setContext } from "svelte";

import { createConfiguration } from "$model/client/configuration";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState } from "$model/client/workspace-state/constructor";
import type { WorkspaceStateModel } from "$model/client/workspace-state/types";

export { createWorkspaceState } from "$model/client/workspace-state/constructor";

export type { Screen, Subscreen } from "$representation/data/types/workspace/screens";
export { SCREENS, SUBSCREENS, isScreen } from "$representation/data/behavior/workspace/screens";

export type { ContextId, InspectionKey } from "$representation/data/types/workspace/panels";
export {
  CONTEXT_IDS,
  INSPECTION_KEYS,
  isContextId,
  isInspectionKey
} from "$representation/data/behavior/workspace/panels";

export type {
  Frame,
  Inspected,
  Selection,
  TabId,
  Target
} from "$representation/data/types/workspace/tab";

export type { Tab, WorkspaceStateModel } from "$model/client/workspace-state/types";

export type { Singleton } from "$model/client/workspace-state/methods/shared/defaults";
export {
  DEFAULT_FRAME,
  SINGLETONS,
  isSingleton
} from "$model/client/workspace-state/methods/shared/defaults";

export {
  DEFAULT_SUBSCREEN,
  RAILS,
  defaultContext,
  defaultSubscreen,
  offersContext,
  railFor
} from "$model/client/workspace-state/methods/shared/rails";

const KEY = Symbol.for("icarus.workspace-state");

const UNPERSISTED = { workspace: { changeSets: { flushAfterOps: 0, flushAfterMs: 0 } } };

export const provideWorkspaceState = (model: WorkspaceStateModel): WorkspaceStateModel => {
  setContext(KEY, model);
  return model;
};

export const workspaceState = (): WorkspaceStateModel =>
  hasContext(KEY)
    ? getContext<WorkspaceStateModel>(KEY)
    : createWorkspaceState(
        "dev-project",
        createTabList(),
        createTabViews(),
        createConfiguration(UNPERSISTED)
      );

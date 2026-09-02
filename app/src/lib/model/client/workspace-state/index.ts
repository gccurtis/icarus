import { getContext, hasContext, setContext } from "svelte";

import { createConfiguration } from "$model/client/configuration";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState } from "$model/client/workspace-state/constructor";
import type { WorkspaceStateModel } from "$model/client/workspace-state/types";

export { createWorkspaceState } from "$model/client/workspace-state/constructor";

export type { Category, ContentView } from "$representation/data/types/workspace/categories";
export {
  CATEGORIES,
  CONTENT_VIEWS,
  isCategory,
  isContentView
} from "$representation/data/behavior/workspace/categories";

export type { ContextView, InspectorView } from "$representation/data/types/workspace/views";
export {
  CONTEXT_VIEWS,
  INSPECTOR_VIEWS,
  isContextView,
  isInspectorView
} from "$representation/data/behavior/workspace/views";

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
  DEFAULT_CONTENT,
  RAILS,
  defaultContent,
  defaultContext,
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

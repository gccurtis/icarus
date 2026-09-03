import { getContext, hasContext, setContext } from "svelte";

import { createConfiguration } from "$model/client/configuration";
import { createDocumentRuntimes } from "$model/client/document-runtimes";
import { createSlideDeckRuntimes } from "$model/client/slide-deck-runtimes";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState } from "$model/client/workspace-state/constructor";
import type { WorkspaceStateModel } from "$model/client/workspace-state/types";

export { createWorkspaceState } from "$model/client/workspace-state/constructor";

export type { DocumentRuntime, SyncState } from "$model/client/document-runtimes";
export type { SlideDeckRuntime } from "$model/client/slide-deck-runtimes";

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
  RAILS,
  defaultContent,
  defaultContext,
  offersContext,
  railFor
} from "$model/client/workspace-state/methods/shared/rails";

const KEY = Symbol.for("icarus.workspace-state");

const UNPERSISTED = {
  workspace: { changeSets: { flushAfterOps: 0, flushAfterMs: 0 } },
  revisions: { changeSets: { flushAfterOps: 50, flushAfterMs: 2000 } }
};

export const provideWorkspaceState = (model: WorkspaceStateModel): WorkspaceStateModel => {
  setContext(KEY, model);
  return model;
};

const forDevelopment = (): WorkspaceStateModel => {
  const configuration = createConfiguration(UNPERSISTED);

  return createWorkspaceState(
    "dev-project",
    createTabList(),
    createTabViews(),
    configuration,
    createDocumentRuntimes(configuration),
    createSlideDeckRuntimes(configuration)
  );
};

export const workspaceState = (): WorkspaceStateModel =>
  hasContext(KEY) ? getContext<WorkspaceStateModel>(KEY) : forDevelopment();

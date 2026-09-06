import { getContext, hasContext, setContext } from "svelte";

import { username } from "$capabilities/development/index.remote";
import { read } from "$capabilities/store/index.remote";
import { createConfiguration } from "$model/client/configuration";
import { createDocumentRuntimes } from "$model/client/document-runtimes";
import { createSlideDeckRuntimes } from "$model/client/slide-deck-runtimes";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState } from "$model/client/workspace-state/constructor";
import type { WorkspaceStateModel } from "$model/client/workspace-state/types";
import type { TableName } from "$representation/store/tables";

export { createWorkspaceState } from "$model/client/workspace-state/constructor";

export type { DocumentRuntime, PendingMarks, SyncState } from "$model/client/document-runtimes";
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

export type {
  SingleFlightKeyPart,
  StoreQuery,
  Tab,
  WorkspaceStateModel
} from "$model/client/workspace-state/types";

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
  revisions: { changeSets: { flushAfterOps: 50, flushAfterMs: 2000 }, sync: { everyMs: 0 } },
  slideDeck: {
    stage: { unitsHigh: 720, widthRem: 52, averageGlyphWidthEm: 0.52 },
    zoom: { minimum: 50, maximum: 200, step: 5 },
    gutter: { minimumRem: 0.75, maximumRem: 2.5 }
  }
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
    createSlideDeckRuntimes(configuration),
    read,
    username
  );
};

export const workspaceState = (): WorkspaceStateModel =>
  hasContext(KEY) ? getContext<WorkspaceStateModel>(KEY) : forDevelopment();

/** A store read whose reactive lifetime is the browser workspace, not a transient view. */
export const readStore = (table: TableName) => workspaceState().readStore(table);

/** The session-name read, owned by the browser workspace rather than a view. */
export const readUsername = () => workspaceState().readUsername();

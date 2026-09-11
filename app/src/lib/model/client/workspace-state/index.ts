import { getContext, hasContext, setContext } from "svelte";

import { createDocumentRuntimes } from "$model/client/document-runtimes";
import { createPresentationRuntimes } from "$model/client/presentation-runtimes";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState } from "$model/client/workspace-state/constructor";
import type { WorkspaceStateModel } from "$model/client/workspace-state/types";

export { createWorkspaceState } from "$model/client/workspace-state/constructor";

export type { DocumentRuntime, PendingMarks, SyncState } from "$model/client/document-runtimes";
export type { PresentationRuntime } from "$model/client/presentation-runtimes";
export type { SpreadsheetRuntime } from "$model/client/spreadsheet-runtimes";

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

const REVISION_THRESHOLDS = { afterOps: 50, afterMs: 2000, syncEveryMs: 0 };
const WORKSPACE_THRESHOLDS = { afterOps: 0, afterMs: 0 };
const STAGE_SETTINGS = {
  unitsHigh: 720,
  widthRem: 52,
  averageGlyphWidthEm: 0.52,
  minimumZoom: 50,
  maximumZoom: 200,
  zoomStep: 5,
  minimumGutterRem: 0.75,
  maximumGutterRem: 2.5
};

export const provideWorkspaceState = (model: WorkspaceStateModel): WorkspaceStateModel => {
  setContext(KEY, model);
  return model;
};

const forDevelopment = (): WorkspaceStateModel => {
  return createWorkspaceState(
    "dev-project",
    createTabList(),
    createTabViews(),
    WORKSPACE_THRESHOLDS,
    createDocumentRuntimes(REVISION_THRESHOLDS),
    createPresentationRuntimes(REVISION_THRESHOLDS, STAGE_SETTINGS),
    createSpreadsheetRuntimes(REVISION_THRESHOLDS)
  );
};

export const workspaceState = (): WorkspaceStateModel =>
  hasContext(KEY) ? getContext<WorkspaceStateModel>(KEY) : forDevelopment();

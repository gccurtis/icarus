import type { DocumentRuntimesModel } from "$model/client/document-runtimes";
import type { PresentationRuntimesModel } from "$model/client/presentation-runtimes";
import type { SpreadsheetRuntimesModel } from "$model/client/spreadsheet-runtimes";
import type { TabListModel } from "$model/client/tab-list";
import type { TabViewsModel } from "$model/client/tab-views";
import {
  WorkspaceState,
  type Thresholds
} from "$model/client/workspace-state/definition.svelte";
import type { WorkspaceStateModel } from "$model/client/workspace-state/types";

export const createWorkspaceState = (
  project: string,
  tabs: TabListModel,
  views: TabViewsModel,
  thresholds: Thresholds,
  documents?: DocumentRuntimesModel,
  presentations?: PresentationRuntimesModel,
  sheets?: SpreadsheetRuntimesModel
): WorkspaceStateModel =>
  new WorkspaceState(
    project,
    tabs,
    views,
    thresholds,
    documents,
    presentations,
    sheets
  );

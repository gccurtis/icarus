import type { ConfigurationModel } from "$model/client/configuration";
import { requiredNumber } from "$model/client/configuration";
import type { DocumentRuntimesModel } from "$model/client/document-runtimes";
import type { SlideDeckRuntimesModel } from "$model/client/slide-deck-runtimes";
import type { TabListModel } from "$model/client/tab-list";
import type { TabViewsModel } from "$model/client/tab-views";
import { WorkspaceState } from "$model/client/workspace-state/definition.svelte";
import type { WorkspaceStateModel } from "$model/client/workspace-state/types";

const FLUSH_AFTER_OPS = "workspace.changeSets.flushAfterOps";
const FLUSH_AFTER_MS = "workspace.changeSets.flushAfterMs";

export const createWorkspaceState = (
  project: string,
  tabs: TabListModel,
  views: TabViewsModel,
  configuration: ConfigurationModel,
  documents?: DocumentRuntimesModel,
  decks?: SlideDeckRuntimesModel
): WorkspaceStateModel =>
  new WorkspaceState(
    project,
    tabs,
    views,
    {
      afterOps: requiredNumber(configuration, FLUSH_AFTER_OPS),
      afterMs: requiredNumber(configuration, FLUSH_AFTER_MS)
    },
    documents,
    decks
  );

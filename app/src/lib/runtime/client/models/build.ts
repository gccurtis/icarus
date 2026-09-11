import { createCommands } from "$model/client/commands";
import { bindConfiguration } from "$model/client/configuration/port";
import { createConfigurationState } from "$model/client/configuration/state";
import { createDocumentRuntimes } from "$model/client/document-runtimes";
import { createPresentationRuntimes } from "$model/client/presentation-runtimes";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState } from "$model/client/workspace-state";
import type { ClientModelAdapters } from "$runtime/client/models/types";
import type { ClientModel, ClientModelInput } from "$runtime/client/types";

/**
 * The client composition root. It creates the configuration singleton and its
 * adapter exactly once, acquires one construction lease, and translates that
 * local port into each downstream model's own settings vocabulary.
 */
export const buildClientModel = ({
  project,
  configuration
}: ClientModelInput): ClientModel => {
  const configurationState = createConfigurationState(configuration);
  const models: ClientModelAdapters = {
    configuration: bindConfiguration(configurationState)
  };
  const settings = models.configuration.acquire(undefined);

  try {
    const revisionThresholds = {
      afterOps: settings.getNumber("revisions.changeSets.flushAfterOps"),
      afterMs: settings.getNumber("revisions.changeSets.flushAfterMs"),
      syncEveryMs: settings.getNumber("revisions.sync.everyMs")
    };
    const stageSettings = {
      unitsHigh: settings.getNumber("presentation.stage.unitsHigh"),
      widthRem: settings.getNumber("presentation.stage.widthRem"),
      averageGlyphWidthEm: settings.getNumber("presentation.stage.averageGlyphWidthEm"),
      minimumZoom: settings.getNumber("presentation.zoom.minimum"),
      maximumZoom: settings.getNumber("presentation.zoom.maximum"),
      zoomStep: settings.getNumber("presentation.zoom.step"),
      minimumGutterRem: settings.getNumber("presentation.gutter.minimumRem"),
      maximumGutterRem: settings.getNumber("presentation.gutter.maximumRem")
    };
    const workspaceThresholds = {
      afterOps: settings.getNumber("workspace.changeSets.flushAfterOps"),
      afterMs: settings.getNumber("workspace.changeSets.flushAfterMs")
    };

    const documentRuntimes = createDocumentRuntimes(revisionThresholds);
    const presentationRuntimes = createPresentationRuntimes(
      revisionThresholds,
      stageSettings
    );
    const spreadsheetRuntimes = createSpreadsheetRuntimes(revisionThresholds);

    const tabList = createTabList();
    const tabViews = createTabViews();
    const workspaceState = createWorkspaceState(
      project,
      tabList,
      tabViews,
      workspaceThresholds,
      documentRuntimes,
      presentationRuntimes,
      spreadsheetRuntimes
    );

    settings.commit();
    return {
      project,
      workspaceState,
      documentRuntimes,
      presentationRuntimes,
      spreadsheetRuntimes,
      commands: createCommands(workspaceState),

      close: () => {
        void workspaceState.flush().catch(() => undefined);
        documentRuntimes.releaseAll();
        presentationRuntimes.releaseAll();
        spreadsheetRuntimes.releaseAll();
        workspaceState.release();
        models.configuration.close();
      }
    };
  } finally {
    models.configuration.release(settings);
  }
};

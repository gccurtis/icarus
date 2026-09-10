import { browser } from "$app/environment";
import { createCommands } from "$model/client/commands";
import { createConfiguration } from "$model/client/configuration";
import { createDocumentRuntimes } from "$model/client/document-runtimes";
import { createSlideDeckRuntimes } from "$model/client/slide-deck-runtimes";
import { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState } from "$model/client/workspace-state";
import type { ClientModel, ClientModelInput } from "$runtime/client/types";

export type { ClientModel, ClientModelInput } from "$runtime/client/types";
export type {
  Chord,
  ChordParts,
  Command,
  CommandId,
  CommandsModel
} from "$model/client/commands";
export { COMMAND_IDS, DEFAULT_BINDINGS, chordOf, isCommandId } from "$model/client/commands";
export type { ConfigurationModel, ConfigurationSnapshot } from "$model/client/configuration";
export { requiredNumber } from "$model/client/configuration";

const buildClientModel = ({ project, configuration }: ClientModelInput): ClientModel => {
  const settings = createConfiguration(configuration);

  const documentRuntimes = createDocumentRuntimes(settings);
  const slideDeckRuntimes = createSlideDeckRuntimes(settings);
  const spreadsheetRuntimes = createSpreadsheetRuntimes(settings);

  const tabList = createTabList();
  const tabViews = createTabViews();
  const workspaceState = createWorkspaceState(
    project,
    tabList,
    tabViews,
    settings,
    documentRuntimes,
    slideDeckRuntimes,
    spreadsheetRuntimes
  );

  return {
    project,
    workspaceState,
    configuration: settings,
    documentRuntimes,
    slideDeckRuntimes,
    spreadsheetRuntimes,
    commands: createCommands(workspaceState),

    close: () => {
      void workspaceState.flush().catch(() => undefined);
      documentRuntimes.releaseAll();
      slideDeckRuntimes.releaseAll();
      spreadsheetRuntimes.releaseAll();
      workspaceState.release();
    }
  };
};

let instance: ClientModel | undefined;

export const initClientModel = (input: ClientModelInput): ClientModel =>
  (instance = buildClientModel(input));

export const clientModel = (): ClientModel => {
  if (!browser) {
    throw new Error(
      "The client model is browser-only — it belongs to one browser tab. " +
        "See src/lib/runtime/client/client.md."
    );
  }
  if (!instance) {
    throw new Error(
      "The client model has not been built — the /app layout that owns this client " +
        "instance calls initClientModel(). See src/lib/runtime/client/client.md."
    );
  }
  return instance;
};

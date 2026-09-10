import type { CommandsModel } from "$model/client/commands";
import type { ConfigurationModel, ConfigurationSnapshot } from "$model/client/configuration";
import type { DocumentRuntimesModel } from "$model/client/document-runtimes";
import type { SlideDeckRuntimesModel } from "$model/client/slide-deck-runtimes";
import type { SpreadsheetRuntimesModel } from "$model/client/spreadsheet-runtimes";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export type ClientModelInput = {
  readonly project: string;
  readonly configuration: ConfigurationSnapshot;
};

export interface ClientModel {
  readonly project: string;
  readonly configuration: ConfigurationModel;

  readonly documentRuntimes: DocumentRuntimesModel;
  readonly slideDeckRuntimes: SlideDeckRuntimesModel;
  readonly spreadsheetRuntimes: SpreadsheetRuntimesModel;

  readonly workspaceState: WorkspaceStateModel;
  readonly commands: CommandsModel;

  close(): void;
}

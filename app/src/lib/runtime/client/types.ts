import type { CommandsModel } from "$model/client/commands";
import type { ClientConfigurationInput } from "$model/client/configuration";
import type { DocumentRuntimesModel } from "$model/client/document-runtimes";
import type { PresentationRuntimesModel } from "$model/client/presentation-runtimes";
import type { SpreadsheetRuntimesModel } from "$model/client/spreadsheet-runtimes";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export type ClientModelInput = {
  readonly project: string;
  readonly configuration: ClientConfigurationInput;
};

export interface ClientModel {
  readonly project: string;
  readonly documentRuntimes: DocumentRuntimesModel;
  readonly presentationRuntimes: PresentationRuntimesModel;
  readonly spreadsheetRuntimes: SpreadsheetRuntimesModel;

  readonly workspaceState: WorkspaceStateModel;
  readonly commands: CommandsModel;

  close(): void;
}

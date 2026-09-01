import type { CommandsModel } from "$model/client/commands";
import type { ConfigurationModel, ConfigurationSnapshot } from "$model/client/configuration";
import type { CopilotModel } from "$model/client/copilot";
import type { DocumentRuntimesModel } from "$model/client/document-runtimes";
import type { SlideDeckRuntimesModel } from "$model/client/slide-deck-runtimes";
import type { SpreadsheetRuntimesModel } from "$model/client/spreadsheet-runtimes";
import type { ClientStorage } from "$model/client/storage";
import type { ViewStateModel } from "$model/client/view-state";

export type ClientModelInput = {
  readonly project: string;
  readonly configuration: ConfigurationSnapshot;
  readonly storage?: ClientStorage;
};

export interface ClientModel {
  readonly project: string;
  readonly configuration: ConfigurationModel;
  readonly storage: ClientStorage;

  readonly documentRuntimes: DocumentRuntimesModel;
  readonly slideDeckRuntimes: SlideDeckRuntimesModel;
  readonly spreadsheetRuntimes: SpreadsheetRuntimesModel;

  readonly viewState: ViewStateModel;
  readonly commands: CommandsModel;
  readonly copilot: CopilotModel;

  close(): void;
}

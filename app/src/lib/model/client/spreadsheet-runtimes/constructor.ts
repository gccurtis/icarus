import { SpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes/definition.svelte";
import type {
  SpreadsheetRuntimesModel,
  Thresholds
} from "$model/client/spreadsheet-runtimes/types";

export const createSpreadsheetRuntimes = (
  thresholds: Thresholds
): SpreadsheetRuntimesModel => new SpreadsheetRuntimes(thresholds);

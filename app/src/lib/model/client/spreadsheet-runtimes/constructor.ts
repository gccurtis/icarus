import type { ConfigurationModel } from "$model/client/configuration";
import { requiredNumber } from "$model/client/configuration";
import { SpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes/definition.svelte";
import type { SpreadsheetRuntimesModel } from "$model/client/spreadsheet-runtimes/types";

const FLUSH_AFTER_OPS = "revisions.changeSets.flushAfterOps";
const FLUSH_AFTER_MS = "revisions.changeSets.flushAfterMs";

export const createSpreadsheetRuntimes = (
  configuration: ConfigurationModel
): SpreadsheetRuntimesModel =>
  new SpreadsheetRuntimes({
    afterOps: requiredNumber(configuration, FLUSH_AFTER_OPS),
    afterMs: requiredNumber(configuration, FLUSH_AFTER_MS)
  });

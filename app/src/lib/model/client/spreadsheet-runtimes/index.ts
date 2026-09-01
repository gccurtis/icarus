/**
 * The entry for SpreadsheetRuntimes.
 *
 * The composition root takes the constructor; every other object takes the
 * types. `Runtime` and `SpreadsheetRuntimesState` do not cross — they are the
 * definition's, and a consumer holding one could hold a runtime past its
 * release.
 */
export { createSpreadsheetRuntimes } from "$model/client/spreadsheet-runtimes/constructor";
export type {
  SpreadsheetRuntime,
  SpreadsheetRuntimesModel,
  SyncState
} from "$model/client/spreadsheet-runtimes/types";

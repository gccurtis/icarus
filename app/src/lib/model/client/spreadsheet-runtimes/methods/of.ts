import type {
  Runtime,
  SpreadsheetRuntimesState
} from "$model/client/spreadsheet-runtimes/definition.svelte";

/** Read an already-acquired runtime without changing its lifetime. */
export const of = (state: SpreadsheetRuntimesState, id: string): Runtime | undefined =>
  state.open.get(id);

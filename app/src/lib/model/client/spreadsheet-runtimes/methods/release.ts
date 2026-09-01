import type { Runtime, SpreadsheetRuntimesState } from "$model/client/spreadsheet-runtimes/definition.svelte";
import { detach } from "$model/client/spreadsheet-runtimes/methods/shared/detach";

export const release = (state: SpreadsheetRuntimesState, id: string): Runtime | undefined =>
  detach(state, id);

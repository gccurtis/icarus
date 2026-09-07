import { readSpreadsheet } from "$capabilities/spreadsheet/index.remote";
import { cellKey } from "$representation/data/behavior/spreadsheets/apply-ops";
import { emptySheet } from "$representation/data/behavior/spreadsheets/empty-sheet";
import type { Runtime } from "$model/client/spreadsheet-runtimes/definition.svelte";

const settled = (runtime: Runtime): boolean => runtime.buffer.length === 0 && !runtime.inFlight;

export const sync = async (runtime: Runtime): Promise<void> => {
  if (!settled(runtime)) return;

  try {
    const question = readSpreadsheet({ resourceId: runtime.id });
    await question.refresh();
    const found = question.ready ? question.current : await question;

    if (!settled(runtime)) return;

    runtime.sheet =
      found === null
        ? emptySheet()
        : {
            body: found.body,
            cells: Object.fromEntries(
              found.cells.map((cell) => [cellKey(cell.rowId, cell.columnId), cell])
            )
          };
    runtime.revision = found === null ? 0 : found.revision;
    if (runtime.sync !== "needs-review") runtime.sync = "saved";
  } catch {
    if (runtime.sheet === undefined) runtime.sync = "error";
  }
};

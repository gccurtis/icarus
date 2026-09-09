import { untrack } from "svelte";

import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import { aroundOf, recalculated, sourceFor } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { variablesRevision } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
import type { SpreadsheetRuntime } from "$model/client/workspace-state";

export type OpenSheet = {
  readonly resourceId: string | undefined;
  readonly sheet: LiveSheet | undefined;
  readonly runtime: SpreadsheetRuntime | undefined;
};

/**
 * A formula naming a variable answers again when the variable changes.
 *
 * The revision is the only thing followed here. Reading the sheet inside the
 * arrangement would make every edit re-run the pass that writes edits, which is
 * a loop rather than a recalculation, so the open sheet is read untracked.
 */
export const recalculatesOnVariables = (project: () => string, open: () => OpenSheet): void => {
  $effect(() => {
    const held = project();
    void variablesRevision(held);

    untrack(() => {
      const { resourceId, sheet, runtime } = open();
      if (sheet === undefined || resourceId === undefined) return;

      const ops = recalculated(sourceFor(resourceId, sheet), aroundOf(held));
      if (ops.length > 0) runtime?.apply(ops);
    });
  });
};

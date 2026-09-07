import type { BlockFormat } from "$representation/data/types/content/block-format";
import type { Mark } from "$representation/data/types/content/content-block";
import type { CellRef } from "$representation/data/types/content/formula-value";
import type { VariableValue } from "$representation/data/types/content/variable-value";
import type { Id } from "$representation/data/types/core/id";

export type SheetCell = {
  rowId: string;
  columnId: string;
  value: VariableValue;
  expression?: string;
  formulaId?: Id<"formulas">;
  marks?: Mark[];
  format?: BlockFormat;
  mergedTo?: CellRef;
  spillTo?: CellRef;
};

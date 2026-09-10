import type { CellRef } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import type { ReferenceSpan } from "$app-views/categories/spreadsheet-editor/procedures/reference-picking";
import type { WritingHandoff } from "$app-views/categories/spreadsheet-editor/procedures/writing-handoff";

/** Transient state owned for exactly one mounted cell-head field. */
export class CellHeadState {
  editing = $state(false);
  editingAt = $state<CellRef>();
  draft = $state("");
  field = $state<HTMLInputElement | null>(null);
  span = $state<ReferenceSpan>();
  refusal = $state<string>();
  handoff = $state<WritingHandoff>();
  caret = $state(0);
}

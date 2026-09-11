import type { CellHeadState } from "$app-views/categories/spreadsheet-editor/components/cell-head.state.svelte";
import { anchored, lockedAt } from "$app-views/categories/spreadsheet-editor/procedures/anchoring";
import type { Picker } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";
import { insertedReference } from "$app-views/categories/spreadsheet-editor/procedures/reference-picking";

/** Editing a reference always restores the same mounted field, never a later one. */
export const createCellReferenceActions = (state: CellHeadState) => {
  const focus = (caret: number) => {
    const input = state.field;
    state.caret = caret;
    setTimeout(() => {
      if (!state.editing || input === null || !input.isConnected) return;
      input.focus();
      input.setSelectionRange(caret, caret);
    }, 0);
  };

  const picker: Picker = {
    insert: (address, anchor, gesture) => {
      const input = state.field;
      if (input === null) return;
      const from = input.selectionStart ?? state.draft.length;
      const insertion = insertedReference(
        state.draft, address, anchor, gesture,
        { from, to: input.selectionEnd ?? from }, state.span
      );
      state.draft = insertion.text;
      state.dirty = true;
      state.span = insertion.span;
      focus(insertion.caret);
    }
  };

  const replace = (next: { text: string; caret: number } | undefined) => {
    if (next === undefined) return;
    state.draft = next.text;
    state.dirty = true;
    state.span = undefined;
    focus(next.caret);
  };

  return {
    picker,
    relock: (column: boolean, row: boolean) => replace(lockedAt(state.draft, state.caret, column, row)),
    cycle: () => replace(anchored(state.draft, state.field?.selectionStart ?? state.caret)),
    track: () => { state.caret = state.field?.selectionStart ?? state.draft.length; }
  };
};

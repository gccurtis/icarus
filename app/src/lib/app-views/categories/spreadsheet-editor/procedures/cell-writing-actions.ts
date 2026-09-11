import type { Selection } from "$representation/data/types/workspace/tab";
import type { SpreadsheetRuntime } from "$model/client/workspace-state";
import type { CellHeadState } from "$app-views/categories/spreadsheet-editor/components/cell-head.state.svelte";
import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
import type { PickingChannel, Picker } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";
import { factsOf, recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
import { typedSelection, writingAnchor, writingTargets } from "$app-views/categories/spreadsheet-editor/procedures/typing-selection";
import type { VariableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
import { continueWritingHandoff } from "$app-views/categories/spreadsheet-editor/procedures/writing-handoff";

type Context = {
  readonly state: CellHeadState;
  readonly channel: PickingChannel;
  readonly picker: Picker;
  readonly register: VariableRegister;
  readonly resourceId: string | undefined;
  readonly runtime: SpreadsheetRuntime | undefined;
  readonly selection: Selection | undefined;
  readonly shown: string;
  readonly cycle: () => void;
};

/** Capture the destinations at the first keystroke and submit them as one edit. */
export const createCellWritingActions = (context: Context) => {
  const { state, channel, picker } = context;

  const finish = () => {
    state.editing = false;
    state.handoff = undefined;
    channel.disarm(picker);
    channel.drafting(undefined);
  };

  const commit = () => {
    const live = context.runtime?.sheet;
    if (!state.editing || live === undefined) return;
    finish();
    if (!state.dirty) return;
    const edit = typedSelection(
      live, gridOf(live.body), state.targets, state.draft, factsOf(context.resourceId, live)
    );
    state.refusal = edit.refused;
    if (edit.refused === undefined && edit.ops.length > 0) {
      context.runtime?.apply(recalculating(context.register, context.resourceId, live, edit.ops));
    }
  };

  const start = (seed = "") => {
    const live = context.runtime?.sheet;
    const anchor = writingAnchor(context.selection);
    if (live === undefined || anchor === undefined) return;
    if (!state.editing) {
      state.editingAt = anchor;
      state.targets = writingTargets(gridOf(live.body), context.selection);
      state.dirty = false;
      state.refusal = undefined;
    }
    state.handoff = continueWritingHandoff(state.handoff, context.shown, seed);
    state.draft = state.handoff.text;
    state.dirty ||= seed !== "";
    state.span = undefined;
    state.editing = true;
    setTimeout(() => {
      const pending = state.handoff;
      const input = state.field;
      if (!state.editing || pending === undefined || input === null || !input.isConnected) return;
      input.focus();
      if (pending.selectAll) input.select();
      else input.setSelectionRange(pending.text.length, pending.text.length);
      state.handoff = undefined;
      state.caret = state.draft.length;
    }, 0);
  };

  return {
    start,
    commit,
    cancel: finish,
    changed: () => {
      state.span = undefined;
      state.dirty = true;
      state.caret = state.field?.selectionStart ?? state.draft.length;
    },
    keydown: (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
        channel.endWriting();
      } else if (event.key === "Enter") {
        event.preventDefault();
        commit();
        channel.endWriting();
      } else if (event.key === "F4") {
        event.preventDefault();
        context.cycle();
      }
    }
  };
};

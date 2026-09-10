<script lang="ts">
  import { Input } from "$vendored-components/input";
  import { cn } from "$vendored-components/utils";
  import { CellHeadState } from "$app-views/categories/spreadsheet-editor/components/cell-head.state.svelte";
  import { gridOf, keyOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import {
    anchorLabel,
    anchored,
    lockedAt,
    referenceAt
  } from "$app-views/categories/spreadsheet-editor/procedures/anchoring";
  import { cellAt, typed } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { editableOf, factsOf, recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { pickingChannel, type Picker } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";
  import { insertedReference } from "$app-views/categories/spreadsheet-editor/procedures/reference-picking";
  import { variableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { continueWritingHandoff } from "$app-views/categories/spreadsheet-editor/procedures/writing-handoff";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { runsTheWritingSession } from "$app-views/categories/spreadsheet-editor/procedures/effects/runs-the-writing-session.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const LOCKS = [
    { label: "free", column: false, row: false, hint: "Both halves move when this formula is copied" },
    { label: "both", column: true, row: true, hint: "Neither half moves" },
    { label: "row", column: false, row: true, hint: "The row is held still" },
    { label: "column", column: true, row: false, hint: "The column is held still" }
  ];

  const view = workspaceState();
  const channel = pickingChannel();
  const register = variableRegister();

  const sheetId = view.active.resourceId;

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const facts = $derived(factsOf(sheetId, sheet));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : cellAt(sheet, ref));
  const shown = $derived(editableOf(facts, held));
  const expression = $derived(held?.expression !== undefined);

  const state = new CellHeadState();

  const picker: Picker = {
    insert: (address, anchor, gesture) => {
      const input = state.field;
      if (input === null) return;
      const from = input.selectionStart ?? state.draft.length;
      const insertion = insertedReference(
        state.draft,
        address,
        anchor,
        gesture,
        { from, to: input.selectionEnd ?? from },
        state.span
      );
      state.draft = insertion.text;
      state.span = insertion.span;
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(insertion.caret, insertion.caret);
      }, 0);
    }
  };

  const formula = (text: string) => text.trimStart().startsWith("=");

  const picking = $derived(state.editing && formula(state.draft));

  const anchor = $derived(picking ? referenceAt(state.draft, state.caret) : undefined);

  const relock = (column: boolean, row: boolean) => {
    const input = state.field;
    if (input === null) return;
    const next = lockedAt(state.draft, state.caret, column, row);
    if (next === undefined) return;
    state.draft = next.text;
    state.span = undefined;
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(next.caret, next.caret);
      state.caret = next.caret;
    }, 0);
  };

  const track = () => {
    state.caret = state.field?.selectionStart ?? state.draft.length;
  };

  const start = (seed?: string) => {
    if (sheet === undefined || ref === undefined) return;
    state.handoff = continueWritingHandoff(state.handoff, shown, seed ?? "");
    state.draft = state.handoff.text;
    state.span = undefined;
    state.editingAt = ref;
    state.editing = true;
    setTimeout(() => {
      const pending = state.handoff;
      const input = state.field;
      if (pending === undefined || input === null) return;
      input.focus();
      if (pending.selectAll) input.select();
      else input.setSelectionRange(pending.text.length, pending.text.length);
      state.handoff = undefined;
      state.caret = state.draft.length;
    }, 0);
  };

  runsTheWritingSession({
    channel,
    picker,
    picking: () => picking,
    address: () => (
      state.editing && state.editingAt !== undefined ? keyOf(state.editingAt) : undefined
    ),
    draft: () => state.draft,
    selected: () => ref,
    abandon: () => {
      state.editing = false;
      state.handoff = undefined;
      state.refusal = undefined;
    },
    begin: (seed) => start(seed)
  });

  const commit = () => {
    const at = state.editingAt;
    const live = runtime?.sheet;
    const resourceId = view.active.resourceId;
    if (!state.editing || at === undefined || live === undefined) return;
    state.editing = false;
    channel.disarm(picker);
    const known = factsOf(resourceId, live);
    if (state.draft === editableOf(known, cellAt(live, at))) return;
    const edit = typed(live, gridOf(live.body), at, state.draft, known);
    if (edit.refused !== undefined) {
      state.refusal = edit.refused;
      return;
    }
    state.refusal = undefined;
    if (edit.ops.length > 0) runtime?.apply(recalculating(register, resourceId, live, edit.ops));
  };

  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      state.editing = false;
      channel.disarm(picker);
      channel.endWriting();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      channel.endWriting();
      return;
    }
    if (event.key === "F4") {
      const input = state.field;
      if (input === null) return;
      event.preventDefault();
      const held = anchored(state.draft, input.selectionStart ?? state.draft.length);
      if (held === undefined) return;
      state.draft = held.text;
      state.span = undefined;
      setTimeout(() => input.setSelectionRange(held.caret, held.caret), 0);
    }
  };
</script>

{#if sheet && ref}
  <div class="head">
    {#if state.editing}
      <Input
        bind:ref={state.field}
        bind:value={state.draft}
        aria-label={expression ? "Expression" : "Value"}
        class="text-body h-9 w-full font-mono"
        onkeydown={keydown}
        oninput={() => {
          state.span = undefined;
          track();
        }}
        onkeyup={track}
        onclick={track}
        onselect={track}
        onblur={() => {
          if (!formula(state.draft)) commit();
        }}
      />
      {#if anchor !== undefined}
        <div class="locks" role="group" aria-label="What copying holds still">
          {#each LOCKS as lock (lock.label)}
            <button
              type="button"
              class="lock"
              aria-pressed={anchor.column === lock.column && anchor.row === lock.row}
              title={lock.hint}
              onmousedown={(event) => event.preventDefault()}
              onclick={() => relock(lock.column, lock.row)}
            >
              {anchorLabel(anchor, lock.column, lock.row)}
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <button
        type="button"
        aria-label={expression ? "Expression" : "Value"}
        title={shown === "" ? "Write a value or a formula" : shown}
        class={cn(
          "text-body border-border-subtle hover:bg-surface-panel-hover rounded-control flex min-h-9 w-full items-center border border-transparent px-2 py-1 text-start font-mono",
          shown === "" ? "text-ink-muted italic" : "text-ink-primary"
        )}
        onclick={() => start()}
      >
        <span class="min-w-0 flex-1 truncate">{shown === "" ? "Empty" : shown}</span>
      </button>
    {/if}
    {#if state.refusal}
      <span class="text-caption text-danger-text">{state.refusal}</span>
    {/if}
  </div>
{/if}

<style>
  .head {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 1);
  }

  .locks {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: var(--token-hairline) solid var(--token-border-strong);
    border-radius: var(--token-radius-control);
  }

  .lock {
    flex: 1;
    border-radius: var(--token-radius-control);
    padding: calc(var(--token-spacing-unit) * 0.75) 0;
    color: var(--token-ink-secondary);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-caption);
    transition: background-color var(--token-motion-micro) var(--token-ease-standard);
  }

  .lock:hover {
    background-color: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .lock[aria-pressed="true"] {
    background-color: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }
</style>

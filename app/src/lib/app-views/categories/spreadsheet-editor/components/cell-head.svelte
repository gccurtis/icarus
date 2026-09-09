<script lang="ts">
  import { Input } from "$vendored-components/input";
  import { cn } from "$vendored-components/utils";
  import { gridOf, keyOf, type CellRef } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import {
    anchorLabel,
    anchored,
    lockedAt,
    referenceAt
  } from "$app-views/categories/spreadsheet-editor/procedures/anchoring";
  import { cellAt, typed } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { editableOf, factsOf, recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import {
    arm,
    disarm,
    drafting,
    endWriting,
    writingBegun,
    writingTaken,
    type Picker
  } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";
  import { selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const LOCKS = [
    { label: "free", column: false, row: false, hint: "Both halves move when this formula is copied" },
    { label: "both", column: true, row: true, hint: "Neither half moves" },
    { label: "row", column: false, row: true, hint: "The row is held still" },
    { label: "column", column: true, row: false, hint: "The column is held still" }
  ];

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const facts = $derived(factsOf(sheetId, sheet));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : cellAt(sheet, ref));
  const shown = $derived(editableOf(facts, held));
  const expression = $derived(held?.expression !== undefined);

  let editing = $state(false);
  let editingAt = $state<CellRef | undefined>(undefined);
  let draft = $state("");
  let field = $state<HTMLInputElement | null>(null);
  let span = $state<{ from: number; to: number; anchor: string } | undefined>(undefined);
  let refusal = $state<string | undefined>(undefined);

  const picker: Picker = {
    insert: (address, anchor) => {
      const input = field;
      if (input === null) return;
      const previous = span;
      const from = previous !== undefined && previous.anchor === anchor ? previous.from : (input.selectionStart ?? draft.length);
      const to = previous !== undefined && previous.anchor === anchor ? previous.to : (input.selectionEnd ?? from);
      draft = `${draft.slice(0, from)}${address}${draft.slice(to)}`;
      span = { from, to: from + address.length, anchor };
      const caret = from + address.length;
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(caret, caret);
      }, 0);
    }
  };

  $effect(() => {
    void ref;
    editing = false;
    refusal = undefined;
  });

  const formula = (text: string) => text.trimStart().startsWith("=");

  const picking = $derived(editing && formula(draft));

  $effect(() => {
    if (picking) arm(picker);
    else disarm(picker);
    return () => disarm(picker);
  });

  $effect(() => {
    drafting(editing && editingAt !== undefined ? { at: keyOf(editingAt), text: draft } : undefined);
    return () => drafting(undefined);
  });

  let caret = $state(0);

  const anchor = $derived(picking ? referenceAt(draft, caret) : undefined);

  const relock = (column: boolean, row: boolean) => {
    const input = field;
    if (input === null) return;
    const next = lockedAt(draft, caret, column, row);
    if (next === undefined) return;
    draft = next.text;
    span = undefined;
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(next.caret, next.caret);
      caret = next.caret;
    }, 0);
  };

  const track = () => {
    caret = field?.selectionStart ?? draft.length;
  };

  const start = (seed?: string) => {
    if (sheet === undefined || ref === undefined) return;
    draft = seed === undefined || seed === "" ? shown : seed;
    span = undefined;
    editingAt = ref;
    editing = true;
    setTimeout(() => {
      field?.focus();
      if (seed === undefined || seed === "") field?.select();
      else field?.setSelectionRange(draft.length, draft.length);
      caret = draft.length;
    }, 0);
  };

  $effect(() => {
    const wanted = writingBegun();
    if (wanted === undefined) return;
    writingTaken();
    start(wanted.seed);
  });

  const commit = () => {
    const at = editingAt;
    const live = runtime?.sheet;
    const resourceId = view.active.resourceId;
    if (!editing || at === undefined || live === undefined) return;
    editing = false;
    disarm(picker);
    const known = factsOf(resourceId, live);
    if (draft === editableOf(known, cellAt(live, at))) return;
    const edit = typed(live, gridOf(live.body), at, draft, known);
    if (edit.refused !== undefined) {
      refusal = edit.refused;
      return;
    }
    refusal = undefined;
    if (edit.ops.length > 0) runtime?.apply(recalculating(view.project, resourceId, live, edit.ops));
  };

  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      editing = false;
      disarm(picker);
      endWriting();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      endWriting();
      return;
    }
    if (event.key === "F4") {
      const input = field;
      if (input === null) return;
      event.preventDefault();
      const held = anchored(draft, input.selectionStart ?? draft.length);
      if (held === undefined) return;
      draft = held.text;
      span = undefined;
      setTimeout(() => input.setSelectionRange(held.caret, held.caret), 0);
    }
  };
</script>

{#if sheet && ref}
  <div class="head">
    {#if editing}
      <Input
        bind:ref={field}
        bind:value={draft}
        aria-label={expression ? "Expression" : "Value"}
        class="text-body h-9 w-full font-mono"
        onkeydown={keydown}
        oninput={() => {
          span = undefined;
          track();
        }}
        onkeyup={track}
        onclick={track}
        onselect={track}
        onblur={() => {
          if (!formula(draft)) commit();
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
    {#if refusal}
      <span class="text-caption text-danger-text">{refusal}</span>
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

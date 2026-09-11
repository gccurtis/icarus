<script lang="ts">
  import { Input } from "$vendored-components/input";
  import { cn } from "$vendored-components/utils";
  import { CellHeadState } from "$app-views/categories/spreadsheet-editor/components/cell-head.state.svelte";
  import { keyOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { anchorLabel, referenceAt } from "$app-views/categories/spreadsheet-editor/procedures/anchoring";
  import { cellAt } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { createCellReferenceActions } from "$app-views/categories/spreadsheet-editor/procedures/cell-reference-actions";
  import { createCellWritingActions } from "$app-views/categories/spreadsheet-editor/procedures/cell-writing-actions";
  import { editableOf, factsOf } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { pickingChannel } from "$app-views/categories/spreadsheet-editor/procedures/picking.svelte";
  import { variableRegister } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { writingAnchor } from "$app-views/categories/spreadsheet-editor/procedures/typing-selection";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { runsTheWritingSession } from "$app-views/categories/spreadsheet-editor/procedures/effects/runs-the-writing-session.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const LOCKS = [
    { label: "free", column: false, row: false, hint: "Rows and columns move when copied" },
    { label: "both", column: true, row: true, hint: "Lock rows and columns at both ends of a range" },
    { label: "row", column: false, row: true, hint: "Lock rows at both ends of a range" },
    { label: "column", column: true, row: false, hint: "Lock columns at both ends of a range" }
  ];

  const view = workspaceState();
  const channel = pickingChannel();
  const register = variableRegister();
  const sheetId = view.active.resourceId;
  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);
  const sheet = $derived(runtime?.sheet);
  const facts = $derived(factsOf(sheetId, sheet));
  const ref = $derived(writingAnchor(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : cellAt(sheet, ref));
  const shown = $derived(editableOf(facts, held));
  const expression = $derived(held?.expression !== undefined);
  const state = new CellHeadState();
  const formula = (text: string) => text.trimStart().startsWith("=");
  const picking = $derived(state.editing && formula(state.draft));
  const anchor = $derived(picking ? referenceAt(state.draft, state.caret) : undefined);
  const { picker, relock, cycle, track } = createCellReferenceActions(state);
  const { start, commit, cancel, changed, keydown } = createCellWritingActions({
    state, channel, picker, register, cycle,
    resourceId: sheetId,
    get runtime() { return runtime; },
    get selection() { return view.selection; },
    get shown() { return shown; }
  });

  runsTheWritingSession({
    channel, picker, commit, cancel,
    picking: () => picking,
    address: () => state.editing && state.editingAt !== undefined ? keyOf(state.editingAt) : undefined,
    targets: () => state.targets.map(keyOf),
    draft: () => state.draft,
    selected: () => view.selection,
    begin: start
  });
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
        oninput={changed}
        onkeyup={track}
        onclick={track}
        onselect={track}
        onblur={() => {
          if (!formula(state.draft)) commit();
        }}
      />
      {#if anchor !== undefined}
        <div class="locks" class:is-range={anchor.last !== undefined} role="group" aria-label="What copying holds still">
          {#each LOCKS as lock (lock.label)}
            <button
              type="button"
              class="lock"
              aria-pressed={anchor.column === lock.column && anchor.row === lock.row}
              title={`${anchorLabel(anchor, lock.column, lock.row)} — ${lock.hint}`}
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
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 1);
  }

  .locks {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    padding: 2px;
    border: var(--token-hairline) solid var(--token-border-strong);
    border-radius: var(--token-radius-control);
  }

  .locks.is-range {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .lock {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

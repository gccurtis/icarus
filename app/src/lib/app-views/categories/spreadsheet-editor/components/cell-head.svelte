<script lang="ts">
  import { Input } from "$vendored-components/input";
  import { cn } from "$vendored-components/utils";
  import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { anchored } from "$app-views/categories/spreadsheet-editor/procedures/anchoring";
  import { cellAt, typed } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { withRecalculation } from "$app-views/categories/spreadsheet-editor/procedures/evaluate";
  import { arm, disarm, type Picker } from "$app-views/categories/spreadsheet-editor/procedures/picking";
  import { selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { rawOf } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : cellAt(sheet, ref));
  const shown = $derived(rawOf(held));
  const expression = $derived(held?.expression !== undefined);

  let editing = $state(false);
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

  const picking = $derived(editing && draft.trimStart().startsWith("="));

  $effect(() => {
    if (picking) arm(picker);
    else disarm(picker);
    return () => disarm(picker);
  });

  const start = () => {
    if (sheet === undefined || ref === undefined) return;
    draft = shown;
    span = undefined;
    editing = true;
    setTimeout(() => {
      field?.focus();
      field?.select();
    }, 0);
  };

  const commit = () => {
    if (!editing || sheet === undefined || ref === undefined) return;
    editing = false;
    disarm(picker);
    if (draft === shown) return;
    const edit = typed(sheet, grid, ref, draft);
    if (edit.refused !== undefined) {
      refusal = edit.refused;
      return;
    }
    refusal = undefined;
    if (edit.ops.length > 0) runtime?.apply(withRecalculation(sheet, edit.ops));
  };

  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      editing = false;
      disarm(picker);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
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
        oninput={() => (span = undefined)}
        onblur={() => {
          if (!picking) commit();
        }}
      />
    {:else}
      <button
        type="button"
        aria-label={expression ? "Expression" : "Value"}
        title={shown === "" ? "Write a value or a formula" : shown}
        class={cn(
          "text-body border-border-subtle hover:bg-surface-panel-hover rounded-control flex min-h-9 w-full items-center border border-transparent px-2 py-1 text-start font-mono",
          shown === "" ? "text-ink-muted italic" : "text-ink-primary"
        )}
        onclick={start}
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
</style>

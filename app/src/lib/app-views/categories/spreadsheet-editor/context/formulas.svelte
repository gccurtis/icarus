<script lang="ts">
  import SquareFunction from "@lucide/svelte/icons/square-function";

  import { OverlayModal } from "$authored-components/overlay";
  import {
    Panel,
    PanelButton,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelInput,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import {
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenRow,
    ScreenTable
  } from "$authored-components/screen";
  import { Textarea } from "$vendored-components/textarea";
  import { gridOf, labelOf, type CellRef } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { BUILTINS, type Builtin } from "$app-views/categories/spreadsheet-editor/procedures/builtins";
  import { typed } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { factsOf, recalculating } from "$app-views/categories/spreadsheet-editor/procedures/recalculation";
  import { formulaRows, matchesFilter } from "$app-views/categories/spreadsheet-editor/procedures/formulas";
  import { cellSignal, selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const facts = $derived(factsOf(sheetId, sheet));

  let filter = $state("");
  let building = $state(false);
  let draft = $state("");
  let search = $state("");
  let picked = $state<string | undefined>(undefined);

  const rows = $derived(sheet === undefined ? [] : formulaRows(sheet, facts));
  const shown = $derived(rows.filter((row) => matchesFilter(row, filter)));
  const formulas = $derived(shown.filter((row) => row.error === undefined));
  const problems = $derived(shown.filter((row) => row.error !== undefined));
  const current = $derived(selectedRef(view.selection));

  const matching = $derived(
    BUILTINS.filter((builtin) => {
      const needle = search.trim().toLowerCase();
      return needle === "" || builtin.signature.toLowerCase().includes(needle) || builtin.description.toLowerCase().includes(needle);
    })
  );
  const groups = $derived([...new Set(matching.map((builtin) => builtin.category))]);

  const isCurrent = (ref: CellRef): boolean =>
    current !== undefined && current.rowId === ref.rowId && current.columnId === ref.columnId;

  const go = (ref: CellRef) => {
    if (sheet === undefined || runtime === undefined) return;
    runtime.scrollTo = ref;
    const signal = cellSignal(sheet, grid, ref);
    view.inspect(signal.key, signal.selection);
  };

  const add = (builtin: Builtin) => {
    picked = builtin.id;
    draft = draft.trim() === "" ? `=${builtin.signature}` : `${draft}${builtin.signature}`;
  };

  const reset = () => {
    draft = "";
    search = "";
    picked = undefined;
  };

  const insert = () => {
    const expression = draft.trim();
    if (sheet === undefined || current === undefined || expression === "") {
      reset();
      return;
    }
    const edit = typed(sheet, grid, current, expression.startsWith("=") ? expression : `=${expression}`, facts);
    if (edit.refused === undefined && edit.ops.length > 0) runtime?.apply(recalculating(view.project, sheetId, sheet, edit.ops));
    reset();
  };
</script>

<Panel title="Formulas">
  {#snippet actions()}
    <PanelButton
      label="Formula"
      icon={SquareFunction}
      tone="primary"
      disabled={sheet === undefined || current === undefined}
      title={current === undefined ? "Select a cell on the grid first" : `Write a formula into ${labelOf(grid, current)}`}
      onclick={() => (building = true)}
    />
  {/snippet}

  {#if sheet}
    <div class="filter">
      <PanelInput label="Filter" placeholder="Address or formula…" flush bind:value={filter} />
    </div>

    <PanelSection title="Problems" count={problems.length} flush>
      {#each problems as row (`${row.ref.rowId}/${row.ref.columnId}`)}
        <PanelRow
          title={`${row.label} · ${row.error}`}
          sub={row.expression}
          tone="danger"
          titleTone="danger"
          selected={isCurrent(row.ref)}
          onselect={() => go(row.ref)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Formulas" count={filter === "" ? formulas.length : `${formulas.length} of ${rows.filter((row) => row.error === undefined).length}`} flush>
      {#each formulas as row (`${row.ref.rowId}/${row.ref.columnId}`)}
        <PanelRow title={`${row.label} · ${row.shows}`} sub={row.expression} selected={isCurrent(row.ref)} onselect={() => go(row.ref)} />
      {/each}
    </PanelSection>
  {:else}
    <PanelEmpty title="Open a spreadsheet to list its formulas" />
  {/if}
</Panel>

<OverlayModal
  bind:open={building}
  title="Formula"
  description={current === undefined ? undefined : `Into ${labelOf(grid, current)}`}
  confirm="Insert"
  unsaved={draft.trim() !== ""}
  width="wide"
  onconfirm={insert}
  oncancel={reset}
>
  <div class="grid gap-3 px-3">
    <PanelFields>
      <PanelField label="Expression" stacked>
        <Textarea bind:value={draft} rows={3} class="font-mono text-mono" placeholder="=SUM(B4:B17)" />
      </PanelField>
    </PanelFields>

    <ScreenFilters placeholder="Search functions" matched={matching.length} total={BUILTINS.length} bind:value={search} />

    {#if matching.length === 0}
      <ScreenEmpty kind="no-matches" title="Nothing matches" onclear={() => (search = "")}>
        No function has that in its name or its description.
      </ScreenEmpty>
    {:else}
      <ScreenTable columns={["Function", "What it does"]}>
        {#each groups as group (group)}
          <ScreenGroup label={group} count={String(matching.filter((builtin) => builtin.category === group).length)}>
            {#each matching.filter((builtin) => builtin.category === group) as builtin (builtin.id)}
              <ScreenRow selected={picked === builtin.id}>
                <ScreenCell name={builtin.signature} onselect={() => add(builtin)} />
                <ScreenCell>{builtin.description}</ScreenCell>
              </ScreenRow>
            {/each}
          </ScreenGroup>
        {/each}
      </ScreenTable>
    {/if}
  </div>
</OverlayModal>

<style>
  .filter {
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) 0;
  }
</style>

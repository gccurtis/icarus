<script lang="ts">
  import { read, update } from "$capabilities/store/index.remote";
  import { Panel, PanelEditableText, PanelEmpty, PanelField, PanelFields, PanelSection } from "$authored-components/panel";
  import { gridOf, rectLabelOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { problemsOf } from "$app-views/categories/spreadsheet-editor/procedures/references";
  import { formulaCount, populatedCount, usedRect } from "$app-views/categories/spreadsheet-editor/procedures/stats";
  import { workspaceState, type SpreadsheetRuntime, type SyncState } from "$model/client/workspace-state";

  const SYNC_LABEL: Record<SyncState, string> = {
    loading: "Loading",
    saved: "Saved",
    saving: "Saving",
    rebasing: "Rebasing",
    "needs-review": "Needs review",
    offline: "Offline",
    error: "Not saved"
  };

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const used = $derived(sheet === undefined ? undefined : usedRect(sheet, grid));

  const titleQuery = $derived(sheetId === undefined ? undefined : read({ path: `spreadsheets.${sheetId}.title` }));
  const title = $derived.by(() => {
    const query = titleQuery;
    if (query === undefined || !query.ready) return "";
    const found = query.current;
    return found?.kind === "field" && typeof found.value === "string" ? found.value : "";
  });

  const rename = async (next: string) => {
    if (sheetId === undefined || next.trim() === "" || next === title) return;
    await update({ path: `spreadsheets.${sheetId}.title`, value: next.trim() });
    await titleQuery?.refresh();
  };
</script>

<Panel title="Spreadsheet">
  {#if sheet}
    <PanelSection title="This spreadsheet">
      <PanelEditableText label="Title" value={title} placeholder="Untitled" onchange={(next) => void rename(next)} />
      <PanelFields>
        <PanelField label="Used range" mono>{used === undefined ? "Empty" : rectLabelOf(grid, used)}</PanelField>
        <PanelField label="Values">{populatedCount(sheet, grid)}</PanelField>
        <PanelField label="Formulas">{formulaCount(sheet)}</PanelField>
        <PanelField label="Problems">{problemsOf(sheet, grid).length}</PanelField>
        <PanelField label="Saved">{SYNC_LABEL[runtime?.sync ?? "loading"]} · revision {runtime?.revision ?? 0}</PanelField>
      </PanelFields>
    </PanelSection>
  {:else}
    <PanelEmpty title="Open a spreadsheet to inspect it" />
  {/if}
</Panel>

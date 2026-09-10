<script lang="ts">
  import { renameSheet, titleOf, titleQuery } from "$app-views/categories/spreadsheet-editor/procedures/store";
  import { Panel, PanelEditableText, PanelEmpty, PanelField, PanelFields, PanelSection } from "$authored-components/panel";
  import { gridOf, rectLabelOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { problemsOf } from "$app-views/categories/spreadsheet-editor/procedures/references";
  import { formulaCount, populatedCount, usedRect } from "$app-views/categories/spreadsheet-editor/procedures/stats";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { workspaceState, type SyncState } from "$model/client/workspace-state";

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

  const sheetId = view.active.resourceId;

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const used = $derived(sheet === undefined ? undefined : usedRect(sheet, grid));

  const query = $derived(sheetId === undefined ? undefined : titleQuery(sheetId));
  const title = $derived(titleOf(query));

  const rename = (next: string) => renameSheet(sheetId, next, title, query);
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

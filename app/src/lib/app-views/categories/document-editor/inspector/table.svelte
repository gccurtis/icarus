<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelNumber,
    PanelSection
  } from "$authored-components/panel";
  import {
    blockIn,
    placementOf,
    tableShapeOps
  } from "$app-views/categories/document-editor/procedures/blocks";
  import { DEFAULT_PAGE_SETUP, layoutMetrics } from "$app-views/categories/document-editor/procedures/page-setup";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const blockId = $derived(view.selection?.id ?? "");
  const held = $derived(body === undefined ? undefined : blockIn(body, blockId));
  const table = $derived(held?.type === "table" ? held : undefined);
  const metrics = $derived(layoutMetrics(body?.pageSetup ?? DEFAULT_PAGE_SETUP));
  const placement = $derived(body === undefined || table === undefined ? undefined : placementOf(body, table.id, metrics));

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const reshape = (shape: Parameters<typeof tableShapeOps>[1]) => {
    if (table === undefined) return;
    commit(tableShapeOps(table, shape));
  };

  const navigate = (next: string) => {
    if (isInspectorView(next)) view.inspect(next);
  };
</script>

<Panel title="Table">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Document", key: "document-editor.document" }, { label: "Table" }]}
      onnavigate={navigate}
    />
  {/snippet}

  {#if table === undefined}
    <div class="pt-2">
      <PanelNote tone="muted">The table is gone.</PanelNote>
    </div>
  {:else}
    <PanelSection title="Shape">
      <PanelFields>
        <PanelField label="Rows" stacked>
          <PanelNumber label="Rows" value={table.rows.length} min={1} max={200} flush onchange={(next) => reshape({ rows: next })} />
        </PanelField>
        <PanelField label="Columns" stacked>
          <PanelNumber label="Columns" value={table.rows[0]?.cells.length ?? 1} min={1} max={30} flush onchange={(next) => reshape({ columns: next })} />
        </PanelField>
        <PanelField label="Header rows" stacked>
          <PanelNumber label="Header rows" value={table.headerRows} min={0} max={table.rows.length} flush onchange={(next) => reshape({ headerRows: next })} />
        </PanelField>
      </PanelFields>
    </PanelSection>

    {#if placement !== undefined}
      <PanelSection title="Placement" chevron="end">
        <PanelFields>
          <PanelField label="Page" mono stacked>{placement.page}</PanelField>
          <PanelField label="In row" mono stacked>{placement.index} of {placement.of}</PanelField>
        </PanelFields>
      </PanelSection>
    {/if}
  {/if}
</Panel>

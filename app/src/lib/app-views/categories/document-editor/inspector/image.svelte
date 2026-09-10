<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelInput,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import {
    blockIn,
    imageOps,
    placementOf
  } from "$app-views/categories/document-editor/procedures/blocks";
  import { DEFAULT_PAGE_SETUP, layoutMetrics } from "$app-views/categories/document-editor/procedures/page-setup";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const documentId = view.active.resourceId;

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const blockId = $derived(view.selection?.id ?? "");
  const held = $derived(body === undefined ? undefined : blockIn(body, blockId));
  const image = $derived(held?.type === "image" ? held : undefined);
  const url = $derived(image?.source?.kind === "url" ? image.source.url : "");
  const metrics = $derived(layoutMetrics(body?.pageSetup ?? DEFAULT_PAGE_SETUP));
  const placement = $derived(body === undefined || image === undefined ? undefined : placementOf(body, image.id, metrics));

  let draft = $state("");

  $effect(() => {
    draft = url;
  });

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const change = (patch: Parameters<typeof imageOps>[1]) => {
    if (image === undefined) return;
    commit(imageOps(image, patch));
  };

  const navigate = (next: string) => {
    if (isInspectorView(next)) view.inspect(next);
  };
</script>

<Panel title="Image">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Document", key: "document-editor.document" }, { label: "Image" }]}
      onnavigate={navigate}
    />
  {/snippet}

  {#if image === undefined}
    <div class="pt-2">
      <PanelNote tone="muted">The image is gone.</PanelNote>
    </div>
  {:else}
    {#if url.length > 0}
      <div class="px-3 pt-2">
        <img src={url} alt={image.alt} class="rounded-control border-border-subtle max-h-40 w-full border object-contain" />
      </div>
    {/if}

    <PanelSection title="Source">
      <PanelFields>
        <PanelField label="URL" stacked>
          <PanelInput label="Image URL" placeholder="https://" mono flush bind:value={draft} onenter={(next) => change({ url: next.trim() })} />
        </PanelField>
        <PanelField label="Alt text" stacked>
          <PanelEditableText label="Alt text" value={image.alt} placeholder="Describe the image" multiline onchange={(next) => change({ alt: next })} />
        </PanelField>
      </PanelFields>
      {#if url.length === 0}
        <PanelNote tone="muted">Paste an address and press Enter. Files come later.</PanelNote>
      {/if}
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

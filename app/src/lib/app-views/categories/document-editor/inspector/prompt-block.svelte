<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import PromptOutput from "$app-views/categories/document-editor/components/prompt-output.svelte";
  import { blockIn, placementOf } from "$app-views/categories/document-editor/procedures/blocks";
  import {
    DEFAULT_PAGE_SETUP,
    layoutMetrics
  } from "$app-views/categories/document-editor/procedures/page-setup";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime>();
  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const blockId = $derived(view.selection?.id ?? "");
  const held = $derived(body === undefined ? undefined : blockIn(body, blockId));
  const prompt = $derived(held?.type === "prompt" ? held : undefined);
  const metrics = $derived(layoutMetrics(body?.pageSetup ?? DEFAULT_PAGE_SETUP));
  const placement = $derived(
    body === undefined || prompt === undefined ? undefined : placementOf(body, prompt.id, metrics)
  );

  const navigate = (next: string) => {
    if (isInspectorView(next)) view.inspect(next);
  };
</script>

<Panel title="Prompt block">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Document", key: "document-editor.document" }, { label: "Prompt block" }]}
      onnavigate={navigate}
    />
  {/snippet}

  {#if prompt === undefined}
    <div class="pt-2">
      <PanelNote tone="muted">The Prompt Block is gone.</PanelNote>
    </div>
  {:else if prompt.derivedOutputId === undefined}
    <div class="pt-2">
      <PanelNote tone="gap">This block has no Derived Output ID. Recreate it from Prompts.</PanelNote>
    </div>
  {:else}
    <div class="pt-2">
      <PromptOutput derivedOutputId={prompt.derivedOutputId} surface="inspector" />
    </div>

    {#if placement !== undefined}
      <PanelSection title="Placement" chevron="end">
        <PanelFields>
          <PanelField label="Page" mono stacked>{placement.page}</PanelField>
          <PanelField label="In row" mono stacked>{placement.index} of {placement.of}</PanelField>
        </PanelFields>
      </PanelSection>
    {/if}

    <PanelNote>
      The document stores this block and its ID. The response, revision, and evidence above are read
      live from the Derived Output.
    </PanelNote>
  {/if}
</Panel>

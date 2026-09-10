<script lang="ts">
  import { Panel, PanelBranch, PanelEmpty, PanelRow, PanelTree } from "$authored-components/panel";
  import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
  import {
    outlineOf,
    whereabouts,
    type Section
  } from "$app-views/categories/document-editor/procedures/outline";
  import { DEFAULT_PAGE_SETUP, layoutMetrics } from "$app-views/categories/document-editor/procedures/page-setup";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const documentId = view.active.resourceId;

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const metrics = $derived(layoutMetrics(body?.pageSetup ?? DEFAULT_PAGE_SETUP));
  const sections = $derived(body === undefined ? [] : outlineOf(body, metrics));
  const current = $derived(view.selection === undefined ? undefined : addressOf(view.selection.id)?.blockId);

  const go = (section: Section) => {
    if (runtime === undefined) return;
    runtime.scrollTo = section.blockId;
    view.inspect("document-editor.next-letter", {
      kind: "next-letter",
      id: `${section.blockId}/atoms/${section.atomId}@0`
    });
  };
</script>

{#snippet branch(section: Section)}
  {#if section.children.length > 0}
    <PanelBranch
      label={section.title}
      meta={whereabouts(section)}
      badge={`H${section.level}`}
      open
      selected={current === section.blockId}
      onselect={() => go(section)}
    >
      {#each section.children as child (child.blockId)}
        {@render branch(child)}
      {/each}
    </PanelBranch>
  {:else}
    <PanelRow
      title={section.title}
      meta={whereabouts(section)}
      badge={`H${section.level}`}
      selected={current === section.blockId}
      onselect={() => go(section)}
    />
  {/if}
{/snippet}

<Panel title="Sections">
  {#if body === undefined}
    <PanelEmpty title="Open a document to see its sections" />
  {:else if sections.length === 0}
    <PanelEmpty title="No headings yet" action="Headings appear here as you add them" />
  {:else}
    <PanelTree label="Sections">
      {#each sections as section (section.blockId)}
        {@render branch(section)}
      {/each}
    </PanelTree>
  {/if}
</Panel>

<script lang="ts">
  import { Panel, PanelCrumbs, PanelEmpty } from "$authored-components/panel";
  import TextSpacing from "$app-views/categories/presentation-editor/components/text-spacing.svelte";
  import TextStyle from "$app-views/categories/presentation-editor/components/text-style.svelte";
  import { blockIn } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { rangeOf, slideSignal } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
  });

  const body = $derived(runtime?.body);
  const range = $derived(rangeOf(view.selection));
  const block = $derived(body === undefined || range === undefined ? undefined : blockIn(body, range.blockId));
  const position = $derived(body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined) + 1);
</script>

<Panel title="Text">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: `Slide ${position}`, key: "presentation-editor.slide" }, { label: "Text" }, { label: "Caret" }]}
      onnavigate={() => { const slideId = body?.slides[position - 1]?.id; if (slideId) view.inspect("presentation-editor.slide", slideSignal(slideId).selection); }}
    />
  {/snippet}

  {#if block && range}
    <TextStyle blockId={block.id} from={range.from} to={range.from} />
    <TextSpacing blockId={block.id} />
  {:else}
    <PanelEmpty title="Put the caret in some text on the slide" />
  {/if}
</Panel>

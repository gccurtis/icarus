<script lang="ts">
  import { Panel, PanelCrumbs, PanelEmpty } from "$authored-components/panel";
  import TextSpacing from "$app-views/categories/slide-deck-editor/components/text-spacing.svelte";
  import TextStyle from "$app-views/categories/slide-deck-editor/components/text-style.svelte";
  import { blockIn, slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { rangeOf, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const range = $derived(rangeOf(view.selection));
  const block = $derived(body === undefined || range === undefined ? undefined : blockIn(body, range.blockId));
  const position = $derived(body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined) + 1);
</script>

<Panel title="Text">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Text" }, { label: "Caret" }]}
      onnavigate={() => { const slideId = body?.slides[position - 1]?.id; if (slideId) view.inspect("slide-deck-editor.slide", slideSignal(slideId).selection); }}
    />
  {/snippet}

  {#if block && range}
    <TextStyle blockId={block.id} from={range.from} to={range.from} />
    <TextSpacing blockId={block.id} />
  {:else}
    <PanelEmpty title="Put the caret in some text on the slide" />
  {/if}
</Panel>

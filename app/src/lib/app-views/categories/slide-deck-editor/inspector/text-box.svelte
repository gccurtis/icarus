<script lang="ts">
  import { Panel, PanelCrumbs, PanelEmpty, PanelSection, PanelSelect } from "$authored-components/panel";
  import CommentAction from "$app-views/categories/slide-deck-editor/components/comment-action.svelte";
  import PromptAction from "$app-views/categories/slide-deck-editor/components/prompt-action.svelte";
  import ElementEffects from "$app-views/categories/slide-deck-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/slide-deck-editor/components/element-geometry.svelte";
  import ElementOrder from "$app-views/categories/slide-deck-editor/components/element-order.svelte";
  import ElementPaint from "$app-views/categories/slide-deck-editor/components/element-paint.svelte";
  import TextSpacing from "$app-views/categories/slide-deck-editor/components/text-spacing.svelte";
  import TextStyle from "$app-views/categories/slide-deck-editor/components/text-style.svelte";
  import { elementIn, slideHolding, slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { selectedIds, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const KIND = [{ value: "text", label: "Text box" }];

  const view = workspaceState();
  const deckId = view.active.resourceId;
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const id = $derived(selectedIds(view.selection)[0]);
  const element = $derived(body === undefined || id === undefined ? undefined : elementIn(body, id));
  const slide = $derived(body === undefined || id === undefined ? undefined : slideHolding(body, id));
  const position = $derived(body === undefined || slide === undefined ? 0 : slideIndexOf(body, slide.id) + 1);
  const block = $derived(element?.content.type === "text" ? element.content.block : undefined);

</script>

<Panel title="Text box">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Deck" }, { label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Text box" }]}
      onnavigate={() => { if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}
  {#snippet actions()}
    {#if element}
      <PromptAction elementId={element.id} />
      <CommentAction elementId={element.id} />
    {/if}
  {/snippet}

  {#if element && block}
    <PanelSection title="Kind">
      <PanelSelect label="Kind" value="text" options={KIND} disabled />
    </PanelSection>
    <TextStyle blockId={block.id} whole wrapping />
    <ElementGeometry elementId={element.id} />
    <ElementPaint elementId={element.id} />
    <ElementOrder elementId={element.id} />
    <TextSpacing blockId={block.id} />
    <ElementEffects elementId={element.id} />
  {:else}
    <PanelEmpty title="Pick a text box on the slide" />
  {/if}
</Panel>

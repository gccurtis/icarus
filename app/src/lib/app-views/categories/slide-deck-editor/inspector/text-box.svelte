<script lang="ts">
  import { Panel, PanelChoice, PanelCrumbs, PanelEmpty, PanelSection } from "$authored-components/panel";
  import CommentAction from "$app-views/categories/slide-deck-editor/components/comment-action.svelte";
  import ElementEffects from "$app-views/categories/slide-deck-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/slide-deck-editor/components/element-geometry.svelte";
  import ElementOrder from "$app-views/categories/slide-deck-editor/components/element-order.svelte";
  import ElementPaint from "$app-views/categories/slide-deck-editor/components/element-paint.svelte";
  import TextStyle from "$app-views/categories/slide-deck-editor/components/text-style.svelte";
  import { elementIn, slideHolding, slideIndexOf, withSet } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { selectedIds, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const OVERFLOW = [
    { value: "grow", label: "Grow" },
    { value: "shrink", label: "Shrink" },
    { value: "clip", label: "Clip" }
  ];

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
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

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, path, value).ops);
  };
</script>

<Panel title="Text">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Deck" }, { label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Text" }]}
      onnavigate={() => { if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}
  {#snippet actions()}
    {#if element}
      <CommentAction elementId={element.id} />
    {/if}
  {/snippet}

  {#if element && block}
    <TextStyle blockId={block.id} whole />
    <PanelSection title="Height">
      <PanelChoice label="Height" value={element.overflow ?? "clip"} options={OVERFLOW} flush fill onchange={(value) => set(`${element.id}/overflow`, value)} />
    </PanelSection>
    <ElementGeometry elementId={element.id} />
    <ElementPaint elementId={element.id} />
    <ElementEffects elementId={element.id} />
    <ElementOrder elementId={element.id} />
  {:else}
    <PanelEmpty title="Pick a text box on the slide" />
  {/if}
</Panel>

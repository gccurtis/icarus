<script lang="ts">
  import { Panel, PanelCrumbs, PanelEmpty, PanelNote, PanelSection, PanelSelect } from "$authored-components/panel";
  import CommentAction from "$app-views/categories/slide-deck-editor/components/comment-action.svelte";
  import ElementEffects from "$app-views/categories/slide-deck-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/slide-deck-editor/components/element-geometry.svelte";
  import ElementOrder from "$app-views/categories/slide-deck-editor/components/element-order.svelte";
  import ElementPaint from "$app-views/categories/slide-deck-editor/components/element-paint.svelte";
  import { elementIn, slideHolding, slideIndexOf, withSet } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { selectedIds, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const KINDS = ["rectangle", "ellipse", "triangle", "diamond", "arrow", "callout"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

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
  const content = $derived(element?.content.type === "shape" ? element.content : undefined);

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, path, value).ops);
  };
</script>

<Panel title="Shape">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Deck" }, { label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Shape" }]}
      onnavigate={() => { if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}
  {#snippet actions()}
    {#if element}
      <CommentAction elementId={element.id} />
    {/if}
  {/snippet}

  {#if element && content}
    <PanelSection title="Kind">
      <PanelSelect label="Shape" value={content.shape} options={KINDS} onchange={(value) => set(`${element.id}/content/shape`, value)} />
    </PanelSection>
    <ElementGeometry elementId={element.id} />
    <ElementPaint elementId={element.id} />
    <ElementEffects elementId={element.id} />
    <ElementOrder elementId={element.id} />
    {#if element.fromPlaceholder}
      <PanelSection title="Origin" open={false} chevron="end">
        <PanelNote>From the layout's “{element.fromPlaceholder}” placeholder.</PanelNote>
      </PanelSection>
    {/if}
  {:else}
    <PanelEmpty title="Pick a shape on the slide" />
  {/if}
</Panel>

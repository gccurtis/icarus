<script lang="ts">
  import { Panel, PanelButton, PanelCrumbs, PanelEmpty, PanelRow, PanelSection } from "$authored-components/panel";
  import ArrangeSection from "$app-views/categories/slide-deck-editor/components/arrange-section.svelte";
  import CommentAction from "$app-views/categories/slide-deck-editor/components/comment-action.svelte";
  import ElementEffects from "$app-views/categories/slide-deck-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/slide-deck-editor/components/element-geometry.svelte";
  import { withUngrouped } from "$app-views/categories/slide-deck-editor/procedures/deck-layering";
  import { slideHolding } from "$app-views/categories/slide-deck-editor/procedures/deck-slide-holding";
  import { elementIn, labelOf } from "$app-views/categories/slide-deck-editor/procedures/deck-reading";
  import { slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck-slides";
  import { elementsSignal, selectedIds, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

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
  const children = $derived(element?.content.type === "group" ? [...element.content.children].reverse() : []);

  const ungroup = () => {
    if (body === undefined || element === undefined) return;
    runtime?.apply(withUngrouped(body, element.id).ops);
    if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection);
  };
</script>

<Panel title="Group">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Deck" }, { label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Group" }]}
      onnavigate={() => { if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}
  {#snippet actions()}
    {#if element}
      <PanelButton label="Ungroup" onclick={ungroup} />
      <CommentAction elementId={element.id} />
    {/if}
  {/snippet}

  {#if element}
    <PanelSection title="Members" count={children.length} flush>
      {#each children as child (child.id)}
        <PanelRow title={labelOf(child)} sub={child.content.type} onselect={() => { const signal = elementsSignal([child]); if (signal) view.inspect(signal.key, signal.selection); }} />
      {/each}
    </PanelSection>
    <ElementGeometry elementId={element.id} />
    <ArrangeSection groupId={element.id} />
    <ElementEffects elementId={element.id} corner={false} />
  {:else}
    <PanelEmpty title="Pick a group on the slide" />
  {/if}
</Panel>

<script lang="ts">
  import { Panel, PanelCrumbs, PanelEditableText, PanelEmpty, PanelField, PanelFields, PanelInput, PanelNote, PanelSection } from "$authored-components/panel";
  import CommentAction from "$app-views/categories/slide-deck-editor/components/comment-action.svelte";
  import ElementEffects from "$app-views/categories/slide-deck-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/slide-deck-editor/components/element-geometry.svelte";
  import ElementOrder from "$app-views/categories/slide-deck-editor/components/element-order.svelte";
  import { elementIn, slideHolding, slideIndexOf, withSet } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { selectedIds, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

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
  const image = $derived(element?.content.type === "image" ? element.content.block : undefined);

  let url = $state("");
  $effect(() => {
    url = image?.source?.kind === "url" ? image.source.url : "";
  });

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, path, value).ops);
  };
</script>

<Panel title="Image">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Deck" }, { label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Image" }]}
      onnavigate={() => { if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}
  {#snippet actions()}
    {#if element}
      <CommentAction elementId={element.id} />
    {/if}
  {/snippet}

  {#if element && image}
    <PanelSection title="Source">
      <PanelFields>
        <PanelField label="Kind">{image.source?.kind ?? "none yet"}</PanelField>
        <PanelField label="Alt text" stacked>
          <PanelEditableText value={image.alt} label="Alt text" placeholder="Describe the picture" multiline onchange={(value) => set(`${element.id}/content/block/alt`, value)} />
        </PanelField>
      </PanelFields>
      <PanelInput label="Image URL" placeholder="https://" bind:value={url} onenter={(value) => set(`${element.id}/content/block/source`, value.trim() === "" ? null : { kind: "url", url: value.trim() })} />
      <PanelNote>Enter sets the picture from a URL. Files from the project arrive with the file picker.</PanelNote>
    </PanelSection>
    <ElementGeometry elementId={element.id} />
    <ElementOrder elementId={element.id} />
    <ElementEffects elementId={element.id} />
  {:else}
    <PanelEmpty title="Pick a picture on the slide" />
  {/if}
</Panel>

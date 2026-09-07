<script lang="ts">
  import { Panel, PanelCrumbs, PanelEmpty } from "$authored-components/panel";
  import { SlideSurfaceText, type SurfaceTextEdit } from "$authored-components/slide-surface";
  import TextStyle from "$app-views/categories/slide-deck-editor/components/text-style.svelte";
  import { emptyText, notesBlock, slideIndexOf, styleOf, withNotes } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { colorOf, textSceneOf } from "$app-views/categories/slide-deck-editor/procedures/scene";
  import { slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { replaced } from "$app-views/categories/slide-deck-editor/procedures/typing";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const slideId = $derived(view.selection?.kind === "notes" ? view.selection.id : view.active.focus ?? undefined);
  const slide = $derived(body?.slides.find((held) => held.id === slideId) ?? body?.slides[0]);
  const position = $derived(body === undefined || slide === undefined ? 0 : slideIndexOf(body, slide.id) + 1);
  const block = $derived(slide === undefined ? undefined : notesBlock(slide));
  const scene = $derived(
    body === undefined || block === undefined
      ? undefined
      : { ...textSceneOf(block, styleOf(body, block), body.theme), size: block.format?.fontSize ?? 14, lineHeight: block.format?.lineHeight ?? 1.5, padding: 0 }
  );
  const backdrop = $derived(colorOf(block?.format?.background, "var(--token-surface-elevated)"));

  let range = $state({ from: 0, to: 0 });

  const start = () => {
    if (body === undefined || slide === undefined) return;
    runtime?.apply(withNotes(body, slide.id, emptyText(undefined, "")).ops);
  };

  const edited = (change: SurfaceTextEdit) => {
    if (block === undefined) return;
    runtime?.apply(replaced(block, change.from, change.to, change.insert));
  };
</script>

<Panel title="Speaker notes">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Deck" }, { label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Notes" }]}
      onnavigate={() => { if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}

  {#if body && slide}
    {#if block && scene}
      <div class="notes text-body-sm border-border-subtle rounded-control mx-3 mb-2 border" style="background: {backdrop}">
        <SlideSurfaceText text={scene} editing onedit={edited} oncaret={(from, to) => (range = { from, to })} />
      </div>
      <TextStyle blockId={block.id} from={range.from} to={range.to} />
    {:else}
      <PanelEmpty title="No notes on this slide yet." action="Start notes" onaction={start} />
    {/if}
  {:else}
    <PanelEmpty title="Open a deck to write speaker notes" />
  {/if}
</Panel>

<style>
  .notes {
    min-height: 8rem;
    max-height: 40vh;
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 2.5);
  }
</style>

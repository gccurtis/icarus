<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelCrumbs,
    PanelEmpty,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import {
    markHoleOps,
    markedHoleAt,
    nextHoleName,
    selectedWords
  } from "$app-views/categories/slide-deck-editor/procedures/templating";
  import TextSpacing from "$app-views/categories/slide-deck-editor/components/text-spacing.svelte";
  import TextStyle from "$app-views/categories/slide-deck-editor/components/text-style.svelte";
  import { blockIn, slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { rangeOf, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const deckId = view.active.resourceId;
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const range = $derived(rangeOf(view.selection));
  const block = $derived(body === undefined || range === undefined ? undefined : blockIn(body, range.blockId));
  const position = $derived(body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined) + 1);

  /**
   * A run of a slide's text marked as a hole. Nothing about the deck changes —
   * the words stay, and only a template made from it holds a hole here.
   */
  const offered = $derived(body === undefined ? "Hole 1" : nextHoleName(body));
  const words = $derived(body === undefined ? "" : selectedWords(body, range));
  const here = $derived(body === undefined ? undefined : markedHoleAt(body, range));

  const templateify = () => {
    if (runtime === undefined || body === undefined) return;
    const ops = markHoleOps(body, range, offered);
    if (ops.length > 0) runtime.apply(ops);
  };
</script>

<Panel title="Text selection">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Text" }, { label: "Selection" }]}
      onnavigate={() => { const slideId = body?.slides[position - 1]?.id; if (slideId) view.inspect("slide-deck-editor.slide", slideSignal(slideId).selection); }}
    />
  {/snippet}

  {#if block && range}
    <TextStyle blockId={block.id} from={range.from} to={range.to} />
    <TextSpacing blockId={block.id} />

    {#if words !== ""}
      <PanelSection title="Template" chevron="end">
        <div class="template">
          {#if here === undefined}
            <PanelNote tone="muted">
              Mark this as a hole and a template built from this deck will ask what fills it, starting
              from what it says now. The deck itself does not change.
            </PanelNote>
            <PanelButton
              label="Templateify"
              tone="primary"
              title={`Mark the selection as a hole called ${offered}`}
              onclick={templateify}
            />
          {:else}
            <PanelNote tone="muted">
              These words are the hole <b>{here}</b>. They stay exactly as they are here; the template
              made from this deck asks what goes in their place.
            </PanelNote>
          {/if}
        </div>
      </PanelSection>
    {/if}
  {:else}
    <PanelEmpty title="Select some text on the slide" />
  {/if}
</Panel>

<style>
  .template {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }
</style>

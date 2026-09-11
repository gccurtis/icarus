<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelCrumbs,
    PanelEmpty,
    PanelQuote,
    PanelSection
  } from "$authored-components/panel";
  import {
    markSlotOps,
    markedSlotAt,
    liveSlotsOf,
    nextSlotName,
    resourceTemplate,
    stageIn,
    selectedWords
  } from "$app-views/categories/presentation-editor/procedures/templating";
  import TextSpacing from "$app-views/categories/presentation-editor/components/text-spacing.svelte";
  import TextStyle from "$app-views/categories/presentation-editor/components/text-style.svelte";
  import { blockIn } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { rangeOf, slideSignal, textSignal } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);
  const templateQuery = $derived(
    presentationId === undefined ? undefined : resourceTemplate(presentationId)
  );
  const templateStage = $derived(
    stageIn(templateQuery?.ready ? templateQuery.current : undefined)
  );

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
  });

  const body = $derived(runtime?.body);
  const range = $derived(rangeOf(view.selection));
  const block = $derived(body === undefined || range === undefined ? undefined : blockIn(body, range.blockId));
  const position = $derived(body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined) + 1);

  /**
   * A run of a slide's text marked as a slot. Nothing about the presentation changes —
   * the words stay, and only a template made from it holds a slot here.
   */
  const offered = $derived(body === undefined ? "Slot 1" : nextSlotName(body));
  const words = $derived(body === undefined ? "" : selectedWords(body, range));
  const here = $derived(body === undefined ? undefined : markedSlotAt(body, range));
  const excerpt = $derived(
    body === undefined || here === undefined
      ? words
      : (liveSlotsOf(body, []).find((slot) => slot.name === here)?.text ?? words)
  );

  const templateify = () => {
    if (runtime === undefined || body === undefined) return;
    const ops = markSlotOps(body, range, offered);
    if (ops.length === 0 || range === undefined) return;
    const signal = textSignal(range.blockId, range.from, range.to);
    runtime.apply(ops);
    view.inspect(signal.key, signal.selection);
  };
</script>

<Panel title="Text selection">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: `Slide ${position}`, key: "presentation-editor.slide" }, { label: "Text" }, { label: "Selection" }]}
      onnavigate={() => { const slideId = body?.slides[position - 1]?.id; if (slideId) view.inspect("presentation-editor.slide", slideSignal(slideId).selection); }}
    />
  {/snippet}

  {#if block && range}
    <TextStyle blockId={block.id} from={range.from} to={range.to} />
    <TextSpacing blockId={block.id} />

    {#if templateStage !== undefined && words !== ""}
      <PanelSection title="Template" open={here !== undefined} chevron="end">
        <div class="template">
          {#if here === undefined}
            <PanelButton
              label="Make slot"
              tone="primary"
              title={`Mark the selection as a slot called ${offered}`}
              onclick={templateify}
            />
          {:else}
            <span class="slot-name">{here}</span>
            <PanelQuote>{excerpt}</PanelQuote>
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

  .slot-name {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: 650;
    letter-spacing: 0.06em;
    line-height: var(--token-text-caption-leading);
    text-transform: uppercase;
  }
</style>

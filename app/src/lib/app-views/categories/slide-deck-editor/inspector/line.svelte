<script lang="ts">
  import { Panel, PanelCrumbs, PanelEmpty, PanelField, PanelFields, PanelSection, PanelSelect } from "$authored-components/panel";
  import CommentAction from "$app-views/categories/slide-deck-editor/components/comment-action.svelte";
  import ElementEffects from "$app-views/categories/slide-deck-editor/components/element-effects.svelte";
  import ElementOrder from "$app-views/categories/slide-deck-editor/components/element-order.svelte";
  import ElementPaint from "$app-views/categories/slide-deck-editor/components/element-paint.svelte";
  import { elementIn, slideHolding, slideIndexOf, withSet } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { selectedIds, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { slideUnits } from "$app-views/categories/slide-deck-editor/procedures/stage";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const ENDS = [
    { value: "none", label: "None" },
    { value: "arrow", label: "Arrow" },
    { value: "dot", label: "Dot" }
  ];

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
  const line = $derived(element?.content.type === "line" ? element.content : undefined);
  const units = $derived(body === undefined || runtime === undefined ? { width: 1280, height: 720 } : slideUnits(body.aspectRatio, runtime.stage));

  const length = $derived(line === undefined ? 0 : Math.hypot((line.to.x - line.from.x) * units.width, (line.to.y - line.from.y) * units.height));
  const angle = $derived(line === undefined ? 0 : (Math.atan2((line.to.y - line.from.y) * units.height, (line.to.x - line.from.x) * units.width) * 180) / Math.PI);

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, path, value).ops);
  };

  const point = (held: { x: number; y: number }) => `${held.x.toFixed(3)} · ${held.y.toFixed(3)}`;
</script>

<Panel title="Line">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Deck" }, { label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Line" }]}
      onnavigate={() => { if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}
  {#snippet actions()}
    {#if element}
      <CommentAction elementId={element.id} />
    {/if}
  {/snippet}

  {#if element && line}
    <PanelSection title="Geometry">
      <PanelFields>
        <PanelField label="From" mono>{point(line.from)}</PanelField>
        <PanelField label="To" mono>{point(line.to)}</PanelField>
        <PanelField label="Length" mono>{Math.round(length)} units</PanelField>
        <PanelField label="Angle" mono>{Math.round(angle)}°</PanelField>
      </PanelFields>
    </PanelSection>
    <PanelSection title="Ends">
      <div class="grid grid-cols-2 gap-2">
        <PanelSelect label="Start" value={line.ends?.start ?? "none"} options={ENDS} onchange={(value) => set(`${element.id}/content/ends/start`, value)} />
        <PanelSelect label="End" value={line.ends?.end ?? "none"} options={ENDS} onchange={(value) => set(`${element.id}/content/ends/end`, value)} />
      </div>
    </PanelSection>
    <ElementPaint elementId={element.id} />
    <ElementOrder elementId={element.id} />
    <ElementEffects elementId={element.id} corner={false} />
  {:else}
    <PanelEmpty title="Pick a line on the slide" />
  {/if}
</Panel>

<script lang="ts">
  import { Panel, PanelCrumbs, PanelEmpty, PanelNote, PanelSection, PanelSelect } from "$authored-components/panel";
  import CommentAction from "$app-views/categories/presentation-editor/components/comment-action.svelte";
  import ElementEffects from "$app-views/categories/presentation-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/presentation-editor/components/element-geometry.svelte";
  import ElementOrder from "$app-views/categories/presentation-editor/components/element-order.svelte";
  import ElementPaint from "$app-views/categories/presentation-editor/components/element-paint.svelte";
  import TextSpacing from "$app-views/categories/presentation-editor/components/text-spacing.svelte";
  import TextStyle from "$app-views/categories/presentation-editor/components/text-style.svelte";
  import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";
  import { elementIn } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { withSet } from "$app-views/categories/presentation-editor/procedures/presentation-values";
  import { selectedIds, slideSignal } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  const KINDS = ["rectangle", "ellipse", "triangle", "diamond", "arrow", "callout"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
  });

  const body = $derived(runtime?.body);
  const id = $derived(selectedIds(view.selection)[0]);
  const element = $derived(body === undefined || id === undefined ? undefined : elementIn(body, id));
  const slide = $derived(body === undefined || id === undefined ? undefined : slideHolding(body, id));
  const position = $derived(body === undefined || slide === undefined ? 0 : slideIndexOf(body, slide.id) + 1);
  const content = $derived(element?.content.type === "shape" ? element.content : undefined);
  const block = $derived(content?.block);
  const shapeTitle = $derived(content === undefined ? "Shape" : content.shape[0].toUpperCase() + content.shape.slice(1));
  const fullText = $derived(content?.block?.display.trim().replace(/\s+/g, " ") ?? "");
  const excerpt = $derived(fullText.length <= 64 ? fullText : `${fullText.slice(0, 63).trimEnd()}…`);

  const set = (path: string, value: unknown) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, "element", path, value).ops);
  };
</script>

<Panel title={shapeTitle}>
  {#snippet heading()}
    <div class="min-w-0">
      <h2 class="text-body-sm text-ink-secondary m-0 font-semibold">{shapeTitle}</h2>
      {#if excerpt.length > 0}
        <p class="text-caption text-ink-muted m-0 truncate pt-0.5" title={fullText}>“{excerpt}”</p>
      {/if}
    </div>
  {/snippet}
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Presentation" }, { label: `Slide ${position}`, key: "presentation-editor.slide" }, { label: shapeTitle }]}
      onnavigate={() => { if (slide) view.inspect("presentation-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}
  {#snippet actions()}
    {#if element}
      <CommentAction elementId={element.id} />
    {/if}
  {/snippet}

  {#if element && content}
    <PanelSection title="Kind">
      <PanelSelect label="Kind" value={content.shape} options={KINDS} onchange={(value) => set(`${element.id}/content/shape`, value)} />
    </PanelSection>
    {#if block}
      <TextStyle blockId={block.id} whole wrapping />
    {/if}
    <ElementGeometry elementId={element.id} />
    <ElementPaint elementId={element.id} />
    <ElementOrder elementId={element.id} />
    {#if block}
      <TextSpacing blockId={block.id} />
    {/if}
    <ElementEffects elementId={element.id} />
    {#if element.fromPlaceholder}
      <PanelSection title="Origin" open={false} chevron="end">
        <PanelNote>From the layout's “{element.fromPlaceholder}” placeholder.</PanelNote>
      </PanelSection>
    {/if}
  {:else}
    <PanelEmpty title="Pick a shape on the slide" />
  {/if}
</Panel>

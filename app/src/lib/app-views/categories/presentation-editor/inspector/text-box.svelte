<script lang="ts">
  import { Panel, PanelCrumbs, PanelEmpty, PanelSection, PanelSelect } from "$authored-components/panel";
  import CommentAction from "$app-views/categories/presentation-editor/components/comment-action.svelte";
  import PromptAction from "$app-views/categories/presentation-editor/components/prompt-action.svelte";
  import ElementEffects from "$app-views/categories/presentation-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/presentation-editor/components/element-geometry.svelte";
  import ElementOrder from "$app-views/categories/presentation-editor/components/element-order.svelte";
  import ElementPaint from "$app-views/categories/presentation-editor/components/element-paint.svelte";
  import TextSpacing from "$app-views/categories/presentation-editor/components/text-spacing.svelte";
  import TextStyle from "$app-views/categories/presentation-editor/components/text-style.svelte";
  import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";
  import { elementIn } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { selectedIds, slideSignal } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  const KIND = [{ value: "text", label: "Text box" }];

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
  const block = $derived(element?.content.type === "text" ? element.content.block : undefined);

</script>

<Panel title="Text box">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Presentation" }, { label: `Slide ${position}`, key: "presentation-editor.slide" }, { label: "Text box" }]}
      onnavigate={() => { if (slide) view.inspect("presentation-editor.slide", slideSignal(slide.id).selection); }}
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

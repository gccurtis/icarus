<script lang="ts">
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";

  import { Panel, PanelCrumbs, PanelEmpty, PanelSection } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import CommentAction from "$app-views/categories/slide-deck-editor/components/comment-action.svelte";
  import ElementEffects from "$app-views/categories/slide-deck-editor/components/element-effects.svelte";
  import ElementGeometry from "$app-views/categories/slide-deck-editor/components/element-geometry.svelte";
  import ElementOrder from "$app-views/categories/slide-deck-editor/components/element-order.svelte";
  import ElementPaint from "$app-views/categories/slide-deck-editor/components/element-paint.svelte";
  import { elementIn, slideHolding, slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { selectedIds, slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { columnsOf, gridOf, withColumnInserted, withColumnRemoved, withRowInserted, withRowRemoved } from "$app-views/categories/slide-deck-editor/procedures/tables";
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
  const table = $derived(element?.content.type === "table" ? element.content.block : undefined);
  const columns = $derived(table === undefined ? 0 : columnsOf(gridOf(table)));

  const change = (edit: { ops: readonly Parameters<SlideDeckRuntime["apply"]>[0][number][] }) => {
    if (edit.ops.length > 0) runtime?.apply(edit.ops);
  };
</script>

<Panel title="Table">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Deck" }, { label: `Slide ${position}`, key: "slide-deck-editor.slide" }, { label: "Table" }]}
      onnavigate={() => { if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection); }}
    />
  {/snippet}
  {#snippet actions()}
    {#if element}
      <CommentAction elementId={element.id} />
    {/if}
  {/snippet}

  {#if body && element && table}
    <PanelSection title="Rows and columns">
      <div class="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-1.5">
        <span class="text-caption text-ink-muted">Row</span>
        <Button variant="outline" size="xs" class="w-full" title="Add a row at the bottom" onclick={() => change(withRowInserted(body, element, table.rows.length - 1))}><Plus aria-hidden="true" />Insert</Button>
        <Button variant="outline" size="xs" class="w-full" disabled={table.rows.length < 2} title="Remove the bottom row" onclick={() => change(withRowRemoved(body, element, table.rows.length - 1))}><Minus aria-hidden="true" />Delete</Button>
        <span class="text-caption text-ink-muted">Column</span>
        <Button variant="outline" size="xs" class="w-full" title="Add a column on the right" onclick={() => change(withColumnInserted(body, element, columns - 1))}><Plus aria-hidden="true" />Insert</Button>
        <Button variant="outline" size="xs" class="w-full" disabled={columns < 2} title="Remove the rightmost column" onclick={() => change(withColumnRemoved(body, element, columns - 1))}><Minus aria-hidden="true" />Delete</Button>
      </div>
    </PanelSection>
    <ElementGeometry elementId={element.id} />
    <ElementPaint elementId={element.id} fill={false} />
    <ElementEffects elementId={element.id} corner={false} />
    <ElementOrder elementId={element.id} />
  {:else}
    <PanelEmpty title="Pick a table on the slide" />
  {/if}
</Panel>

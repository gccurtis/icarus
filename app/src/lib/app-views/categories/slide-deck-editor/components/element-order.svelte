<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import BringToFront from "@lucide/svelte/icons/bring-to-front";
  import SendToBack from "@lucide/svelte/icons/send-to-back";

  import { PanelSection } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import {
    placedById,
    slideHolding,
    withRestacked,
    type Restack
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  let { elementId }: { elementId: string } = $props();

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const position = $derived.by(() => {
    if (body === undefined) return undefined;
    const slide = slideHolding(body, elementId);
    if (slide === undefined) return undefined;
    const placed = placedById(slide, elementId);
    if (placed === undefined) return undefined;
    const siblings =
      placed.parents.length === 0
        ? slide.elements
        : (() => {
            const group = placedById(slide, placed.parents[placed.parents.length - 1])?.element;
            return group?.content.type === "group" ? group.content.children : [];
          })();
    const at = siblings.findIndex((element) => element.id === elementId);
    return { at, count: siblings.length };
  });

  const restack = (way: Restack) => {
    if (body === undefined) return;
    runtime?.apply(withRestacked(body, elementId, way).ops);
  };

  const atFront = $derived(position !== undefined && position.at === position.count - 1);
  const atBack = $derived(position !== undefined && position.at === 0);
</script>

<PanelSection title="Order" count={position === undefined ? undefined : `${position.at + 1} of ${position.count}`}>
  <div class="grid grid-cols-4 gap-1">
    <Button variant="outline" size="xs" disabled={atFront} title="Bring to front" aria-label="Bring to front" onclick={() => restack("front")}><BringToFront aria-hidden="true" /></Button>
    <Button variant="outline" size="xs" disabled={atFront} title="Bring forward" aria-label="Bring forward" onclick={() => restack("forward")}><ArrowUp aria-hidden="true" /></Button>
    <Button variant="outline" size="xs" disabled={atBack} title="Send backward" aria-label="Send backward" onclick={() => restack("behind")}><ArrowDown aria-hidden="true" /></Button>
    <Button variant="outline" size="xs" disabled={atBack} title="Send to back" aria-label="Send to back" onclick={() => restack("back")}><SendToBack aria-hidden="true" /></Button>
  </div>
</PanelSection>

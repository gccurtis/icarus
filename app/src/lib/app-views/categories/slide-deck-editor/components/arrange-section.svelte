<script lang="ts">
  import AlignCenterHorizontal from "@lucide/svelte/icons/align-center-horizontal";
  import AlignCenterVertical from "@lucide/svelte/icons/align-center-vertical";
  import AlignEndHorizontal from "@lucide/svelte/icons/align-end-horizontal";
  import AlignEndVertical from "@lucide/svelte/icons/align-end-vertical";
  import AlignHorizontalSpaceBetween from "@lucide/svelte/icons/align-horizontal-space-between";
  import AlignStartHorizontal from "@lucide/svelte/icons/align-start-horizontal";
  import AlignStartVertical from "@lucide/svelte/icons/align-start-vertical";
  import AlignVerticalSpaceBetween from "@lucide/svelte/icons/align-vertical-space-between";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import BringToFront from "@lucide/svelte/icons/bring-to-front";
  import SendToBack from "@lucide/svelte/icons/send-to-back";

  import { PanelActions, PanelButton, PanelChoice, PanelSection } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { aligned, bounds, distributed, matched, type AlignEdge, type Match } from "$app-views/categories/slide-deck-editor/procedures/arrange";
  import {
    elementIn,
    placedOn,
    slideHolding,
    withElementFrame,
    withRestackedSet,
    type Restack
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { selectedIds } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  let { groupId }: { groupId?: string } = $props();

  const RELATIVE = [
    { value: "selection", label: "Selection" },
    { value: "slide", label: "Slide" }
  ];

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  let relative = $state("selection");

  const body = $derived(runtime?.body);
  const members = $derived.by(() => {
    if (body === undefined) return [];
    if (groupId !== undefined) {
      const group = elementIn(body, groupId);
      const slide = slideHolding(body, groupId);
      if (group?.content.type !== "group" || slide === undefined) return [];
      const ids = new Set(group.content.children.map((child) => child.id));
      return placedOn(slide).filter((placed) => ids.has(placed.element.id)).map((placed) => ({ id: placed.element.id, frame: placed.frame }));
    }
    const ids = selectedIds(view.selection);
    const slide = ids[0] === undefined ? undefined : slideHolding(body, ids[0]);
    if (slide === undefined) return [];
    return placedOn(slide).filter((placed) => ids.includes(placed.element.id)).map((placed) => ({ id: placed.element.id, frame: placed.frame }));
  });

  const commit = (moves: readonly { id: string; frame: { x: number; y: number; width: number; height: number } }[]) => {
    if (body === undefined) return;
    let held = body;
    const ops = [];
    for (const move of moves) {
      const step = withElementFrame(held, move.id, move.frame);
      held = step.body;
      ops.push(...step.ops);
    }
    if (ops.length > 0) runtime?.apply(ops);
  };

  const target = $derived(relative === "slide" ? { x: 0, y: 0, width: 1, height: 1 } : bounds(members.map((member) => member.frame)));

  const align = (edge: AlignEdge) => commit(aligned(members, edge, target));
  const distribute = (axis: "x" | "y") => commit(distributed(members, axis));
  const match = (what: Match) => commit(matched(members, what));

  const restack = (way: Restack) => {
    if (body === undefined) return;
    const edit = withRestackedSet(body, members.map((member) => member.id), way);
    if (edit.ops.length > 0) runtime?.apply(edit.ops);
  };

  const few = $derived(members.length < 2);
  const two = $derived(members.length < 3);
</script>

<PanelSection title="Align">
  <PanelActions>
    <PanelButton label="Left" icon={AlignStartVertical} disabled={few && relative !== "slide"} onclick={() => align("left")} />
    <PanelButton label="Center" icon={AlignCenterVertical} disabled={few && relative !== "slide"} onclick={() => align("center")} />
    <PanelButton label="Right" icon={AlignEndVertical} disabled={few && relative !== "slide"} onclick={() => align("right")} />
  </PanelActions>
  <PanelActions>
    <PanelButton label="Top" icon={AlignStartHorizontal} disabled={few && relative !== "slide"} onclick={() => align("top")} />
    <PanelButton label="Middle" icon={AlignCenterHorizontal} disabled={few && relative !== "slide"} onclick={() => align("middle")} />
    <PanelButton label="Bottom" icon={AlignEndHorizontal} disabled={few && relative !== "slide"} onclick={() => align("bottom")} />
  </PanelActions>
  <div class="flex items-center gap-2">
    <span class="text-caption text-ink-muted shrink-0">Relative to</span>
    <PanelChoice label="Relative to" value={relative} options={RELATIVE} flush onchange={(value) => (relative = value)} />
  </div>
</PanelSection>

<PanelSection title="Distribute">
  <PanelActions>
    <PanelButton label="Horizontally" icon={AlignHorizontalSpaceBetween} disabled={two} title={two ? "Nothing sits between two objects" : undefined} onclick={() => distribute("x")} />
    <PanelButton label="Vertically" icon={AlignVerticalSpaceBetween} disabled={two} title={two ? "Nothing sits between two objects" : undefined} onclick={() => distribute("y")} />
  </PanelActions>
  <PanelActions>
    <PanelButton label="Match width" disabled={few} onclick={() => match("width")} />
    <PanelButton label="Match height" disabled={few} onclick={() => match("height")} />
    <PanelButton label="Match size" disabled={few} onclick={() => match("size")} />
  </PanelActions>
</PanelSection>

<PanelSection title="Order">
  <div class="grid grid-cols-4 gap-1">
    <Button variant="outline" size="xs" title="Bring to front" aria-label="Bring to front" onclick={() => restack("front")}><BringToFront aria-hidden="true" /></Button>
    <Button variant="outline" size="xs" title="Bring forward" aria-label="Bring forward" onclick={() => restack("forward")}><ArrowUp aria-hidden="true" /></Button>
    <Button variant="outline" size="xs" title="Send backward" aria-label="Send backward" onclick={() => restack("behind")}><ArrowDown aria-hidden="true" /></Button>
    <Button variant="outline" size="xs" title="Send to back" aria-label="Send to back" onclick={() => restack("back")}><SendToBack aria-hidden="true" /></Button>
  </div>
</PanelSection>

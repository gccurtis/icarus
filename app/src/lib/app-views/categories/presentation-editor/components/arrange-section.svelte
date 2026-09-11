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

  import { PanelButton, PanelChoice, PanelSection } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { aligned, bounds, distributed, matched, type AlignEdge, type Match } from "$app-views/categories/presentation-editor/procedures/arrange";
  import type { Restack } from "$app-views/categories/presentation-editor/procedures/arrange";
  import { withRestackedSet } from "$app-views/categories/presentation-editor/procedures/presentation-layering";
  import { placedOn } from "$app-views/categories/presentation-editor/procedures/presentation-placement";
  import { slideHolding } from "$app-views/categories/presentation-editor/procedures/presentation-slide-holding";
  import { elementIn } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { withElementFrame } from "$app-views/categories/presentation-editor/procedures/presentation-values";
  import { selectedIds } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  let { groupId }: { groupId?: string } = $props();

  const RELATIVE = [
    { value: "selection", label: "Selection", short: "Sel" },
    { value: "slide", label: "Slide", short: "Slide" }
  ];

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
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
  <div class="arrange-grid grid grid-cols-3 gap-1">
    <Button variant="outline" size="xs" class="w-full min-w-0" aria-label="Left" title="Align left" disabled={few && relative !== "slide"} onclick={() => align("left")}><AlignStartVertical aria-hidden="true" /><span class="arrange-label">Left</span></Button>
    <Button variant="outline" size="xs" class="w-full min-w-0" aria-label="Center" title="Align horizontal centers" disabled={few && relative !== "slide"} onclick={() => align("center")}><AlignCenterVertical aria-hidden="true" /><span class="arrange-label">Center</span></Button>
    <Button variant="outline" size="xs" class="w-full min-w-0" aria-label="Right" title="Align right" disabled={few && relative !== "slide"} onclick={() => align("right")}><AlignEndVertical aria-hidden="true" /><span class="arrange-label">Right</span></Button>
  </div>
  <div class="arrange-grid grid grid-cols-3 gap-1">
    <Button variant="outline" size="xs" class="w-full min-w-0" aria-label="Top" title="Align top" disabled={few && relative !== "slide"} onclick={() => align("top")}><AlignStartHorizontal aria-hidden="true" /><span class="arrange-label">Top</span></Button>
    <Button variant="outline" size="xs" class="w-full min-w-0" aria-label="Middle" title="Align vertical centers" disabled={few && relative !== "slide"} onclick={() => align("middle")}><AlignCenterHorizontal aria-hidden="true" /><span class="arrange-label">Middle</span></Button>
    <Button variant="outline" size="xs" class="w-full min-w-0" aria-label="Bottom" title="Align bottom" disabled={few && relative !== "slide"} onclick={() => align("bottom")}><AlignEndHorizontal aria-hidden="true" /><span class="arrange-label">Bottom</span></Button>
  </div>
  <PanelChoice label="Align relative to" value={relative} options={RELATIVE} flush fill onchange={(value) => (relative = value)} />
</PanelSection>

<PanelSection title="Distribute">
  <div class="arrange-grid grid grid-cols-2 gap-1">
    <Button variant="outline" size="xs" class="w-full min-w-0" aria-label="Horizontal" disabled={two} title={two ? "Select at least three objects" : "Distribute horizontally"} onclick={() => distribute("x")}><AlignHorizontalSpaceBetween aria-hidden="true" /><span class="arrange-label">Horizontal</span></Button>
    <Button variant="outline" size="xs" class="w-full min-w-0" aria-label="Vertical" disabled={two} title={two ? "Select at least three objects" : "Distribute vertically"} onclick={() => distribute("y")}><AlignVerticalSpaceBetween aria-hidden="true" /><span class="arrange-label">Vertical</span></Button>
  </div>
</PanelSection>

<PanelSection title="Match size">
  <div class="grid grid-cols-3 gap-1">
    <PanelButton label="Width" disabled={few} title={few ? "Select at least two objects" : "Match the first selected object's width"} onclick={() => match("width")} />
    <PanelButton label="Height" disabled={few} title={few ? "Select at least two objects" : "Match the first selected object's height"} onclick={() => match("height")} />
    <PanelButton label="Both" disabled={few} title={few ? "Select at least two objects" : "Match the first selected object's size"} onclick={() => match("size")} />
  </div>
</PanelSection>

<PanelSection title="Order">
  <div class="grid grid-cols-4 gap-1">
    <Button variant="outline" size="xs" title="Bring to front" aria-label="Bring to front" onclick={() => restack("front")}><BringToFront aria-hidden="true" /></Button>
    <Button variant="outline" size="xs" title="Bring forward" aria-label="Bring forward" onclick={() => restack("forward")}><ArrowUp aria-hidden="true" /></Button>
    <Button variant="outline" size="xs" title="Send backward" aria-label="Send backward" onclick={() => restack("behind")}><ArrowDown aria-hidden="true" /></Button>
    <Button variant="outline" size="xs" title="Send to back" aria-label="Send to back" onclick={() => restack("back")}><SendToBack aria-hidden="true" /></Button>
  </div>
</PanelSection>

<style>
  .arrange-grid {
    container-name: arrange;
    container-type: inline-size;
  }

  @container arrange (max-width: 16rem) {
    .arrange-label {
      display: none;
    }
  }
</style>

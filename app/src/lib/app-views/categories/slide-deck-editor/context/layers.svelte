<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import BringToFront from "@lucide/svelte/icons/bring-to-front";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Group from "@lucide/svelte/icons/group";
  import Image from "@lucide/svelte/icons/image";
  import Lock from "@lucide/svelte/icons/lock";
  import LockOpen from "@lucide/svelte/icons/lock-open";
  import Minus from "@lucide/svelte/icons/minus";
  import SendToBack from "@lucide/svelte/icons/send-to-back";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import SquareFunction from "@lucide/svelte/icons/square-function";
  import Square from "@lucide/svelte/icons/square";
  import Table from "@lucide/svelte/icons/table";
  import Type from "@lucide/svelte/icons/type";

  import { Panel, PanelEmpty, PanelRow } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import {
    elementIn,
    labelOf,
    placedOn,
    slideIndexOf,
    withReorderedElement,
    withRestackedSet,
    withSet,
    type Placed,
    type Restack
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { elementsSignal, selectedIds } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const CARRIED = "application/x-icarus-layer";

  const ICON = { text: Type, formula: SquareFunction, prompt: Sparkles, shape: Square, line: Minus, image: Image, table: Table, chart: ChartColumn, group: Group } as const;

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const slide = $derived(body?.slides[body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined)]);
  const rows = $derived(slide === undefined ? [] : [...placedOn(slide)].reverse());
  const selected = $derived(selectedIds(view.selection));
  const none = $derived(selected.length === 0);

  const pick = (id: string, additive: boolean) => {
    if (body === undefined) return;
    const ids = additive ? (selected.includes(id) ? selected.filter((held) => held !== id) : [...selected, id]) : [id];
    const elements = ids.flatMap((held) => {
      const element = elementIn(body, held);
      return element ? [element] : [];
    });
    const signal = elementsSignal(elements);
    if (signal) view.inspect(signal.key, signal.selection);
  };

  const restack = (way: Restack) => {
    if (body === undefined) return;
    const edit = withRestackedSet(body, selected, way);
    if (edit.ops.length > 0) runtime?.apply(edit.ops);
  };

  const toggleLock = (placed: Placed) => {
    if (body === undefined) return;
    runtime?.apply(withSet(body, `${placed.element.id}/locked`, placed.element.locked ? null : true).ops);
  };

  let lifted = $state<string | undefined>(undefined);
  let over = $state<{ id: string; side: "above" | "below" } | undefined>(undefined);

  const lift = (event: DragEvent, id: string) => {
    event.dataTransfer?.setData(CARRIED, id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    lifted = id;
  };

  const sideOf = (event: DragEvent): "above" | "below" => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "above" : "below";
  };

  const enter = (event: DragEvent, id: string) => {
    if (lifted === undefined || lifted === id || !event.dataTransfer?.types.includes(CARRIED)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    over = { id, side: sideOf(event) };
  };

  const drop = (event: DragEvent, target: Placed) => {
    const where = over;
    over = undefined;
    const dragged = event.dataTransfer?.getData(CARRIED);
    if (body === undefined || slide === undefined || !dragged || dragged === target.element.id || where === undefined) return;
    event.preventDefault();
    const siblings = target.parents.length === 0
      ? slide.elements
      : (() => {
          const group = placedOn(slide).find((held) => held.element.id === target.parents[target.parents.length - 1])?.element;
          return group?.content.type === "group" ? group.content.children : [];
        })();
    const draggedPlaced = placedOn(slide).find((held) => held.element.id === dragged);
    if (draggedPlaced === undefined || draggedPlaced.parents.join() !== target.parents.join()) return;
    const at = siblings.findIndex((element) => element.id === target.element.id);
    const after = where.side === "above" ? target.element.id : at === 0 ? null : siblings[at - 1].id;
    runtime?.apply(withReorderedElement(body, dragged, after === dragged ? (siblings[at - 2]?.id ?? null) : after).ops);
  };
</script>

<Panel title="Layers">
  {#if body && slide}
    <h3 class="band">Actions</h3>
    <div class="grid grid-cols-4 gap-1 px-3 pb-3">
      <Button variant="outline" size="xs" disabled={none} title={none ? "Pick something on the slide first" : "Bring to front"} aria-label="Bring to front" onclick={() => restack("front")}><BringToFront aria-hidden="true" /></Button>
      <Button variant="outline" size="xs" disabled={none} title={none ? "Pick something on the slide first" : "Bring forward"} aria-label="Bring forward" onclick={() => restack("forward")}><ArrowUp aria-hidden="true" /></Button>
      <Button variant="outline" size="xs" disabled={none} title={none ? "Pick something on the slide first" : "Send backward"} aria-label="Send backward" onclick={() => restack("behind")}><ArrowDown aria-hidden="true" /></Button>
      <Button variant="outline" size="xs" disabled={none} title={none ? "Pick something on the slide first" : "Send to back"} aria-label="Send to back" onclick={() => restack("back")}><SendToBack aria-hidden="true" /></Button>
    </div>

    <h3 class="band">
      Layers<span class="count">{rows.length === 1 ? "1 object" : `${rows.length} objects`}</span>
    </h3>
    {#if rows.length === 0}
      <PanelEmpty title="Nothing on this slide yet." />
    {/if}
    {#each rows as placed (placed.element.id)}
      {@const Icon = ICON[placed.element.content.type]}
      <div
        class="layer"
        class:is-above={over?.id === placed.element.id && over.side === "above"}
        class:is-below={over?.id === placed.element.id && over.side === "below"}
        class:is-lifted={lifted === placed.element.id}
        role="presentation"
        draggable="true"
        ondragstart={(event) => lift(event, placed.element.id)}
        ondragend={() => {
          lifted = undefined;
          over = undefined;
        }}
        ondragover={(event) => enter(event, placed.element.id)}
        ondragleave={() => (over = undefined)}
        ondrop={(event) => drop(event, placed)}
      >
        <PanelRow
          title={labelOf(placed.element)}
          icon={Icon}
          depth={Math.min(placed.depth, 3) as 0 | 1 | 2 | 3}
          selected={selected.includes(placed.element.id)}
          onselect={() => pick(placed.element.id, false)}
        >
          {#snippet control()}
            <button
              type="button"
              class="lock rounded-control"
              class:is-locked={placed.element.locked}
              title={placed.element.locked ? "Unlock" : "Lock, so it cannot be picked on the slide"}
              aria-label={placed.element.locked ? "Unlock" : "Lock"}
              aria-pressed={placed.element.locked ?? false}
              onclick={(event) => {
                event.stopPropagation();
                toggleLock(placed);
              }}
            >
              {#if placed.element.locked}<Lock size={12} aria-hidden="true" />{:else}<LockOpen size={12} aria-hidden="true" />{/if}
            </button>
          {/snippet}
        </PanelRow>
      </div>
    {/each}
  {:else}
    <PanelEmpty title="Open a deck to see what is on the slide" />
  {/if}
</Panel>

<style>
  .band {
    display: flex;
    align-items: baseline;
    gap: calc(var(--token-spacing-unit) * 1.5);
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 3);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--token-ink-secondary);
  }

  .count {
    margin-inline-start: auto;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: var(--token-ink-muted);
    font-variant-numeric: tabular-nums;
  }

  .layer {
    position: relative;
  }

  .layer.is-lifted {
    opacity: 0.4;
  }

  .layer.is-above::before,
  .layer.is-below::after {
    content: "";
    position: absolute;
    left: calc(var(--token-spacing-unit) * 3);
    right: calc(var(--token-spacing-unit) * 3);
    height: 2px;
    border-radius: 1px;
    background: var(--token-color-active-border);
    z-index: 1;
  }

  .layer.is-above::before {
    top: -1px;
  }

  .layer.is-below::after {
    bottom: -1px;
  }

  .lock {
    display: flex;
    padding: 2px;
    color: var(--token-ink-muted);
    opacity: 0;
    transition: opacity var(--token-motion-small) var(--token-ease-standard);
  }

  .layer:hover .lock,
  .lock:focus-visible,
  .lock.is-locked {
    opacity: 1;
  }

  .lock.is-locked {
    color: var(--token-ink-secondary);
  }

  .lock:hover {
    color: var(--token-ink-primary);
  }
</style>

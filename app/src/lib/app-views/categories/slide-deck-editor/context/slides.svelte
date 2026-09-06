<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Copy from "@lucide/svelte/icons/copy";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { Panel, PanelEmpty } from "$authored-components/panel";
  import { SlideSurface } from "$authored-components/slide-surface";
  import { Button } from "$vendored-components/button";
  import * as DropdownMenu from "$vendored-components/dropdown-menu";
  import {
    stepped,
    withDuplicatedSlide,
    withMovedSlide,
    withNewSlide,
    withoutSlide,
    type Edit,
    type SlideDeckBody
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { sceneOf } from "$app-views/categories/slide-deck-editor/procedures/scene";
  import { slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { ratioOf, slideUnits } from "$app-views/categories/slide-deck-editor/procedures/stage";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const CARRIED = "application/x-icarus-slide";

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);

  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const current = $derived(view.active.focus ?? body?.slides[0]?.id);
  const last = $derived((body?.slides.length ?? 0) < 2);
  const units = $derived(
    runtime === undefined || body === undefined ? { width: 1280, height: 720 } : slideUnits(body.aspectRatio, runtime.stage)
  );

  let reel = $state<HTMLDivElement>();
  let reelWidth = $state(0);
  $effect(() => {
    const element = reel;
    if (element === undefined) return;
    const measure = () => {
      const style = getComputedStyle(element);
      reelWidth = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    };
    const watcher = new ResizeObserver(measure);
    watcher.observe(element);
    measure();
    return () => watcher.disconnect();
  });
  const thumbWidth = $derived(Math.max(0, reelWidth - 2));
  const thumbHeight = $derived(body === undefined ? 0 : thumbWidth / ratioOf(body.aspectRatio));

  const show = (slideId: string) => {
    if (deckId === undefined) return;
    view.open({ category: "slide-deck-editor", resourceId: deckId, focus: slideId });
    view.inspect("slide-deck-editor.slide", slideSignal(slideId).selection);
  };

  const commit = (edit: Edit, look?: string) => {
    if (edit.ops.length === 0) return;
    runtime?.apply(edit.ops);
    if (look !== undefined) show(look);
  };

  const minted = (before: SlideDeckBody, edit: Edit): string | undefined =>
    edit.body.slides.find((slide) => !before.slides.some((held) => held.id === slide.id))?.id;

  const add = (layoutKey?: string) => {
    if (body === undefined) return;
    const edit = withNewSlide(body, current, layoutKey);
    commit(edit, minted(body, edit));
  };

  const duplicate = () => {
    if (body === undefined || current === undefined) return;
    const edit = withDuplicatedSlide(body, current);
    commit(edit, minted(body, edit));
  };

  const remove = () => {
    if (body === undefined || current === undefined || last) return;
    const at = body.slides.findIndex((slide) => slide.id === current);
    const next = body.slides[at + 1] ?? body.slides[at - 1];
    commit(withoutSlide(body, current), next?.id);
  };

  let lifted = $state<string | undefined>(undefined);
  let over = $state<{ index: number; side: "above" | "below" } | undefined>(undefined);

  const lift = (event: DragEvent, slideId: string) => {
    event.dataTransfer?.setData(CARRIED, slideId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    lifted = slideId;
  };

  const enterSlot = (event: DragEvent, index: number) => {
    if (lifted === undefined || !event.dataTransfer?.types.includes(CARRIED)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    over = { index, side: event.clientY < rect.top + rect.height / 2 ? "above" : "below" };
  };

  const dropSlot = (event: DragEvent) => {
    const where = over;
    over = undefined;
    const dragged = event.dataTransfer?.getData(CARRIED);
    if (body === undefined || !dragged || where === undefined) return;
    event.preventDefault();
    const gap = where.side === "above" ? where.index : where.index + 1;
    const after = gap === 0 ? null : body.slides[gap - 1].id;
    if (after === dragged) return;
    commit(withMovedSlide(body, dragged, after));
  };

  const nudge = (event: KeyboardEvent) => {
    if (!event.altKey || current === undefined || body === undefined) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    commit(stepped(body, current, event.key === "ArrowUp" ? "up" : "down"));
  };

  $effect(() => {
    const element = reel;
    if (element === undefined) return;
    element.addEventListener("keydown", nudge);
    return () => element.removeEventListener("keydown", nudge);
  });
</script>

<Panel title="Slides">
  {#snippet actions()}
    {#if body}
      <div class="verbs border-border-subtle flex w-full items-stretch gap-1 border-b pb-2">
        <div class="flex flex-1">
          <Button size="xs" class="flex-1 rounded-e-none" title="New slide after this one" onclick={() => add()}>
            <Plus aria-hidden="true" />New
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button {...props} size="icon-xs" class="-ms-px rounded-s-none" aria-label="New slide from a layout" title="New slide from a layout">
                  <ChevronDown aria-hidden="true" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start">
              {#if body.layouts.length === 0}
                <DropdownMenu.Item disabled>No layouts saved yet</DropdownMenu.Item>
              {/if}
              {#each body.layouts as layout (layout.key)}
                <DropdownMenu.Item onSelect={() => add(layout.key)}>{layout.name}</DropdownMenu.Item>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
        <Button variant="outline" size="xs" class="flex-1" title="Duplicate slide" aria-label="Duplicate slide" onclick={duplicate}>
          <Copy aria-hidden="true" /><span class="word">Duplicate</span>
        </Button>
        <Button variant="destructive" size="xs" class="flex-1" disabled={last} title={last ? "A deck keeps at least one slide" : "Delete slide"} aria-label="Delete slide" onclick={remove}>
          <Trash2 aria-hidden="true" /><span class="word">Delete</span>
        </Button>
      </div>
    {/if}
  {/snippet}

  {#if body}
    <div bind:this={reel} class="reel" role="list">
      {#each body.slides as slide, position (slide.id)}
        {@const chosen = slide.id === current}
        <div
          class="slot-wrap"
          class:is-above={over?.index === position && over.side === "above"}
          class:is-below={over?.index === position && over.side === "below"}
          role="listitem"
        >
          <button
            type="button"
            draggable="true"
            class="slot"
            class:is-chosen={chosen}
            class:is-lifted={lifted === slide.id}
            aria-current={chosen ? "true" : undefined}
            aria-label="Slide {position + 1}{slide.hidden ? ' — hidden' : ''}"
            onclick={() => show(slide.id)}
            ondragstart={(event) => lift(event, slide.id)}
            ondragend={() => {
              lifted = undefined;
              over = undefined;
            }}
            ondragover={(event) => enterSlot(event, position)}
            ondragleave={() => (over = undefined)}
            ondrop={dropSlot}
          >
            <span class="text-caption index tabular-nums" class:text-active-text={chosen} class:text-ink-muted={!chosen}>
              {position + 1}{#if slide.hidden}<span class="ms-1.5 font-normal">hidden</span>{/if}
            </span>
            <span class="thumb" style="height: {thumbHeight + 2}px">
              {#if thumbWidth > 0}
                <span class="surface"><SlideSurface scene={sceneOf(body, slide, units)} width={thumbWidth} height={thumbHeight} interactive={false} /></span>
              {/if}
              {#if slide.hidden}<span class="veil"></span>{/if}
            </span>
          </button>
        </div>
      {/each}
    </div>
  {:else}
    <PanelEmpty title="Open a deck to see its slides" />
  {/if}
</Panel>

<style>
  .verbs {
    container-type: inline-size;
  }

  .word {
    display: none;
  }

  @container (min-width: 15rem) {
    .word {
      display: inline;
    }
  }

  .reel {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) 0;
  }

  .slot-wrap {
    position: relative;
  }

  .slot-wrap.is-above::before,
  .slot-wrap.is-below::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 2px;
    background: var(--token-color-active-border);
    z-index: 1;
  }

  .slot-wrap.is-above::before {
    top: calc(var(--token-spacing-unit) * -1.5 - 1px);
  }

  .slot-wrap.is-below::after {
    bottom: calc(var(--token-spacing-unit) * -1.5 - 1px);
  }

  .slot {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: 0;
    border: 0;
    background: transparent;
    text-align: start;
    cursor: grab;
  }

  .slot.is-lifted {
    opacity: 0.4;
  }

  .index {
    font-weight: 600;
    line-height: 1.2;
  }

  .thumb {
    position: relative;
    display: block;
    width: 100%;
    overflow: hidden;
    border-radius: 2px;
    outline: 2px solid transparent;
    outline-offset: 2px;
    transition: outline-color var(--token-motion-small) var(--token-ease-standard);
  }

  .slot:hover .thumb {
    outline-color: var(--token-color-interactive-border);
  }

  .slot.is-chosen .thumb {
    outline-color: var(--token-color-active-border);
  }

  .surface {
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }

  .veil {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--token-surface-canvas) 70%, transparent);
  }
</style>

<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { Panel, PanelEmpty } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import {
    elementBox,
    slideLengths,
    stepped,
    styleOf,
    textOf,
    withDuplicatedSlide,
    withMovedSlide,
    withNewSlide,
    withoutSlide,
    type Edit,
    type SlideDeckBody
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { cssRatio, slideUnits } from "$app-views/categories/slide-deck-editor/procedures/stage";
  import { palette } from "$app-views/categories/slide-deck-editor/procedures/tokens";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const CARRIED = "application/x-icarus-item";

  const view = workspaceState();

  const deckId = $derived(view.active.resourceId);

  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const ratio = $derived(cssRatio(body?.aspectRatio ?? "16:9"));
  const current = $derived(view.active.focus ?? body?.slides[0]?.id);
  const last = $derived((body?.slides.length ?? 0) < 2);

  const paint = $derived.by(() => {
    void body;
    return palette();
  });

  const units = $derived(
    runtime === undefined || body === undefined
      ? undefined
      : slideUnits(body.aspectRatio, runtime.stage)
  );

  let lifted = $state<string | undefined>(undefined);
  let over = $state<string | undefined>(undefined);

  const show = (slideId: string) => {
    if (deckId === undefined) return;
    view.open({ category: "slide-deck-editor", resourceId: deckId, focus: slideId });
  };

  /** One way in for every gesture: send the ops, then look at what they made. */
  const commit = (edit: Edit, look?: string) => {
    if (edit.ops.length === 0) return;

    runtime?.apply(edit.ops);
    if (look !== undefined) show(look);
  };

  /** The one slide the edit put there that the body did not already hold. */
  const minted = (before: SlideDeckBody, edit: Edit): string | undefined =>
    edit.body.slides.find((slide) => !before.slides.some((held) => held.id === slide.id))?.id;

  const add = () => {
    if (body === undefined) return;

    const edit = withNewSlide(body, current);
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

  const step = (slideId: string, way: "up" | "down") => {
    if (body === undefined) return;
    commit(stepped(body, slideId, way));
  };

  /**
   * The picture is the thing, so the picture is what you pick up — no grip
   * beside it and no menu after it, both of which cost the width that makes a
   * slide legible at this size.
   */
  const lift = (event: DragEvent, slideId: string) => {
    event.dataTransfer?.setData(CARRIED, slideId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    lifted = slideId;
  };

  /**
   * `dragover` has to be cancelled for a drop to be allowed at all. What is
   * being carried cannot be read until the drop, so the slide being dragged is
   * excluded by `lifted` rather than by comparing ids.
   */
  const enter = (event: DragEvent, slideId: string) => {
    if (lifted === undefined || lifted === slideId) return;
    if (!event.dataTransfer?.types.includes(CARRIED)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    over = slideId;
  };

  const drop = (event: DragEvent, slideId: string) => {
    over = undefined;

    const dragged = event.dataTransfer?.getData(CARRIED);
    if (body === undefined || !dragged || dragged === slideId) return;

    event.preventDefault();
    commit(withMovedSlide(body, dragged, slideId));
  };

  /**
   * Alt and an arrow steps the chosen slide, which is the slide every button up
   * here already acts on — so the keyboard needs no notion of where focus is,
   * and it is the whole keyboard path now that the move menu is gone.
   */
  const nudge = (event: KeyboardEvent) => {
    if (!event.altKey || current === undefined) return;
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    event.preventDefault();
    step(current, event.key === "ArrowUp" ? "up" : "down");
  };

  let panel = $state<HTMLDivElement>();

  /**
   * Bound rather than declared on the element: a keyboard handler written onto
   * a non-interactive tag is the shape a11y tooling rightly objects to.
   *
   * It sits over the buttons as well as the reel because the chord acts on the
   * chosen slide rather than on whatever holds focus — and pressing Duplicate
   * leaves focus on Duplicate, which is exactly when someone reaches for it.
   */
  $effect(() => {
    const element = panel;
    if (element === undefined) return;

    element.addEventListener("keydown", nudge);
    return () => element.removeEventListener("keydown", nudge);
  });
</script>

<Panel title="Slides">
  {#if body}
    <div bind:this={panel}>
      <div class="actions">
        <Button
          variant="default"
          size="xs"
          class="w-full"
          title="New slide"
          aria-label="New slide"
          onclick={add}
        >
          <Plus aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          size="xs"
          class="w-full"
          title="Duplicate slide"
          aria-label="Duplicate slide"
          onclick={duplicate}
        >
          <Copy aria-hidden="true" />
        </Button>
        <Button
          variant="destructive"
          size="xs"
          class="w-full"
          disabled={last}
          title={last ? "A deck keeps at least one slide" : "Delete slide"}
          aria-label="Delete slide"
          onclick={remove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <hr class="rule" />

      <ol class="reel">
        {#each body.slides as slide, position (slide.id)}
          {@const chosen = slide.id === current}
          <li class="slot" class:is-over={over === slide.id} class:is-lifted={lifted === slide.id}>
            <span class="index text-caption tabular-nums" class:is-chosen={chosen}>
              {position + 1}
            </span>

            <button
              type="button"
              draggable="true"
              class="preview rounded-control"
              class:is-chosen={chosen}
              style="aspect-ratio: {ratio}"
              aria-current={chosen ? "true" : undefined}
              aria-label="Slide {position + 1}{slide.hidden ? ' — hidden' : ''}"
              onclick={() => show(slide.id)}
              ondragstart={(event) => lift(event, slide.id)}
              ondragend={() => {
                lifted = undefined;
                over = undefined;
              }}
              ondragover={(event) => enter(event, slide.id)}
              ondragleave={() => (over = undefined)}
              ondrop={(event) => drop(event, slide.id)}
            >
              {#if units}
                {#each slide.elements as element (element.id)}
                  {@const block = textOf(element)}
                  {@const style = block === undefined ? undefined : styleOf(body, block)}
                  <span
                    class="object"
                    style="{elementBox(element)}; background: {element.format?.background ===
                    undefined
                      ? 'transparent'
                      : paint(element.format.background, '--token-surface-panel')}; border: {element
                      .format?.border === undefined
                      ? '0'
                      : `${slideLengths(element.format.border.width, units)} ${
                          element.format.border.style
                        } ${paint(element.format.border.color, '--token-border-subtle')}`}"
                  >
                    {#if block}
                      <span
                        class="prose"
                        style="font-size: {slideLengths(
                          style?.fontSize ?? 20,
                          units
                        )}; color: {paint(
                          style?.color ?? body.theme.colors.text,
                          '--token-ink-primary'
                        )}; font-weight: {style?.bold ? 600 : 400}; font-style: {style?.italic
                          ? 'italic'
                          : 'normal'}; font-family: {style?.fontFamily ??
                          body.theme.fontFamily ??
                          'inherit'}"
                      >
                        {block.display}
                      </span>
                    {/if}
                  </span>
                {/each}
              {/if}

              {#if slide.hidden}
                <span class="veil" title="Hidden">
                  <EyeOff size={14} aria-hidden="true" />
                </span>
              {/if}
            </button>
          </li>
        {/each}
      </ol>
    </div>
  {:else}
    <PanelEmpty title="Open a deck to see its slides" />
  {/if}
</Panel>

<style>
  .actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) 0;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .rule {
    margin: calc(var(--token-spacing-unit) * 4) calc(var(--token-spacing-unit) * 3);
    border: 0;
    border-top: 1px solid var(--token-border-subtle);
  }

  .reel {
    display: flex;
    margin: 0;
    padding: 0 calc(var(--token-spacing-unit) * 3);
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    list-style: none;
  }

  /* The number sits over the picture rather than beside it: a gutter would cost
     the picture width, and width is what makes a slide legible at this size. */
  .slot {
    display: flex;
    border-top: 2px solid transparent;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .slot.is-over {
    border-top-color: var(--token-color-active-border);
  }

  .slot.is-lifted {
    opacity: 0.4;
  }

  .index {
    color: var(--token-ink-muted);
    font-weight: 500;
    transition: color var(--token-motion-small) var(--token-ease-standard);
  }

  .index.is-chosen {
    color: var(--token-color-active-text);
  }

  .preview {
    position: relative;
    display: block;
    width: 100%;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    background: var(--token-surface-elevated);
    container-type: inline-size;
    cursor: grab;
    transition:
      border-color var(--token-motion-small) var(--token-ease-standard),
      box-shadow var(--token-motion-small) var(--token-ease-standard);
  }

  .preview:hover {
    border-color: var(--token-color-interactive-border);
  }

  .preview.is-chosen {
    border-color: var(--token-color-active-border);
    box-shadow: 0 0 0 2px var(--token-color-active-surface);
  }

  .object {
    position: absolute;
    display: flex;
    box-sizing: border-box;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    border-radius: 2px;
  }

  .prose {
    display: block;
    overflow: hidden;
    line-height: 1.3;
    text-align: left;
  }

  .veil {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--token-surface-canvas);
    color: var(--token-ink-muted);
    inset: 0;
    opacity: 0.8;
  }

  @media (prefers-reduced-motion: reduce) {
    .index,
    .preview {
      transition: none;
    }
  }
</style>

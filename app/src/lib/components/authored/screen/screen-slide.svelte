<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /** Where an object sits, as fractions of the stage. Never pixels. */
  type SlideFrame = {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };

  /** One thing on the stage. */
  type SlideObject = {
    readonly id: string;
    readonly frame: SlideFrame;
    /** Degrees clockwise. */
    readonly rotation?: number;
    /** What it is. The object's accessible name, and what is drawn without `object`. */
    readonly label: string;
    /**
     * Solid is content a layout owns and a slide cannot touch; dashed is a
     * placeholder a slide fills in with its own copy. Two behaviours, told apart
     * by a shape rather than by a fill, because a reader has to know which of
     * them they are about to try to edit before they try.
     */
    readonly outline?: "none" | "solid" | "dashed";
  };

  /**
   * One stage, at the deck's aspect ratio, with its objects placed on it.
   *
   * **Not `ScreenPage`.** A page is a flow of content running down a sheet
   * between four margins, and what lands where is computed. A slide is a fixed
   * stage with nothing flowing on it at all: every object is somewhere because
   * somebody put it there, and moving one moves nothing else. The two look
   * alike floating on a canvas and share not one rule about position.
   *
   * **Frames are fractions of the stage, never pixels.** A deck changes aspect
   * ratio — 16:9 to 4:3 is a supported setting, not an accident — and a stage
   * that took pixel geometry would scatter every object on it the first time
   * anyone used that setting. The conversion to percentages happens here, once,
   * so nothing above this line ever holds a pixel.
   *
   * **Speaker notes are not on it.** They belong to the inspector and the Notes
   * panel, because a tray under a 16:9 stage takes exactly the height that
   * zooming needs, and zoom is what makes a slide editable at all.
   *
   * **Selection is a ring, not a fill.** An object is usually the thing being
   * looked at, so filling it would hide what it says at the moment it matters
   * most. The ring is a shape appearing where there was none, which is what
   * stops the state being carried by colour alone.
   */
  let {
    ratio = "16:9",
    objects = [],
    selected,
    onselect,
    object,
    caption
  }: {
    /** Per deck. 4:3 decks exist and this is the whole reason it is a prop. */
    ratio?: "16:9" | "4:3";
    objects?: readonly SlideObject[];
    /** The id of the object the editor is on. */
    selected?: string;
    onselect?: (id: string) => void;
    /** What one object draws. Absent leaves the label, which is an honest stage. */
    object?: Snippet<[SlideObject]>;
    /** Under the stage: "Slide 3 of 12 · Section head". Never on the slide. */
    caption?: string;
  } = $props();

  const trace = traceNode("ScreenSlide", () => ({ ratio, objects, selected, caption }));

  /** Percentages of the stage, so nothing on it depends on how big it is drawn. */
  const box = (item: SlideObject) =>
    `left: ${item.frame.x * 100}%; top: ${item.frame.y * 100}%; ` +
    `width: ${item.frame.w * 100}%; height: ${item.frame.h * 100}%; ` +
    `rotate: ${item.rotation ?? 0}deg`;

  const shell = (item: SlideObject) =>
    cn(
      "object",
      item.outline === "solid" && "border-border-strong is-solid",
      item.outline === "dashed" && "border-border-strong is-dashed",
      selected === item.id && "ring-active-border ring-2",
      onselect && "cursor-pointer"
    );
</script>

{#snippet contents(item: SlideObject)}
  {#if object}
    {@render object(item)}
  {:else}
    <span class="text-caption text-ink-muted truncate">{item.label}</span>
  {/if}
{/snippet}

<div {...trace} class="stand">
  <div
    class="stage bg-surface-panel border-border-subtle border"
    style="aspect-ratio: {ratio.replace(':', ' / ')}"
  >
    <!--
      Branched rather than a computed tag: an object on a stage nobody is editing
      must not be in the tab order, and Svelte can only check the accessibility
      of a tag it can see.
    -->
    {#each objects as item (item.id)}
      {#if onselect}
        <button
          type="button"
          onclick={() => onselect?.(item.id)}
          aria-label={item.label}
          aria-current={selected === item.id ? "true" : undefined}
          class={shell(item)}
          style={box(item)}
        >
          {@render contents(item)}
        </button>
      {:else}
        <div class={shell(item)} style={box(item)}>
          {@render contents(item)}
        </div>
      {/if}
    {/each}
  </div>

  {#if caption}
    <span class="text-caption text-ink-muted tabular-nums">{caption}</span>
  {/if}
</div>

<style>
  .stand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  /*
   * One fixed measure, whatever the ratio — 200 units wide, and the height
   * follows. A stage that took the width of the region it happened to be in
   * would be a different size on every screen, and the zoom is what is supposed
   * to change how big a slide is.
   */
  .stage {
    position: relative;
    width: calc(var(--token-spacing-unit) * 200);
    max-width: 100%;
    overflow: hidden;
    box-shadow: var(--token-shadow-raised);
  }

  .object {
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 2);
    overflow: hidden;
    text-align: start;
  }

  /* Solid: a layout owns it and a slide cannot touch it. */
  .object.is-solid {
    border-width: 1px;
    border-style: solid;
  }

  /* Dashed: a frame a slide fills in with its own copy. */
  .object.is-dashed {
    border-width: 1px;
    border-style: dashed;
  }
</style>

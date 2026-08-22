<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * One sheet of paper on a canvas, with its margins drawn and its furniture on
   * it.
   *
   * **Not `ScreenThumb`.** That is an abstract placeholder — bars at an aspect
   * ratio, standing in for a shape nothing has rendered yet, and deliberately
   * not a drawing of a document. This is the document: a real page at a real
   * size, holding real content, and every dimension on it is one a reader is
   * entitled to measure against the paper it will print on.
   *
   * **The paper has a name, not a width.** 816 pixels is US Letter at 96dpi, and
   * a caller that had to know that would also have to know that A4 is 794 and
   * that landscape is not simply the same number — so three surfaces would each
   * hard-code a different rounding of the same fact. Here one inch is
   * twenty-four spacing units and the paper table is the only place the
   * conversion lives.
   *
   * **The margin is visible where the writing is, and there is no ruler.** A
   * ruler puts the measurement at the top of the screen and the text somewhere
   * else, so the author reads a number instead of seeing a gutter. All four
   * margins are drawn as a dashed guide around the text itself, which answers
   * the question the ruler was for — how much room is left — by looking.
   *
   * **A page is always its full height.** A sheet that shrank to what happens to
   * be on it would be a scrolling flow in a paper costume, and the page that
   * carries nothing but the tail of a heading is exactly where that shows.
   *
   * **The furniture is one control, projected.** The header and footer bands are
   * the same editor on every page, so pressing one opens *the* header rather
   * than the header on page four. That is why they are a callback and a snippet
   * rather than editable text in place: what is drawn here is a projection, and
   * a projection must not be typed into.
   */
  let {
    paper = "letter",
    orientation = "portrait",
    margins = { top: 1, bottom: 1, inside: 1.25, outside: 1 },
    caption,
    header,
    footer,
    onheader,
    onfooter,
    children
  }: {
    paper?: "letter" | "a4";
    orientation?: "portrait" | "landscape";
    /**
     * In inches, the unit page setup is stated in. Named inside and outside
     * rather than left and right so the setting survives a page turn.
     */
    margins?: {
      readonly top: number;
      readonly bottom: number;
      readonly inside: number;
      readonly outside: number;
    };
    /** Under the sheet: "Page 3", "Page 3 · continues 2". Never on the paper. */
    caption?: string;
    /** What the header band shows. Drawn inside the top margin, not in the text. */
    header?: Snippet;
    footer?: Snippet;
    /** Opens the one canonical header. Absent leaves the band inert. */
    onheader?: () => void;
    onfooter?: () => void;
    /** The flow, inset by the four margins. */
    children?: Snippet;
  } = $props();

  const trace = traceNode("ScreenPage", () => ({ paper, orientation, margins, caption }));

  /** The two papers, in inches, portrait. The only place 96dpi is written down. */
  const PAPER = {
    letter: { w: 8.5, h: 11 },
    a4: { w: 8.27, h: 11.69 }
  } as const;

  const sheet = $derived.by(() => {
    const size = PAPER[paper];
    return orientation === "landscape" ? { w: size.h, h: size.w } : { w: size.w, h: size.h };
  });

  /*
   * Margins as a percentage of the sheet rather than a length, so the guide, the
   * bands and the text column all move together under a canvas zoom instead of
   * one of them staying put and pulling the page apart.
   */
  const inset = $derived({
    top: `${(margins.top / sheet.h) * 100}%`,
    bottom: `${(margins.bottom / sheet.h) * 100}%`,
    inside: `${(margins.inside / sheet.w) * 100}%`,
    outside: `${(margins.outside / sheet.w) * 100}%`
  });
</script>

{#snippet band(
  content: Snippet | undefined,
  open: (() => void) | undefined,
  name: string,
  where: string
)}
  {#if open}
    <button
      type="button"
      onclick={open}
      aria-label={name}
      class="band hover:bg-surface-panel-hover text-caption text-ink-muted cursor-pointer {where}"
    >
      {#if content}{@render content()}{/if}
    </button>
  {:else if content}
    <div class="band text-caption text-ink-muted {where}">{@render content()}</div>
  {/if}
{/snippet}

<div {...trace} class="sheet">
  <article
    class="page bg-surface-panel border-border-subtle border"
    aria-label={caption}
    style="--paper-w: {sheet.w};
           --paper-h: {sheet.h};
           --m-top: {inset.top};
           --m-bottom: {inset.bottom};
           --m-inside: {inset.inside};
           --m-outside: {inset.outside}"
  >
    <!--
      All four gutters, dashed. Inside is drawn on the left because every sheet
      here is a recto; the setting is named inside and outside so it survives a
      page turn.
    -->
    <span class="guide border-border-strong" aria-hidden="true"></span>

    {@render band(header, onheader, "Edit the header", "band-header")}

    {#if children}
      <div class="flow">{@render children()}</div>
    {/if}

    {@render band(footer, onfooter, "Edit the footer", "band-footer")}
  </article>

  {#if caption}
    <span class="text-caption text-ink-muted tabular-nums">{caption}</span>
  {/if}
</div>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  /*
   * One inch is twenty-four spacing units — 96dpi written in the project's own
   * unit, so US Letter comes out at 204 units and nothing here spells 816.
   */
  .page {
    --inch: calc(var(--token-spacing-unit) * 24);
    position: relative;
    width: calc(var(--inch) * var(--paper-w));
    aspect-ratio: var(--paper-w) / var(--paper-h);
    max-width: 100%;
    overflow: hidden;
    box-shadow: var(--token-shadow-raised);
  }

  .guide {
    position: absolute;
    inset: var(--m-top) var(--m-outside) var(--m-bottom) var(--m-inside);
    border-width: 1px;
    border-style: dashed;
    pointer-events: none;
  }

  /*
   * The bands fill the top and bottom margins rather than taking heights of
   * their own: the guide is already the line between furniture and text, and a
   * band with its own measurement could sit on the wrong side of it.
   */
  .band {
    position: absolute;
    left: var(--m-inside);
    right: var(--m-outside);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    padding-inline: calc(var(--token-spacing-unit) * 1);
    text-align: start;
  }

  .band-header {
    top: 0;
    height: var(--m-top);
  }

  .band-footer {
    bottom: 0;
    height: var(--m-bottom);
  }

  .flow {
    position: absolute;
    inset: var(--m-top) var(--m-outside) var(--m-bottom) var(--m-inside);
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    overflow: hidden;
  }
</style>

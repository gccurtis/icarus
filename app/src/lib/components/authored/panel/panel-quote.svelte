<script lang="ts">
  import type { Snippet } from "svelte";

  import PanelLink from "$authored-components/panel/panel-link.svelte";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * Content quoted verbatim from somewhere else.
   *
   * A comment, the text a comment is anchored to, an instruction sent to an
   * agent, a passage a finding rests on, the current value of a formula. The
   * panel is showing it rather than saying it, and the difference has to be
   * visible or a quoted claim reads as the panel's own.
   *
   * **A quote carries a reference.** Showing someone a fragment and no way back
   * to where it came from is the failure mode this shape has: the panel has
   * removed the context that makes the fragment mean anything, and the reader
   * has to find it again by hand.
   *
   * **The reference sits inside the quote, not under it.** Set below the border
   * it belonged to nothing in particular — a link floating between a quotation
   * and whatever came next, which is a link whose subject has to be guessed.
   * Inside, the box is one object: this text, from there.
   *
   * **`onopen` is deliberately general.** What "the original" is differs by
   * quote — an inspection of the block it is anchored to, a tab opened at the
   * resource, a dialog over the thread, a website in a new browser tab. This
   * component knows none of that and must not: it reports that the reference was
   * clicked, and the caller decides what opening means.
   *
   * `intelligence` marks content a model produced. It is the one place the
   * generated/authored distinction is carried in the inspector, and it is
   * carried by a border rather than a fill so the text keeps ordinary contrast.
   */
  let {
    tone = "quoted",
    source,
    sourceLabel,
    when,
    onopen,
    children
  }: {
    tone?: "quoted" | "intelligence";
    /** Where this came from, named as the reader would recognise it. */
    source?: string;
    /**
     * When it was said, beside who said it.
     *
     * Separate from `source` because only the source is a reference: a name
     * leads somewhere and a timestamp does not, and joining them into one string
     * makes the whole caption a link to a person who was not clicked on.
     */
    when?: string;
    /**
     * A word before the source — "Source", "From", "Anchored to". Worth setting
     * where the reference could be mistaken for part of the quotation, and worth
     * leaving off where it plainly could not.
     */
    sourceLabel?: string;
    /** Open the original. Absent when there is genuinely nowhere to go. */
    onopen?: () => void;
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelQuote", () => ({ tone, source, sourceLabel }));
</script>

<figure
  {...trace}
  class={cn(
    "text-body-sm text-ink-secondary rounded-e-control mx-3 my-0 flex flex-col gap-1 border-s-2 py-1.5 ps-2 pe-2",
    tone === "quoted" && "border-border-strong bg-surface-panel-hover",
    tone === "intelligence" && "border-intelligence-border bg-intelligence-surface"
  )}
>
  <blockquote class="m-0">{@render children()}</blockquote>

  {#if source || when}
    <figcaption class="text-caption text-ink-muted flex flex-wrap items-baseline gap-1">
      {#if sourceLabel}
        <span>{sourceLabel}:</span>
      {/if}
      {#if source}
        {#if onopen}
          <PanelLink label={source} title="Open the original" onselect={onopen} />
        {:else}
          <span>{source}</span>
        {/if}
      {/if}
      {#if when}
        <span>{when}</span>
      {/if}
    </figcaption>
  {/if}
</figure>

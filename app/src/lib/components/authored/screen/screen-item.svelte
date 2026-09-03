<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * One entry in a `ScreenList`: who, what they did, and enough of what they
   * said to decide.
   *
   * **Not `PanelRow`.** That row lives in a flank, so both of its lines
   * truncate and its subtitle is a qualifier — a state, a location, a count —
   * rather than a quotation. On the plane there is room for two lines of what
   * somebody actually wrote, and a mention you cannot read is a mention you have
   * to open to triage. Reach for `PanelRow` in a flank; reach for this in the
   * centre.
   *
   * **The whole entry is the target, and the whole entry is its name.** A feed
   * entry read aloud as "Mira Jain mentioned you on Roof survey, the north bay
   * reading looks off, 3h, button" is long, and it is exactly what the reader
   * looking at it gets. The excerpt is here because it is what the decision is
   * made on, so hiding it from anything that cannot see would leave that reader
   * opening every entry to find out which one mattered.
   *
   * **A lead is a snippet, not an icon prop.** Half of these are faces, and
   * `PanelActor` is already the word for a face; an `icon` prop typed as a
   * component would make a mentions feed choose between the wrong renderer and
   * none, which is what makes a persona screen hand-roll an initials circle.
   *
   * **Controls turn the entry into a region.** A button cannot hold another
   * button, so an entry that carries Accept and Dismiss stops being one and its
   * title line becomes the target instead. `ScreenDecision` answers the same
   * problem the same way, because it is the same problem.
   */
  let {
    title,
    excerpt,
    meta,
    selected = false,
    onselect,
    lead,
    children,
    actions
  }: {
    /** The title line as plain text. Give `children` instead where it is marked up. */
    title?: string;
    /**
     * What was said, in the entry's own words. Two lines, then clamped — long
     * enough to decide on, short enough that ten entries still fit on a screen.
     */
    excerpt?: string;
    /** The right-hand end: an age, a count. Never a control. */
    meta?: string;
    selected?: boolean;
    onselect?: () => void;
    /** An actor or an icon. A `PanelActor`, a lucide glyph, a status dot. */
    lead?: Snippet;
    /**
     * The title line, marked up. Replaces `title`.
     *
     * A feed sentence names two things inside it — "**Mira Jain** mentioned you
     * on **Roof survey**" — and the emphasis is what makes it scannable. A
     * string prop cannot carry that, and a caller that has to build the sentence
     * out of three props has re-hand-rolled the entry.
     */
    children?: Snippet;
    /** Controls acting on this entry. Their presence makes it a region. */
    actions?: Snippet;
  } = $props();

  const trace = traceNode("ScreenItem", () => ({ title, excerpt, meta, selected }));
</script>

{#snippet titleLine()}
  <span class={cn("text-body-sm text-pretty", selected ? "text-active-text" : "text-ink-primary")}>
    {#if children}
      {@render children()}
    {:else}
      {title}
    {/if}
  </span>
{/snippet}

{#snippet body(interactiveTitle: boolean)}
  <span class="flex items-start gap-2.5">
    {#if lead}
      <!-- Nudged to the first line's baseline, so a 14px glyph and a 20px face both sit right. -->
      <span class="mt-0.5 flex shrink-0">{@render lead()}</span>
    {/if}

    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      {#if interactiveTitle && onselect}
        <button type="button" onclick={onselect} class="cursor-pointer text-start hover:underline">
          {@render titleLine()}
        </button>
      {:else}
        {@render titleLine()}
      {/if}

      {#if excerpt}
        <span class="text-caption text-ink-secondary line-clamp-2">{excerpt}</span>
      {/if}
    </span>

    {#if meta}
      <span class="text-caption text-ink-muted shrink-0 tabular-nums">{meta}</span>
    {/if}
  </span>
{/snippet}

<!--
  Always a `listitem`, whatever is inside it. `role="list"` owns listitems, so a
  bare button as the list's child would leave the stack counting one fewer entry
  than it draws.

  The selected entry carries a bar down its inside edge as well as a fill: the
  border is two pixels whether it is on or off, so nothing shifts, and the state
  survives a reader who cannot tell the fill from the surface.
-->
<div
  {...trace}
  role="listitem"
  class={cn(
    "flex min-w-0 flex-col border-s-2",
    selected ? "border-s-active-border bg-active-surface" : "border-s-transparent"
  )}
>
  {#if actions}
    <div class="flex flex-col gap-2 px-3 py-2.5">
      {@render body(true)}
      <!--
        A row of its own, because the entry above it is the target and a control
        inside a target fires it too.
      -->
      <span class="flex flex-wrap items-center gap-1.5">{@render actions()}</span>
    </div>
  {:else if onselect}
    <button
      type="button"
      onclick={onselect}
      aria-current={selected ? "true" : undefined}
      class="hover:bg-surface-panel-hover w-full cursor-pointer px-3 py-2.5 text-start"
    >
      {@render body(false)}
    </button>
  {:else}
    <div class="px-3 py-2.5">{@render body(false)}</div>
  {/if}
</div>

<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/simple-components/utils";

  /**
   * The quiet line under a workspace's content that qualifies it.
   *
   * Seven workspaces name a `note` region in their layout grid and every one of
   * them wrote its own paragraph, which had already split into two type sizes
   * across six files. This is `PanelNote`'s counterpart on the plane, and it
   * exists for the same reason that one does: the sentence is the point, and the
   * sentence is worth nothing if each screen re-decides how loudly to say it.
   *
   * **It is not a `ScreenBanner`, and the difference is loudness.** A banner
   * always draws a warning triangle in a filled box, because it says something
   * that has to be read *before* the work. This is read after it, is permanent,
   * and is not something to act on — putting "previews are rendered from the
   * real body" in an alert box shouts a footnote.
   *
   * **It is not dismissible**, because these are facts about the surface rather
   * than events. There is nothing to acknowledge.
   *
   * **`meta` is matched-of-total, never a bare number** — the same rule
   * `ScreenFilters` and `PanelSearchSection` keep. It is the figure that sits
   * opposite the caveat: one line stops a result being mistaken for a stored
   * one, the other stops a truncated view being mistaken for the whole.
   */
  let {
    tone = "muted",
    meta,
    children
  }: {
    /** `gap` for a limitation the model cannot lift, exactly as `PanelNote`. */
    tone?: "muted" | "gap";
    /** A figure at the far end: "Showing 6 of 41 · limit 10". */
    meta?: string;
    children: Snippet;
  } = $props();
</script>

<div
  class={cn(
    "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
    tone === "gap" &&
      "border-attention-border bg-attention-surface rounded-control border border-dashed px-3 py-2"
  )}
>
  <!-- Wrapped to the reading measure, not the plane: a caption run across
       1200px is a line nobody finds the start of again. -->
  <p
    class={cn(
      "text-caption m-0 max-w-prose",
      tone === "muted" && "text-ink-muted",
      tone === "gap" && "text-attention-text"
    )}
  >
    {@render children()}
  </p>
  {#if meta}
    <span class="text-caption text-ink-muted shrink-0 tabular-nums">{meta}</span>
  {/if}
</div>

<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A stack of entries on the plane, read top to bottom.
   *
   * A mentions feed, an activity feed, a thread of research turns, the tools a
   * persona is allowed. Five workspaces drew this by hand and none of them
   * agreed: two reached for `hover:bg-surface-hover`, one for
   * `hover:bg-surface-panel-hover`, and every one of them re-typed
   * `flex flex-col gap-0.5 border-b px-3 py-2 text-start last:border-b-0` onto a
   * raw `<button>`. A shape copied five times with three different hover fills
   * is a shape this vocabulary was missing a word for.
   *
   * **Not `ScreenTable`.** A table is columnar, and its whole value is that the
   * second row's third cell sits under the first row's third cell. A feed entry
   * is a paragraph — an actor, what they did, where, and enough of what they
   * said to decide — and it aligns with nothing above it. Reach for the table
   * the moment two entries have the same fields in the same order.
   *
   * **Not `ScreenCards`.** A card is a tile in a grid, sized by its picture,
   * for things recognised by looking. These run the full width and are scanned
   * as language.
   *
   * **The seams belong to the list, not to the entry.** An entry that drew its
   * own bottom rule needed `last:border-b-0` to stop it doubling the frame's,
   * and that is the exact line every hand-rolled copy got from somewhere else.
   * A rule between siblings is a fact about the stack.
   *
   * **`scroll` is for a feed that is a band of a grid**, where the band has a
   * height and the list has to give in to it. A list that simply runs down the
   * page must not take it: two scrolls inside one `ScreenSurface` is how a
   * reader loses the bottom of the page.
   */
  let {
    label,
    scroll = false,
    children
  }: {
    /** What the stack holds. The region's accessible name. */
    label: string;
    /** The list scrolls inside its own frame, for a feed in a fixed band. */
    scroll?: boolean;
    /** `ScreenItem`s. */
    children: Snippet;
  } = $props();

  const trace = traceNode("ScreenList", () => ({ label, scroll }));
</script>

<!--
  `role="list"` on a div rather than a `<ul>`, because the thing a caller puts
  after the last entry is a `ScreenEmpty` — and an empty state is not a list
  item, so a real `<ul>` would make the markup invalid the moment a feed ran dry.
-->
<div
  {...trace}
  role="list"
  aria-label={label}
  class={cn(
    "border-border-subtle rounded-panel flex min-w-0 flex-col overflow-hidden border",
    "[&>*+*]:border-t [&>*+*]:border-t-border-subtle",
    scroll && "min-h-0 overflow-y-auto"
  )}
>
  {@render children()}
</div>

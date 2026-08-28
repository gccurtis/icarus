<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * Nested lines that disclose. The group; `PanelBranch` is a node in it.
   *
   * A lattice, a question and the questions under it, a document outline, a
   * Context's terms — anything whose shape is the data's rather than the view's.
   *
   * **Not `PanelRow` with `depth`.** Indentation says where a line sits and
   * nothing else, so a forty-node lattice drawn as indented rows is forty rows
   * however narrow the thing being looked for; and `depth` stops at three,
   * because a fourth step leaves a title in a 300px column nowhere to be.
   * Disclosure is the difference. A shut branch is one line whatever is under
   * it, and depth costs nothing until it is opened.
   *
   * **Not `PanelSection`.** A section is a fixed band of a panel under a title
   * the view wrote, and a panel has as many as its specification lists. A branch
   * is content: arbitrarily deep, and as many as the data says.
   *
   * **The gutter belongs to the tree, not to the branch.** A branch is nested
   * arbitrarily deep, and one that carried the panel's own 12px would add it
   * again at every level. So a branch head is inset from this gutter, and its
   * hover fill is rounded for that reason — an inset target with a square fill
   * reads as a card, which is the call `PanelSection`'s `flush` already makes
   * for rows.
   */
  let {
    label,
    flush = false,
    children
  }: {
    /**
     * What the tree is of. The group's accessible name.
     *
     * Not drawn: a visible heading over a tree is `PanelSection`'s.
     */
    label: string;
    /** Drop the panel gutter, for a tree inside an already-padded region. */
    flush?: boolean;
    /** The top-level branches. */
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelTree", () => ({ label, flush }));
</script>

<div {...trace} role="group" aria-label={label} class={cn("flex flex-col", flush ? "px-0" : "px-3")}>
  {@render children()}
</div>

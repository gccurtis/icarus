<script lang="ts">
  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  import PanelButton from "./panel-button.svelte";

  /**
   * A panel with nothing in it, saying what belongs there and offering the way
   * on.
   *
   * **Not `PanelNote`.** A note is prose at the foot of a body — a footnote, a
   * `<p>`, an aside about something else on the screen. This *is* the body: it
   * stands where the rows would have been, and it has a control in it. A note
   * cannot hold a control and should not start doing so, because a footnote with
   * a button in it is the thing that put controls under lists of unbounded
   * length in the first place.
   *
   * **The two kinds are `ScreenEmpty`'s and they are kept.** A flank never used
   * and a filter that hid everything look identical and are entirely different
   * situations: one wants an invitation to make the first thing, the other wants
   * its filter cleared. A single "No results" reads as failure on the first and
   * as emptiness on the second, and is wrong both times.
   *
   * **The two kinds also look different, not only read differently.**
   * `nothing-yet` draws a dashed outline — the shape of the thing that is
   * missing, in the place it will appear. `no-matches` draws no frame at all:
   * that list is not missing, it is hidden, and outlining a region that is
   * actually full is a lie about the state of the panel.
   *
   * **Sized for 300px, which is where it stops being `ScreenEmpty`.** No
   * illustration, one line, one action, and left-aligned — every other word in
   * this vocabulary sets its text from the panel's left edge, so a centred block
   * in the middle of the stack reads as a foreign object rather than as part of
   * the column.
   */
  let {
    kind = "nothing-yet",
    title,
    action,
    onaction,
    flush = false
  }: {
    /** `nothing-yet` is a panel never used; `no-matches` is a filter that hid it all. */
    kind?: "nothing-yet" | "no-matches";
    /**
     * The one line. What belongs here, or what the filter hid — never the bare
     * word "Empty", which names the state the reader can already see and
     * withholds the only thing they came for.
     */
    title: string;
    /**
     * The label of the next valid act. For `no-matches` that is the way back
     * out — "Clear the filter", "Show all" — because the reader is looking at
     * the middle of the panel and the explanation is here rather than up in the
     * filter row.
     */
    action?: string;
    onaction?: () => void;
    /** Drop the panel gutter, for an empty state inside an already-padded section. */
    flush?: boolean;
  } = $props();

  const trace = traceNode("PanelEmpty", () => ({ kind, title, action, flush }));
</script>

<div
  {...trace}
  class={cn(
    "flex flex-col items-start gap-1.5 py-2",
    flush ? "mx-0" : "mx-3",
    kind === "nothing-yet" &&
      "border-border-subtle bg-surface-canvas rounded-panel border border-dashed px-2.5"
  )}
>
  <p class="text-caption text-ink-muted m-0">{title}</p>

  {#if action && onaction}
    <PanelButton label={action} onclick={onaction} />
  {/if}
</div>

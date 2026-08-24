<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A formula, an expression, or a call's arguments — set as what it is.
   *
   * Mono with the whitespace preserved, wrapping rather than scrolling. A
   * spreadsheet formula in a 300px panel is the reason: there is no formula bar,
   * so this is where a long expression has to breathe, and a horizontal scroll
   * inside a panel hides the end of it behind a gesture nobody makes.
   */
  let { children }: { children: Snippet } = $props();

  const trace = traceNode("PanelCode", () => ({}));
</script>

<pre
  {...trace}
  class="text-mono border-border-subtle bg-surface-canvas rounded-control text-ink-primary mx-3 my-0 overflow-x-auto border p-2 font-mono whitespace-pre-wrap">{@render children()}</pre>

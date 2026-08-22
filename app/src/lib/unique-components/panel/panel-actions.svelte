<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A row of controls inside a section, wrapping rather than overflowing.
   *
   * A panel is 300px wide and an action row is regularly four buttons. Wrapping
   * is the only honest answer — a horizontal scroll inside a panel hides
   * controls behind a gesture nobody makes, and truncation hides them entirely.
   */
  let { children }: { children: Snippet } = $props();

  const trace = traceNode("PanelActions", () => ({}));
</script>

<div {...trace} class="flex flex-wrap gap-1 px-3">{@render children()}</div>

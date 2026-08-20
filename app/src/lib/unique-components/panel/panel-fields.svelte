<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * A block of label-and-value pairs.
   *
   * A description list rather than a two-column grid of divs, because that is
   * what it is: every value here is described by its label, and a screen reader
   * should be able to say so.
   *
   * The labels column is fixed rather than sized to content, so the values in a
   * panel line up with the values in the panel above it. It is deliberately
   * narrow — a panel is about 300px and a label that takes a third of it leaves
   * nothing for the value — so a pair whose value will not fit stacks instead,
   * which is `PanelField`'s `stacked`.
   */
  let { children }: { children: Snippet } = $props();
</script>

<dl class="m-0 grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 px-3">
  {@render children()}
</dl>

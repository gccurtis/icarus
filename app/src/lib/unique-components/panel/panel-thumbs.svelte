<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A column of previews inside a panel, one or two across.
   *
   * The decision this holds is the one that was being re-made in view files:
   * how wide a preview is in a 300px column. A deck inspector imported the
   * *workspace* thumbnail into a panel and then hand-wrote its own padding and
   * `max-width: 12rem` to make it survive — panel width re-decided outside the
   * panel vocabulary, which is exactly what the vocabulary exists to prevent.
   *
   * **Two across is the maximum**, and it is for slides. At 300px, three 16:9
   * previews are 80px wide each and stop being pictures.
   */
  let {
    across = 1,
    children
  }: {
    /** `2` for slides, which are wide and numerous. `1` for everything else. */
    across?: 1 | 2;
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelThumbs", () => ({ across }));
</script>

<div {...trace} class="grid gap-2 px-3" class:grid-cols-1={across === 1} class:grid-cols-2={across === 2}>
  {@render children()}
</div>

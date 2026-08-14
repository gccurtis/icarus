<script lang="ts">
  import type { InspectionNode } from "$runtime/client/workbench";

  /**
   * Stand-in for an inspection kind that has no real view yet. Names what is
   * under inspection so the resolution chain is visibly working end to end.
   *
   * Every kind should eventually have its own view and this file should go.
   */
  let { node }: { node: InspectionNode } = $props();
</script>

<div class="placeholder">
  <p class="kind">{node.kind}</p>
  <p class="note">No inspector view for this kind yet.</p>
</div>

<style>
  .placeholder {
    display: flex;
    flex-direction: column;
    gap: var(--spacing);
  }

  .kind {
    font-family: var(--font-mono);
    font-size: var(--text-mono);
    color: var(--ink-primary);
  }

  .note {
    font-size: var(--text-caption);
    color: var(--ink-muted);
  }
</style>

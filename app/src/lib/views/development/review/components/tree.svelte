<script lang="ts">
  import type { TraceNode } from "$development-components/trace.svelte";
  import TreeNode from "$views/development/review/components/tree-node.svelte";

  /**
   * What the panel on the stage turned out to be made of.
   *
   * A panel is a vertical stack, so its composition is a vertical stack too and
   * needs nothing but nesting to be readable. The workspace pages use
   * [`grid-map`](grid-map.svelte) instead, because a grid's regions are the thing
   * a reader is checking and a flat tree loses them.
   */
  let {
    root,
    onhover
  }: {
    root: TraceNode;
    onhover: (id: string | undefined) => void;
  } = $props();
</script>

<section class="flex min-h-0 flex-col gap-1">
  <h2 class="text-caption text-ink-muted font-semibold tracking-wide uppercase">Made of</h2>

  {#if root.children.length === 0}
    <p class="text-caption text-ink-muted m-0">
      Nothing registered. Either it drew no primitive, or it has not mounted yet.
    </p>
  {:else}
    <ul class="m-0 list-none p-0">
      {#each root.children as child (child.id)}
        <TreeNode node={child} {onhover} />
      {/each}
    </ul>
  {/if}
</section>

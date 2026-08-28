<script lang="ts">
  import { Skeleton } from "$vendored-components/skeleton";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * What a panel shows while it is finding out.
   *
   * **It is shaped like the thing it stands for**, which is the whole decision.
   * A spinner in the middle of a 300px column says only "wait"; a stack the
   * height and rhythm of the rows that are coming says "a list, about this long"
   * — and when the rows land, nothing moves. The layout shift a generic loader
   * causes is the actual cost of a generic loader.
   *
   * **It is never a hidden failure.** A skeleton that stays forever is the worst
   * loading state there is, because it goes on promising. A caller that cannot
   * bound the wait shows a `PanelNote` instead, saying what is not answering.
   *
   * The registry's skeleton fills itself with `muted`, which is this project's
   * panel surface — so inside a panel it drew panel-coloured bars on a panel and
   * the whole thing was invisible. A loading state has to be visible against the
   * surface it loads on, which for a panel means a border tone rather than a
   * surface one.
   */
  let {
    shape = "rows",
    count = 3
  }: {
    /** `rows` for a list, `fields` for facts about one thing. */
    shape?: "rows" | "fields";
    count?: number;
  } = $props();

  const trace = traceNode("PanelSkeleton", () => ({ shape, count }));
</script>

<div {...trace} class="flex flex-col gap-2 px-3 py-1" aria-hidden="true">
  {#each Array.from({ length: count }) as _, index (index)}
    {#if shape === "rows"}
      <div class="flex items-center gap-2">
        <Skeleton class="bg-border-subtle size-3.5 shrink-0 rounded-sm" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton class="bg-border-subtle h-2.5 rounded-sm" style="width: {[82, 64, 74, 58][index % 4]}%" />
          <Skeleton class="bg-border-subtle h-2 rounded-sm" style="width: {[46, 38, 52, 34][index % 4]}%" />
        </div>
      </div>
    {:else}
      <div class="grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)] items-center gap-x-2">
        <Skeleton class="bg-border-subtle h-2.5 rounded-sm" style="width: {[70, 56, 64][index % 3]}%" />
        <Skeleton class="bg-border-subtle h-2.5 rounded-sm" style="width: {[84, 62, 74][index % 3]}%" />
      </div>
    {/if}
  {/each}
</div>

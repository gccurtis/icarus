<script lang="ts">
  import type { TraceNode } from "$lib/trace/trace.svelte";
  import TreeNode from "$views/review/components/tree-node.svelte";

  /**
   * A workspace, as its grid and what landed in each region.
   *
   * A workspace's specification IS a grid, so its composition read as a flat
   * stack loses the only structure a reviewer is checking. This reads the grid
   * back out of the rendered DOM rather than out of the source: the tracks and
   * the areas come from the computed style, and which region a component landed
   * in comes from the marker each traced primitive puts on its root.
   *
   * **Nothing here is written down twice.** A source parse would need keeping in
   * step with the CSS; the computed style is the CSS, so a region that was
   * renamed shows up renamed and a component that moved shows up moved.
   */
  let {
    root,
    revision,
    onhover
  }: {
    root: TraceNode;
    /** Bumped by the page whenever the stage may have changed shape. */
    revision: number;
    onhover: (id: string | undefined) => void;
  } = $props();

  type Region = { label: string; nodes: TraceNode[] };

  let tracks = $state("");
  let rows = $state<string[]>([]);
  let regions = $state<Region[]>([]);
  let loose = $state<TraceNode[]>([]);

  const flatten = (node: TraceNode): TraceNode[] => [
    node,
    ...node.children.flatMap(flatten)
  ];

  /** `area-needs-attention` → `needs attention`. */
  const labelOf = (element: Element | null): string | undefined => {
    const match = /(?:^|\s)area-([a-z0-9-]+)/.exec(element?.className ?? "");
    return match?.[1].replace(/-/g, " ");
  };

  const read = () => {
    const stage = document.querySelector("[data-review-stage]");
    if (!stage) return;

    const grid = [...stage.querySelectorAll<HTMLElement>("*")].find((element) => {
      const style = getComputedStyle(element);
      return style.display === "grid" && style.gridTemplateAreas !== "none";
    });

    tracks = grid ? getComputedStyle(grid).gridTemplateColumns : "";
    rows = grid
      ? (getComputedStyle(grid).gridTemplateAreas.match(/"[^"]*"/g) ?? []).map((row) =>
          row.replace(/"/g, "")
        )
      : [];

    const placed = new Map<string, string>();
    for (const node of flatten(root)) {
      const element = stage.querySelector(`[data-trace="${node.id}"]`);
      const label = labelOf(element?.closest("[class*='area-']") ?? null);
      if (label) placed.set(node.id, label);
    }

    /**
     * A node that marks no DOM inherits its parent's region rather than falling
     * out of the map.
     *
     * Two things cause an unmarked node and neither is a defect. A handful of
     * primitives sit on a registry component that takes no HTML attributes at
     * all — `Select.Root` is a context provider and renders no element of its
     * own. And where a traced component wraps another, both write `data-trace` to
     * the same element and the outer one wins, so the inner node has no anchor.
     *
     * A node only starts a group when its region differs from its parent's, so
     * an inherited one is shown nested under the component that placed it, which
     * is where a reader would look for it anyway.
     */
    const found = new Map<string, TraceNode[]>();
    const walk = (node: TraceNode, parentLabel?: string) => {
      const label = placed.get(node.id) ?? parentLabel;
      if (label !== undefined && label !== parentLabel) {
        found.set(label, [...(found.get(label) ?? []), node]);
      }
      for (const child of node.children) walk(child, label);
    };
    for (const child of root.children) walk(child);

    // Region order follows the grid, so the list reads like the picture.
    const order = [...new Set(rows.flatMap((row) => row.trim().split(/\s+/)))].filter(
      (name) => name !== "."
    );
    regions = order
      .map((name) => ({ label: name.replace(/-/g, " "), nodes: found.get(name.replace(/-/g, " ")) ?? [] }))
      .filter((region) => region.nodes.length > 0 || rows.length > 0);

    // Only a top-level node with no region at all, which means the workspace
    // drew it outside every area — worth seeing rather than dropping.
    loose = root.children.filter((child) => !placed.has(child.id));
  };

  $effect(() => {
    // Re-read after the stage has painted: the computed grid does not exist
    // until it has.
    void root.children.length;
    void revision;
    const frame = requestAnimationFrame(read);
    return () => cancelAnimationFrame(frame);
  });
</script>

<section class="flex min-h-0 flex-col gap-2">
  <h2 class="text-caption text-ink-muted font-semibold tracking-wide uppercase">The grid</h2>

  {#if rows.length === 0}
    <p class="text-caption text-ink-muted m-0">
      No grid on the stage. Either this centre is one region, or it has not painted yet.
    </p>
  {:else}
    <!-- The layout table from the specification, read back out of the CSS. -->
    <div class="border-border-subtle rounded-panel flex flex-col gap-0.5 border p-2">
      <p class="text-caption text-ink-muted m-0 font-mono">{tracks}</p>
      {#each rows as row, index (index)}
        <p class="text-caption text-ink-secondary m-0 font-mono">{row}</p>
      {/each}
    </div>
  {/if}

  {#each regions as region (region.label)}
    <div class="flex flex-col">
      <h3 class="text-caption text-ink-secondary m-0 font-semibold">{region.label}</h3>
      {#if region.nodes.length === 0}
        <p class="text-caption text-ink-muted m-0 ps-3">nothing traced here</p>
      {:else}
        <ul class="m-0 list-none p-0">
          {#each region.nodes as node (node.id)}
            <TreeNode {node} {onhover} />
          {/each}
        </ul>
      {/if}
    </div>
  {/each}

  {#if loose.length > 0}
    <div class="flex flex-col">
      <h3 class="text-caption text-ink-secondary m-0 font-semibold">outside every region</h3>
      <ul class="m-0 list-none p-0">
        {#each loose as node (node.id)}
          <TreeNode {node} {onhover} />
        {/each}
      </ul>
    </div>
  {/if}
</section>

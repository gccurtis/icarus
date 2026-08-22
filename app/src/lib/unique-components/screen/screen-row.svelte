<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Table from "$lib/simple-components/table";
  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * One row of a `ScreenTable`.
   *
   * The whole row hovers, but the *click target* is whatever the caller puts in
   * the first cell — a name button — rather than the row itself. A clickable
   * `<tr>` cannot hold the links a row needs in its other cells: an actor in a
   * "who" column has to be reachable on its own, and nesting a button inside a
   * clickable row makes both ambiguous.
   *
   * `data-state` rather than a class of our own for selection, because that is
   * the registry's convention and a row is the one place three components have
   * to agree about what "selected" looks like.
   */
  let {
    selected = false,
    children
  }: {
    selected?: boolean;
    children: Snippet;
  } = $props();

  // `Table.Row` forwards its rest props, so the marker lands on the `<tr>` it renders.
  const trace = traceNode("ScreenRow", () => ({ selected }));
</script>

<Table.Row
  {...trace}
  data-state={selected ? "selected" : undefined}
  class={cn(
    "border-b-0",
    "hover:bg-surface-panel-hover",
    selected && "data-[state=selected]:bg-active-surface"
  )}
>
  {@render children()}
</Table.Row>

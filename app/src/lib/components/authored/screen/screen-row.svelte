<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Table from "$vendored-components/table";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * One row of a `ScreenTable`.
   *
   * **The whole row is the pointer target; the name is the keyboard one.** A row
   * that only answered on its name made the other three quarters of it dead to a
   * click that plainly meant "this one". So `onselect` fires from anywhere on the
   * row — and the name button stays, because a nineteen-row table wants one tab
   * stop per row rather than two, and a `<tr>` cannot carry the selected-state
   * semantics without the whole table becoming a grid.
   *
   * A click that started on a control is that control's. An actor in a "who"
   * column has to be reachable on its own, and a row handler that also fired
   * would make one press do two things.
   *
   * `data-state` rather than a class of our own for selection, because that is
   * the registry's convention and a row is the one place three components have
   * to agree about what "selected" looks like.
   */
  let {
    selected = false,
    onselect,
    onopen,
    children
  }: {
    selected?: boolean;
    /** A single click anywhere the row's own cells are not already listening. */
    onselect?: () => void;
    /** A double click, in the same place. */
    onopen?: () => void;
    children: Snippet;
  } = $props();

  /** Whether the press belongs to something inside the row rather than to the row. */
  const onControl = (event: MouseEvent): boolean =>
    event.target instanceof Element &&
    event.target.closest("a, button, input, select, textarea, [role='button']") !== null;

  // `Table.Row` forwards its rest props, so the marker lands on the `<tr>` it renders.
  const trace = traceNode("ScreenRow", () => ({ selected }));
</script>

<Table.Row
  {...trace}
  data-state={selected ? "selected" : undefined}
  onclick={onselect && ((event: MouseEvent) => {
    if (!onControl(event)) onselect();
  })}
  ondblclick={onopen && ((event: MouseEvent) => {
    if (!onControl(event)) onopen();
  })}
  class={cn(
    "border-b-0",
    "hover:bg-surface-panel-hover",
    onselect && "cursor-pointer",
    selected && "data-[state=selected]:bg-active-surface"
  )}
>
  {@render children()}
</Table.Row>

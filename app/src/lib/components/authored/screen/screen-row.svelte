<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Table from "$vendored-components/table";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  let {
    selected = false,
    onselect,
    onopen,
    children
  }: {
    selected?: boolean;
    onselect?: () => void;
    onopen?: () => void;
    children: Snippet;
  } = $props();

  const onControl = (event: MouseEvent): boolean =>
    event.target instanceof Element &&
    event.target.closest("a, button, input, select, textarea, [role='button']") !== null;

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
    "hover:bg-surface-panel",
    onselect && "cursor-pointer",
    selected && "data-[state=selected]:bg-active-surface"
  )}
>
  {@render children()}
</Table.Row>

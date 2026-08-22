<script lang="ts">
  import type { Component, Snippet } from "svelte";

  import { Button } from "$lib/simple-components/button";
  import * as Table from "$lib/simple-components/table";
  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * One cell, in the three shapes a table here actually uses.
   *
   * `name` is the row's identity and its click target: an icon, a label, and the
   * button that opens it. `num` is right-aligned tabular figures for a time or a
   * count. Plain is everything else.
   *
   * The name's control is `simple-components/button` in its `link` variant —
   * the same word `PanelLink` is built on, so a name in a table and a name in a
   * panel are the same thing wearing the same clothes.
   */
  let {
    name,
    icon: Icon,
    num = false,
    onselect,
    children
  }: {
    /** The row's identity. Rendered as a button when `onselect` is given. */
    name?: string;
    icon?: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
    /** Tabular figures, for a time, a count or a measurement. */
    num?: boolean;
    onselect?: () => void;
    children?: Snippet;
  } = $props();

  // `Table.Cell` forwards its rest props, so the marker lands on the `<td>` it renders.
  const trace = traceNode("ScreenCell", () => ({ name, num }));
</script>

{#snippet label()}
  {#if Icon}
    <span class="text-ink-muted flex shrink-0"><Icon size={14} aria-hidden="true" /></span>
  {/if}
  {name}
{/snippet}

<Table.Cell
  {...trace}
  class={cn(
    "text-body-sm text-ink-secondary border-border-subtle border-b px-3 py-0 align-middle whitespace-normal",
    num && "tabular-nums"
  )}
>
  {#if name !== undefined && onselect}
    <Button
      variant="link"
      onclick={onselect}
      class="text-body-sm text-ink-primary h-auto min-h-9 justify-start gap-2 p-0 font-normal whitespace-normal"
    >
      {@render label()}
    </Button>
  {:else if name !== undefined}
    <span class="text-body-sm text-ink-primary inline-flex min-h-9 items-center gap-2">
      {@render label()}
    </span>
  {:else if children}
    {@render children()}
  {/if}
</Table.Cell>

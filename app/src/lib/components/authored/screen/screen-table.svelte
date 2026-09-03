<script lang="ts">
  import type { Snippet } from "svelte";

  import * as Table from "$vendored-components/table";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  let {
    columns = [],
    scroll = false,
    head,
    children
  }: {
    columns?: readonly string[];
    head?: Snippet;
    scroll?: boolean;
    children: Snippet;
  } = $props();

  const trace = traceNode("ScreenTable", () => ({ columns, scroll }));
</script>

<div
  {...trace}
  class={cn(
    "border-border-subtle rounded-panel overflow-hidden border",
    scroll &&
      "flex min-h-0 flex-1 flex-col [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1 [&>[data-slot=table-container]]:[scrollbar-width:thin] [&>[data-slot=table-container]]:[scrollbar-color:transparent_transparent] [&:hover>[data-slot=table-container]]:[scrollbar-color:var(--token-border-strong)_transparent] [&>[data-slot=table-container]::-webkit-scrollbar]:w-1.5 [&>[data-slot=table-container]::-webkit-scrollbar-track]:bg-transparent [&>[data-slot=table-container]::-webkit-scrollbar-thumb]:rounded-full [&>[data-slot=table-container]::-webkit-scrollbar-thumb]:bg-transparent [&>[data-slot=table-container]::-webkit-scrollbar-thumb]:transition-colors [&:hover>[data-slot=table-container]::-webkit-scrollbar-thumb]:bg-border-strong [&_thead_th]:bg-surface-panel-hover [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:shadow-[inset_0_-1px_0_var(--token-border-subtle)]"
  )}
>
  <Table.Root class="border-collapse">
    <Table.Header class="bg-surface-panel-hover [&_tr]:border-b-0">
      {#if head}
        {@render head()}
      {:else}
        <tr>
          {#each columns as column (column)}
            <Table.Head
              class="text-caption text-ink-muted border-border-subtle h-auto border-b px-3 py-2 text-start font-semibold tracking-wide uppercase"
            >
              {column}
            </Table.Head>
          {/each}
        </tr>
      {/if}
    </Table.Header>
    <Table.Body>
      {@render children()}
    </Table.Body>
  </Table.Root>
</div>

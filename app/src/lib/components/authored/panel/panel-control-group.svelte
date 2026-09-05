<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  let {
    flush = false,
    children
  }: {
    flush?: boolean;
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelControlGroup", () => ({ flush }));
</script>

<div {...trace} class={cn("flex min-w-0 flex-col gap-1.5", flush ? "px-0" : "px-3")}>
  {@render children()}
</div>

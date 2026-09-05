<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$development-components/trace.svelte";

  let {
    label,
    detail,
    children
  }: {
    label: string;
    detail?: string;
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelControlRow", () => ({ label, detail }));
</script>

<div {...trace} class="grid min-w-0 grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)] items-center gap-2">
  <span class="text-caption text-ink-muted min-w-0" title={detail}>{label}</span>
  <div class="flex min-w-0 items-center justify-stretch gap-1.5 [&>*]:min-w-0 [&>*]:flex-1">
    {@render children()}
  </div>
</div>

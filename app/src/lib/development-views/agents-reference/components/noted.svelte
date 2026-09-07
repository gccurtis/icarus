<script lang="ts">
  import type { Snippet } from "svelte";

  import NoteBox from "$development-views/agents-reference/components/note-box.svelte";

  let {
    scope,
    label,
    children
  }: {
    scope: string;
    label: string;
    children: Snippet;
  } = $props();
</script>

<div class="ar-noted">
  <div class="min-w-0">{@render children()}</div>
  <NoteBox {scope} {label} />
</div>

<script lang="ts">
  import type { Snippet } from "svelte";

  // The single style entry, imported once at the root so every route inherits
  // it. See lib/style/app.css for what it composes.
  import "$lib/style/app.css";

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Icarus</title>
</svelte:head>

{@render children()}

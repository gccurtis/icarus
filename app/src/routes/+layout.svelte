<script lang="ts">
  import type { Snippet } from "svelte";

  // The single style entry, imported once at the root so every route inherits
  // it. See lib/styles/app.css for the complete execution manifest.
  import "$styles/app.css";

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Icarus</title>
</svelte:head>

{@render children()}

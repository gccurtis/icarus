<script lang="ts">
  import type { Snippet } from "svelte";

  import { applyAppearance } from "$surfaces/top-bar/effects/apply-appearance.svelte";

  import "$styles/app.css";

  applyAppearance();

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Icarus</title>
  <link rel="icon" href="/favicon.svg" />
</svelte:head>

{@render children()}

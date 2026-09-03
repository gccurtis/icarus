<script lang="ts">
  import type { Snippet } from "svelte";

  import { applyTheme, storedTheme } from "$surfaces/top-bar/effects/apply-theme.svelte";

  // The single style entry, imported once at the root so every route inherits
  // it. See lib/styles/app.css for the complete execution manifest.
  import "$styles/app.css";

  let theme = $state(storedTheme());

  // Appearance applies to development routes as well as the application shell.
  applyTheme(() => theme);

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Icarus</title>
</svelte:head>

{@render children()}

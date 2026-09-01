<script lang="ts">
  import App from "$surfaces/app/app.svelte";

  /**
   * /app/[project] — the application.
   *
   * One import, because there is nothing for a route to decide here. The frame
   * fills its own centre from the active tab, so this page supplies no content
   * and holds no geometry; the layout above it built the client instance that
   * every zone reads.
   */
</script>

<svelte:head>
  <title>Icarus</title>
</svelte:head>

<App />

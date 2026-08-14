<script lang="ts">
  /**
   * /app — the work surface with nothing open in it yet.
   *
   * This is the only region of the shell a route controls; everything around
   * it belongs to the layout and stays put across navigation.
   */
</script>

<svelte:head>
  <title>Icarus</title>
</svelte:head>

<div class="empty">
  <p>No object open.</p>
</div>

<style>
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: calc(var(--spacing) * 6);
  }

  p {
    font-size: var(--text-body-sm);
    color: var(--ink-muted);
  }
</style>

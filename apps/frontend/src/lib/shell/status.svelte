<script lang="ts">
  /**
   * Status — infrastructural. Sync, queue, and connection state live here and
   * never interrupt.
   *
   * Static placeholder.
   */
</script>

<footer class="status">
  <span class="placeholder">status</span>
</footer>

<style>
  .status {
    grid-area: status;
    display: flex;
    align-items: center;
    padding-inline: calc(var(--spacing) * 3);
    background-color: var(--surface-panel);
    border-top: 1px solid var(--border-subtle);
  }

  .placeholder {
    font-size: var(--text-caption);
    color: var(--ink-muted);
  }
</style>

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
    padding-inline: calc(var(--token-spacing-unit) * 3);
    background-color: var(--token-surface-panel);
    border-top: 1px solid var(--token-border-subtle);
  }

  .placeholder {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }
</style>

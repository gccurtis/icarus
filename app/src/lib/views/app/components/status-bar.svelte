<script lang="ts">
  /**
   * Status — infrastructural. Sync, queue, and connection state live here and
   * never interrupt.
   *
   * A component for the same reason the top bar is one: it reads nothing and
   * coordinates nothing yet. Connection state is the read that will promote it.
   *
   * Static placeholder.
   */
</script>

<footer class="status-bar">
  <span class="placeholder">status</span>
</footer>

<style>
  .status-bar {
    height: 100%;
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

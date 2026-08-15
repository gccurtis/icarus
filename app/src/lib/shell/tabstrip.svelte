<script lang="ts">
  /**
   * Tab strip — which open objects exist and which one is active.
   *
   * Static placeholder. The tab runtime, and the state it needs to survive
   * navigation, arrive later; the strip sits in the shell layout rather than
   * in a route so that state has somewhere to live that does not remount.
   */
</script>

<div class="tabstrip">
  <span class="placeholder">tabs</span>
</div>

<style>
  .tabstrip {
    grid-area: tabstrip;
    display: flex;
    align-items: center;
    padding-inline: calc(var(--token-spacing-unit) * 3);
    background-color: var(--token-surface-panel);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .placeholder {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }
</style>

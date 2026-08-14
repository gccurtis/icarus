<script lang="ts">
  /**
   * The context panel's content view — what the rail's current selection
   * resolves to. Split from the rail so the two can be reasoned about
   * separately: the rail decides, this displays.
   *
   * Static placeholder. What it displays arrives with the runtime.
   */
</script>

<div class="content">
  <span class="placeholder">context</span>
</div>

<style>
  .content {
    flex: 1;
    min-width: 0;
    /* One scroll context per zone: nesting scrollable regions inside a panel
     * makes position unrecoverable. */
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 3);
  }

  .placeholder {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }
</style>

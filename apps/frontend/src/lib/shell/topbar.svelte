<script lang="ts">
  /**
   * Top bar — always visible, never route-dependent. The first rung of the
   * disclosure ladder lives here: primary actions and critical state.
   *
   * Static placeholder beyond the wordmark.
   */
</script>

<header class="topbar">
  <span class="wordmark">ICARUS</span>
</header>

<style>
  .topbar {
    grid-area: topbar;
    display: flex;
    align-items: center;
    gap: var(--token-spacing-unit);
    padding-inline: calc(var(--token-spacing-unit) * 3);
    background-color: var(--token-surface-panel);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .wordmark {
    font-size: var(--token-text-label);
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--token-ink-secondary);
  }
</style>

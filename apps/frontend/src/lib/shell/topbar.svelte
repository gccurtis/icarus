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
    gap: var(--spacing);
    padding-inline: calc(var(--spacing) * 3);
    background-color: var(--surface-panel);
    border-bottom: 1px solid var(--border-subtle);
  }

  .wordmark {
    font-size: var(--text-label);
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--ink-secondary);
  }
</style>

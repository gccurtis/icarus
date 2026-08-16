<script lang="ts">
  /**
   * Top bar — always visible, never route-dependent. The first rung of the
   * disclosure ladder lives here: primary actions and critical state.
   *
   * A component rather than a view, and the test is not size. It reads no client
   * model, coordinates no siblings, and needs no concern directory, so a
   * document for it could only restate its own markup. The day it holds a
   * command palette or reads sync state it becomes a view, which costs one
   * generator run and one import.
   *
   * Static placeholder beyond the wordmark.
   */
</script>

<header class="top-bar">
  <span class="wordmark">ICARUS</span>
</header>

<style>
  .top-bar {
    height: 100%;
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

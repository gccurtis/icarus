<script lang="ts">
  /**
   * The context panel's rail — the fixed strip that selects what the content
   * view shows. It belongs to the context panel rather than the shell, because
   * it is that panel's own navigation and has no meaning without it.
   *
   * Static placeholder. Selection state arrives with the runtime.
   */
</script>

<nav class="rail" aria-label="Context">
  <span class="placeholder">rail</span>
</nav>

<style>
  .rail {
    width: var(--shell-rail);
    flex-shrink: 0;
    border-right: 1px solid var(--token-border-subtle);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-block: var(--token-spacing-unit);
  }

  .placeholder {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
    writing-mode: vertical-rl;
  }
</style>

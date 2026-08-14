<script lang="ts">
  /**
   * Inspector — the lens. It answers "what is this selected thing?"
   *
   * Shares --shell-panel with the context panel, so the two flanks are the
   * same width by construction rather than by coincidence.
   *
   * Static placeholder. Selection-driven content arrives with the runtime.
   */
</script>

<aside class="inspector" aria-label="Inspector">
  <span class="placeholder">inspector</span>
</aside>

<style>
  .inspector {
    grid-area: inspector;
    min-height: 0;
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 3);
    background-color: var(--token-surface-panel);
    border-left: 1px solid var(--token-border-subtle);
  }

  .placeholder {
    font-size: var(--token-text-caption);
    color: var(--token-ink-muted);
  }
</style>

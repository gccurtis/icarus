<script lang="ts">
  /**
   * /app/[project] — the work surface, with nothing open in it yet.
   *
   * The Convex round trip that used to live here moved to `/mock/[project]`. It
   * was a probe rather than a surface: it belonged to no tab and answered to no
   * resource kind, so keeping it here meant the one thing the work surface
   * rendered was the one thing the workbench did not know about.
   */
</script>

<div class="surface">
  <p class="note">Nothing open.</p>
</div>

<style>
  .surface {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: calc(var(--token-spacing-unit) * 6);
  }

  .note {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
  }
</style>

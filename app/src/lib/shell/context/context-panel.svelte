<script lang="ts">
  import Content from "$lib/shell/context/content.svelte";
  import Rail from "$lib/shell/context/rail.svelte";

  /**
   * Context — the map. It answers "where am I and what else is here?"
   *
   * The rail is inside this panel, not beside it in the shell grid. It is the
   * panel's own navigation, so consolidating them means the shell sees one
   * zone and the panel owns how it divides internally.
   *
   * Its total width is --shell-panel, the same token the inspector uses. The
   * two flank the work surface, so equal widths keep the shell symmetric — and
   * one token rather than two identical ones means they cannot drift apart by
   * accident.
   */
</script>

<aside class="context-panel">
  <Rail />
  <Content />
</aside>

<style>
  .context-panel {
    grid-area: context;
    display: flex;
    min-height: 0;
    background-color: var(--token-surface-panel);
    border-right: 1px solid var(--token-border-subtle);
  }
</style>

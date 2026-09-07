<script lang="ts">
  import type { Snippet } from "svelte";

  let { label, children }: { label?: string; children: Snippet } = $props();
</script>

<div class="well">
  <div class="port" role={label === undefined ? undefined : "region"} aria-label={label}>
    {@render children()}
  </div>
  <div class="recess" aria-hidden="true"></div>
</div>

<style>
  .well {
    position: relative;
    display: flex;
    min-height: 0;
    flex: 1;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-overlay);
    background: var(--token-surface-panel);
  }

  .port {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    overscroll-behavior-block: contain;
    padding: calc(var(--token-spacing-unit) * 1.5);
    scrollbar-color: var(--token-border-strong) transparent;
    scrollbar-width: thin;
  }

  .port::-webkit-scrollbar {
    width: calc(var(--token-spacing-unit) * 1);
  }

  .port::-webkit-scrollbar-track {
    margin-block: calc(var(--token-spacing-unit) * 1.5);
    background: transparent;
  }

  .port::-webkit-scrollbar-thumb {
    border-radius: var(--token-radius-control);
    background: var(--token-border-strong);
  }

  .port::-webkit-scrollbar-thumb:hover {
    background: var(--token-ink-muted);
  }

  .recess {
    position: absolute;
    z-index: 1;
    inset: 0;
    border-radius: inherit;
    box-shadow:
      inset 0 8px 9px -9px var(--token-shadow-occlusion),
      inset 9px 0 10px -10px var(--token-shadow-occlusion),
      inset -9px 0 10px -10px var(--token-shadow-occlusion),
      inset 0 -7px 8px -9px var(--token-shadow-occlusion);
    pointer-events: none;
  }
</style>

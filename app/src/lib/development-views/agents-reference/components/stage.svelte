<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    geometry,
    width = "plane",
    height,
    children
  }: {
    label: string;
    geometry?: string;
    width?: "flank" | "plane" | "full";
    height?: string;
    children: Snippet;
  } = $props();
</script>

<figure class="stage stage-{width}">
  <figcaption>
    <strong>{label}</strong>
    {#if geometry}<span>{geometry}</span>{/if}
  </figcaption>
  <div class="body" style:height>
    {@render children()}
  </div>
</figure>

<style>
  .stage {
    display: flex;
    flex-direction: column;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-elevated);
    box-shadow: var(--token-shadow-panel);
  }

  .stage-flank {
    width: 20rem;
    max-width: 100%;
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.5rem 0.85rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  figcaption strong {
    color: var(--token-color-active-text);
    font-weight: var(--token-weight-medium);
  }

  figcaption span {
    color: var(--token-ink-muted);
  }

  .body {
    position: relative;
    min-height: 0;
    background: var(--token-surface-panel);
  }

  .stage-plane .body,
  .stage-full .body {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--token-surface-work);
  }

  .stage-plane .body > :global(*),
  .stage-full .body > :global(*) {
    min-height: 0;
    flex: 1;
  }
</style>

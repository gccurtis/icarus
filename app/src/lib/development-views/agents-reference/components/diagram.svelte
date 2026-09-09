<script lang="ts">
  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";

  let {
    label,
    source,
    caption,
    minHeight = "26rem"
  }: {
    label: string;
    source: string;
    caption?: string;
    minHeight?: string;
  } = $props();
</script>

<figure class="frame">
  <figcaption>{label}</figcaption>
  <div class="body">
    <MermaidDiagram {source} {label} {caption} {minHeight} />
  </div>
</figure>

<style>
  .frame {
    display: flex;
    flex-direction: column;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-elevated);
  }

  figcaption {
    padding: 0.5rem 0.85rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .body {
    min-width: 0;
    overflow-x: auto;
    color: var(--token-ink-primary);
  }
</style>

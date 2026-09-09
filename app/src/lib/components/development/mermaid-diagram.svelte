<script module lang="ts">
  let renderQueue: Promise<void> = Promise.resolve();

  const serializeRender = <T,>(work: () => Promise<T>): Promise<T> => {
    const result = renderQueue.then(work, work);
    renderQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
</script>

<script lang="ts">
  import {
    mountMermaidDiagram,
    type MermaidPalette
  } from "$development-components/effects/mermaid-diagram.svelte";

  let {
    source,
    label,
    caption,
    palette = "adaptive",
    minHeight = "24rem"
  }: {
    source: string;
    label: string;
    caption?: string;
    palette?: MermaidPalette;
    minHeight?: string;
  } = $props();

  let host: HTMLDivElement;
  let status = $state<"loading" | "ready" | "error">("loading");
  let failure = $state("");

  mountMermaidDiagram({
    host: () => host,
    source: () => source,
    palette: () => palette,
    serialize: serializeRender,
    loading: () => (status = "loading"),
    ready: () => (status = "ready"),
    failed: (message) => {
      failure = message;
      status = "error";
    }
  });
</script>

<figure class="diagram diagram-{palette}" aria-label={label} style:--diagram-min-height={minHeight}>
  <div class="diagram-stage" class:loaded={status === "ready"}>
    {#if status === "loading"}
      <div class="diagram-loading" aria-live="polite">
        <span></span>
        <span></span>
        <span></span>
        <small>constructing diagram</small>
      </div>
    {/if}
    {#if status === "error"}
      <div class="diagram-error" role="alert">
        <strong>Diagram unavailable</strong>
        <span>{failure}</span>
      </div>
    {/if}
    <div class="mermaid-output" bind:this={host} role="img" aria-label={label}></div>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  figure {
    margin: 0;
  }

  .diagram-stage {
    position: relative;
    display: grid;
    min-height: var(--diagram-min-height);
    place-items: center;
    overflow: auto;
    opacity: 0.72;
    transition: opacity 180ms ease;
  }

  .diagram-stage.loaded {
    opacity: 1;
  }

  .mermaid-output {
    width: 100%;
    min-width: 44rem;
    padding: 1.25rem;
  }

  .mermaid-output:empty {
    display: none;
  }

  .diagram-loading {
    display: grid;
    grid-template-columns: repeat(3, 0.7rem);
    gap: 0.4rem;
    align-items: center;
    color: currentColor;
    font-family: var(--token-font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .diagram-loading span {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 999px;
    background: currentColor;
    animation: pulse 1.1s ease-in-out infinite;
  }

  .diagram-loading span:nth-child(2) {
    animation-delay: 120ms;
  }

  .diagram-loading span:nth-child(3) {
    animation-delay: 240ms;
  }

  .diagram-loading small {
    grid-column: 1 / -1;
    white-space: nowrap;
  }

  .diagram-error {
    display: grid;
    max-width: 32rem;
    gap: 0.4rem;
    padding: 1rem;
    border: 1px solid currentColor;
    font-size: 0.8rem;
  }

  .diagram-error span {
    opacity: 0.74;
  }

  figcaption {
    padding: 0.8rem 1rem;
    border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    color: color-mix(in srgb, currentColor 68%, transparent);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
    line-height: 1.5;
  }

  :global(.mermaid-output svg) {
    display: block;
    width: 100% !important;
    height: auto !important;
    max-width: none !important;
    margin: auto;
  }

  :global(.mermaid-output .nodeLabel),
  :global(.mermaid-output .edgeLabel),
  :global(.mermaid-output .messageText),
  :global(.mermaid-output .labelText) {
    line-height: 1.35 !important;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.22;
      transform: translateY(0);
    }
    50% {
      opacity: 1;
      transform: translateY(-0.18rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .diagram-loading span {
      animation: none;
    }
  }
</style>

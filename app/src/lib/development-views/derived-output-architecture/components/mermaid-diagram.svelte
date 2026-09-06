<script lang="ts">
  import { onMount } from "svelte";

  type Palette = "paper" | "night";

  let {
    source,
    label,
    caption,
    palette = "paper",
    minHeight = "24rem"
  }: {
    source: string;
    label: string;
    caption?: string;
    palette?: Palette;
    minHeight?: string;
  } = $props();

  let host: HTMLDivElement;
  let status = $state<"loading" | "ready" | "error">("loading");
  let failure = $state("");

  const themeVariables = (selected: Palette) =>
    selected === "night"
      ? {
          background: "#0b1320",
          primaryColor: "#142538",
          primaryTextColor: "#eef7f3",
          primaryBorderColor: "#4ed9b1",
          secondaryColor: "#1b2f45",
          secondaryTextColor: "#eef7f3",
          secondaryBorderColor: "#77a9d4",
          tertiaryColor: "#201f35",
          tertiaryTextColor: "#f6ebe2",
          tertiaryBorderColor: "#ec8f6b",
          lineColor: "#7f9aae",
          textColor: "#eef7f3",
          mainBkg: "#142538",
          nodeBorder: "#4ed9b1",
          clusterBkg: "#0f1c2b",
          clusterBorder: "#31516b",
          edgeLabelBackground: "#0b1320",
          fontFamily: "IBM Plex Sans, sans-serif",
          fontSize: "14px"
        }
      : {
          background: "#f4f0e8",
          primaryColor: "#fffdf8",
          primaryTextColor: "#172232",
          primaryBorderColor: "#315a72",
          secondaryColor: "#e8f0ef",
          secondaryTextColor: "#172232",
          secondaryBorderColor: "#347f78",
          tertiaryColor: "#fff1df",
          tertiaryTextColor: "#492c17",
          tertiaryBorderColor: "#d06b32",
          lineColor: "#687784",
          textColor: "#172232",
          mainBkg: "#fffdf8",
          nodeBorder: "#315a72",
          clusterBkg: "#ece7dc",
          clusterBorder: "#a8a093",
          edgeLabelBackground: "#f4f0e8",
          fontFamily: "IBM Plex Sans, sans-serif",
          fontSize: "14px"
        };

  onMount(() => {
    let live = true;

    const render = async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        if (!live) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          flowchart: { curve: "basis", htmlLabels: true, useMaxWidth: true },
          sequence: { useMaxWidth: true, actorMargin: 48, messageMargin: 30 },
          themeVariables: themeVariables(palette)
        });
        const id = `icarus-diagram-${crypto.randomUUID().replaceAll("-", "")}`;
        const rendered = await mermaid.render(id, source);
        if (!live) return;
        host.innerHTML = rendered.svg;
        rendered.bindFunctions?.(host);
        status = "ready";
      } catch (error) {
        if (!live) return;
        status = "error";
        failure = error instanceof Error ? error.message : "The diagram could not be rendered.";
      }
    };

    void render();
    return () => {
      live = false;
    };
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

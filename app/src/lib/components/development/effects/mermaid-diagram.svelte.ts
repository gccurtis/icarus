import { onMount } from "svelte";

export type MermaidPalette = "adaptive" | "paper" | "night";

const activePalette = (palette: MermaidPalette): "paper" | "night" =>
  palette === "adaptive"
    ? document.documentElement.dataset.appearance === "selene"
      ? "night"
      : "paper"
    : palette;

const themeVariables = (selected: MermaidPalette) =>
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

/** Mounts, rerenders on appearance changes, and releases one Mermaid diagram. */
export const mountMermaidDiagram = ({
  host,
  source,
  palette,
  serialize,
  loading,
  ready,
  failed
}: {
  host: () => HTMLDivElement;
  source: () => string;
  palette: () => MermaidPalette;
  serialize: <T>(work: () => Promise<T>) => Promise<T>;
  loading: () => void;
  ready: () => void;
  failed: (message: string) => void;
}): void => {
  onMount(() => {
    let live = true;
    let turn = 0;

    const render = async (): Promise<void> => {
      const rendering = ++turn;
      loading();
      try {
        const rendered = await serialize(async () => {
          const { default: mermaid } = await import("mermaid");
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            flowchart: { curve: "basis", htmlLabels: true, useMaxWidth: true },
            sequence: { useMaxWidth: true, actorMargin: 48, messageMargin: 30 },
            themeVariables: themeVariables(activePalette(palette()))
          });
          const id = `icarus-diagram-${crypto.randomUUID().replaceAll("-", "")}`;
          return mermaid.render(id, source());
        });
        if (!live || rendering !== turn) return;
        host().innerHTML = rendered.svg;
        rendered.bindFunctions?.(host());
        ready();
      } catch (error) {
        if (!live || rendering !== turn) return;
        failed(error instanceof Error ? error.message : "The diagram could not be rendered.");
      }
    };

    const observer = new MutationObserver(() => {
      if (palette() === "adaptive") void render();
    });
    if (palette() === "adaptive") {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-appearance"]
      });
    }
    void render();
    return () => {
      live = false;
      turn += 1;
      observer.disconnect();
    };
  });
};

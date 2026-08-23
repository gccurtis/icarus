<script lang="ts">
  import type { ChartTextElement } from "$json-store/types/data/chart";
  import type {
    ChartSelection,
    ChartSelectionTarget
  } from "$lib/unique-components/chart/chart-selection.svelte";

  let {
    chartId,
    elements,
    selection,
    width,
    height
  }: {
    chartId: string;
    elements: readonly ChartTextElement[];
    selection: ChartSelection;
    width: number;
    height: number;
  } = $props();

  const targetFor = (elementId: string): ChartSelectionTarget => ({
    kind: "element",
    chartId,
    elementId
  });
  const additive = (event: MouseEvent | KeyboardEvent) =>
    event.shiftKey || event.metaKey || event.ctrlKey;
</script>

{#each elements as element (element.id)}
  {@const target = targetFor(element.id)}
  {@const chosen = selection.has(target)}
  <text
    x={element.position.x * width}
    y={element.position.y * height}
    role="button"
    tabindex="0"
    aria-pressed={chosen}
    class={chosen
      ? "fill-active-text cursor-pointer font-semibold"
      : "fill-ink-primary cursor-pointer"}
    font-size="13"
    onclick={(event) => {
      event.stopPropagation();
      selection.click(target, additive(event));
    }}
    onkeydown={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selection.click(target, additive(event));
    }}
  >{element.text}</text>
{/each}

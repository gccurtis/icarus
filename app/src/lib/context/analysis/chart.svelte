<script lang="ts">
  import ChartArea from "@lucide/svelte/icons/chart-area";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChartLine from "@lucide/svelte/icons/chart-line";
  import ChartPie from "@lucide/svelte/icons/chart-pie";
  import ChartScatter from "@lucide/svelte/icons/chart-scatter";
  import TableIcon from "@lucide/svelte/icons/table";

  import {
    Panel,
    PanelCards,
    PanelField,
    PanelFields,
    PanelNote,
    PanelThumb
  } from "$lib/unique-components/panel";
  import { chartFor, chartKinds } from "$mock-capabilities/analysis";
  import type { ChartKindId } from "$mock-capabilities/analysis";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * What kind of picture to draw.
   *
   * `docs/screen-panel-views/context/analysis/chart.md` is the specification.
   * One band, the kinds, so the panel's title is the only heading it needs — a
   * collapsible section holding the whole of a panel is a disclosure over
   * nothing.
   *
   * **The chosen kind is local.** There is no door that writes the chart
   * definition, so picking one moves the choice and opens the chart lens, which
   * is where the rest of the drawing — title, axes, legend, colour — is decided.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const kinds = $derived(chartKinds().current);
  const display = $derived(chartFor(analysisId).current);

  let picked = $state<ChartKindId | undefined>(undefined);
  const chosen = $derived(picked ?? display.kind);

  const current = $derived(kinds.find((kind) => kind.id === chosen));

  /** The shape each kind draws, so the card is picked by its picture and not by its word. */
  const SHAPE = {
    table: TableIcon,
    bar: ChartColumn,
    line: ChartLine,
    area: ChartArea,
    scatter: ChartScatter,
    bubble: ChartScatter,
    pie: ChartPie,
    waterfall: ChartColumn,
    mekko: ChartColumn,
    funnel: ChartPie,
    radar: ChartArea,
    heatmap: ChartColumn,
    treemap: ChartColumn
  };

  const choose = (next: ChartKindId) => {
    picked = next;
    mockWorkbench.inspect("analysis.chart", { kind: "chart", id: analysisId });
  };
</script>

<Panel title="Chart">
  <PanelCards label="Chart kind">
    {#each kinds as kind (kind.id)}
      {@const Shape = SHAPE[kind.id]}
      <PanelThumb caption={kind.name} selected={kind.id === chosen} onselect={() => choose(kind.id)}>
        <span
          class="border-border-subtle bg-surface-canvas rounded-control text-ink-secondary flex w-full items-center justify-center border"
          style="aspect-ratio: 4 / 3"
          aria-hidden="true"
        >
          <Shape size={18} />
        </span>
      </PanelThumb>
    {/each}
  </PanelCards>

  {#if current}
    <PanelFields>
      <PanelField label="Draws with" stacked>{current.needs}</PanelField>
    </PanelFields>
  {/if}

  <PanelNote>
    Picking a kind that needs another field opens an empty zone for it in Fields rather than
    failing — the screen asks for what is missing instead of refusing.
  </PanelNote>

  <PanelNote tone="gap">
    The minimum-field rule per kind is undefined. Without it an empty zone cannot appear only when
    it is genuinely needed, so either every zone is always shown or none is.
  </PanelNote>
</Panel>

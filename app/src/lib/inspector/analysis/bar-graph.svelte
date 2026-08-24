<script lang="ts">
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import {
    Panel,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelSelect,
    PanelStat,
    PanelStats,
    PanelSwatch,
    PanelSwatches,
    PanelToggle
  } from "$lib/unique-components/panel";
  import {
    analysis,
    chartFor,
    chartKinds,
    lastRunOf,
    placementsOn,
    resultFor
  } from "$mock-capabilities/analysis";
  import type { LegendPosition } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * The bar chart as a whole: how a number becomes a height, and which bar is
   * which colour.
   *
   * **This is the bar chart, not the chart.** `analysis.chart` decides which kind
   * is drawn at all and what the axes are called; this lens is only reached when
   * bars are on screen, and everything in it is about the bars.
   *
   * **Zero-basing is a claim, not a formatting preference.** A Y axis that starts
   * at 400,000 draws a bar twice the height of another whose value is a fifth
   * larger, so it sits at the top of Scale with the reading beside it rather than
   * behind a disclosure.
   *
   * **Colours are role tokens.** A chart pasted into a deck comes out in the
   * deck's palette instead of carrying four literal colours from another
   * document, which is why the swatches show token names.
   */
  let { analysisId }: { analysisId?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(
    analysisId ?? (chosen?.kind === "analysis" ? chosen.id : undefined) ?? "r-minutes"
  );

  const record = $derived(analysis(id).current);
  const display = $derived(chartFor(id).current);
  const kinds = $derived(chartKinds().current);
  const result = $derived(resultFor(id).current);
  const run = $derived(lastRunOf(id).current);
  const across = $derived(placementsOn(id, "x").current);
  const series = $derived(placementsOn(id, "y").current);

  const number = (count: number) => count.toLocaleString("en-GB");

  const needs = $derived(kinds.find((one) => one.id === "bar")?.needs ?? "");

  /** The measure columns, in the order the result gives them: one series each. */
  const measures = $derived(result.columns.filter((column) => column.role === "measure"));

  /** One bar per group per measure — the number a reader is actually looking at. */
  const bars = $derived(result.rows.length * measures.length);

  const values = $derived(result.rows.flatMap((row) => row.values));
  const tallest = $derived(values.length === 0 ? 0 : Math.max(...values));

  /** The edits, until there is a definition to write them to. */
  let restacked = $state<boolean | undefined>(undefined);
  let rebased = $state<boolean | undefined>(undefined);
  let relegended = $state<LegendPosition | undefined>(undefined);

  const stacked = $derived(restacked ?? display.stacked);
  const zeroBased = $derived(rebased ?? display.zeroBased);
  const legend = $derived(relegended ?? display.legend);

  const LEGENDS = [
    { value: "None", label: "None" },
    { value: "Right", label: "Right" },
    { value: "Bottom", label: "Bottom" }
  ] as const;

  /** Neither is a persisted property. They work, and the gap note says where they go. */
  let orientation = $state("Upright");
  let gap = $state("Comfortable");

  const ORIENTATIONS = [
    { value: "Upright", label: "Upright" },
    { value: "On its side", label: "On its side" }
  ] as const;

  const GAPS = [
    { value: "Tight", label: "Tight" },
    { value: "Comfortable", label: "Comfortable" },
    { value: "Wide", label: "Wide" }
  ] as const;

  /** Series take the palette in order, which is what the legend is reading. */
  const colourOf = (index: number) => display.colours[index % display.colours.length];

  /** Stacking two measures with different units adds customer-minutes to event counts. */
  const comparable = $derived(
    series.length < 2 || series.every((one) => one.aggregation === series[0].aggregation)
  );
</script>

<Panel title="Bar chart">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: "Bar chart" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Chart settings"
      icon={SquareArrowOutUpRight}
      onclick={() => view.inspect("analysis.chart", { kind: "analysis", id })}
    />
  {/snippet}

  <PanelStats label="Shape">
    <PanelStat value={number(bars)} label="bars" />
    <PanelStat value={number(measures.length)} label="series" />
    <PanelStat value={number(result.rows.length)} label="groups" />
  </PanelStats>

  <PanelFields>
    <PanelField label="Across">{across[0]?.reads ?? "Nothing on X"}</PanelField>
    <PanelField label="Tallest" mono>{number(tallest)}</PanelField>
    <PanelField label="Evaluated">{run.ran} · {run.duration}</PanelField>
  </PanelFields>

  <PanelSection title="Scale">
    <PanelToggle
      label="Y starts at zero"
      checked={zeroBased}
      onchange={(next: boolean) => (rebased = next)}
    />
    {#if zeroBased}
      <PanelNote>Bar heights are proportional to their values, so they can be compared.</PanelNote>
    {:else}
      <!-- The reason this is a band rather than a checkbox in a list of formatting. -->
      <PanelNote>
        The axis starts above zero, so a bar twice the height of another is not twice the value.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Bars">
    <PanelToggle
      label="Stacked"
      checked={stacked}
      disabled={measures.length < 2}
      onchange={(next: boolean) => (restacked = next)}
    />
    {#if measures.length < 2}
      <PanelNote>One series has nothing to stack against.</PanelNote>
    {:else if stacked && !comparable}
      <PanelNote>
        These two series are summarised differently. Stacked, the chart adds {series[0]?.reads} to {series[1]?.reads},
        and the total means nothing.
      </PanelNote>
    {/if}
    <PanelChoice
      label="Orientation"
      value={orientation}
      options={ORIENTATIONS}
      onchange={(next: string) => (orientation = next)}
    />
    <PanelChoice
      label="Spacing"
      value={gap}
      options={GAPS}
      onchange={(next: string) => (gap = next)}
    />
    <PanelNote tone="gap">
      Orientation and spacing have nowhere to live. A chart carries a kind, a title, two labels,
      zero-basing, stacking, a legend position and a palette — and nothing else.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Series" count={series.length} flush>
    {#each series as one, index (one.id)}
      <PanelRow
        title={one.label}
        sub={one.reads}
        meta={colourOf(index).name}
        onselect={() => view.inspect("analysis.placement", { kind: "placement", id: one.id })}
      />
    {/each}
    <PanelSwatches label="Series colours" layout="column">
      {#each series as one, index (one.id)}
        <PanelSwatch
          name={one.label}
          color="var({colourOf(index).token})"
          value={colourOf(index).token}
        />
      {/each}
    </PanelSwatches>
    <PanelNote>
      Role tokens rather than values, so a chart pasted into a deck comes out in that deck's
      palette.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Legend" open={false}>
    <PanelFields>
      <PanelField label="Position" stacked>
        <PanelSelect
          label="Legend position"
          value={legend}
          options={LEGENDS}
          onchange={(next: string) => (relegended = next as LegendPosition)}
        />
      </PanelField>
    </PanelFields>
    {#if legend === "None" && measures.length > 1}
      <PanelNote>Two series and no legend: nothing on the chart says which colour is which.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="What a bar chart needs" open={false}>
    <PanelNote>{needs}</PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>

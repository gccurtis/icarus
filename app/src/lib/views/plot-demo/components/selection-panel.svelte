<script lang="ts">
  import type { ChartModel } from "$json-store/types/data/chart";
  import {
    chartAxes,
    chartTargetKey,
    formatChartValue,
    type ChartSelection,
    type ChartSelectionTarget
  } from "$lib/unique-components/chart";
  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";

  let { selection, chart }: { selection: ChartSelection; chart: ChartModel } = $props();

  const datumDetails = (target: Extract<ChartSelectionTarget, { kind: "datum" }>) => {
    const datum = chart.data.datums.find((entry) => entry.id === target.datumId);
    const category = chart.data.categories.find((entry) => entry.id === target.categoryId);
    const series = chart.data.series.find((entry) => entry.id === target.seriesId);
    return {
      target,
      title: `${category?.label ?? target.categoryId} · ${series?.label ?? target.seriesId}`,
      value: datum?.value ?? 0
    };
  };

  const chosenDatums = $derived(
    selection.targets
      .filter(
        (target): target is Extract<ChartSelectionTarget, { kind: "datum" }> =>
          target.kind === "datum"
      )
      .map(datumDetails)
  );
  const sum = $derived(chosenDatums.reduce((total, entry) => total + entry.value, 0));
  const one = $derived(selection.targets[0]);
  const SHAPE: Record<string, string> = {
    none: "Nothing",
    one: "One chart part",
    category: "A whole category",
    series: "A whole series",
    axis: "One axis",
    element: "One added element",
    many: "Several chart parts"
  };

  const describe = (target: ChartSelectionTarget) => {
    if (target.kind === "datum") return datumDetails(target).title;
    if (target.kind === "axis") {
      const axis = chartAxes(chart).find((entry) => entry.id === target.axisId);
      return axis === undefined
        ? target.axisId
        : axis.title ?? `${axis.kind[0].toUpperCase()}${axis.kind.slice(1)} axis`;
    }
    if (target.kind === "element") {
      const element = chart.elements.find((entry) => entry.id === target.elementId);
      return element?.kind === "cagr-line"
        ? "CAGR line"
        : element?.kind === "trend-line"
          ? "Trend line"
        : element?.kind === "axis-line"
          ? "Axis line"
          : "Text annotation";
    }
    return target.kind;
  };
</script>

<Panel title={selection.isEmpty ? "Nothing selected" : SHAPE[selection.shape]}>
  {#if !selection.isEmpty}
    {#snippet actions()}
      <PanelButton label="Clear" onclick={() => selection.clear()} />
    {/snippet}
  {/if}

  {#if selection.isEmpty}
    <PanelNote>
      Click a mark, axis, or annotation. Shift-click adds another target; category labels and
      legend entries select semantic groups.
    </PanelNote>
  {:else}
    <PanelSection title="What is selected" count={selection.count}>
      <PanelFields>
        <PanelField label="Shape"><PanelChip tone="active">{SHAPE[selection.shape]}</PanelChip></PanelField>
        {#if selection.count === 1 && one}
          <PanelField label="Part">{describe(one)}</PanelField>
          <PanelField label="Stable id" mono>
            {one.kind === "datum"
              ? one.datumId
              : one.kind === "axis"
                ? one.axisId
                : one.kind === "element"
                  ? one.elementId
                  : one.chartId}
          </PanelField>
          {#if one.kind === "datum"}
            <PanelField label="Value" mono>
              {formatChartValue(datumDetails(one).value, chart.valueFormat)}
            </PanelField>
          {/if}
        {:else if chosenDatums.length > 0}
          <PanelField label="Data marks" mono>{chosenDatums.length}</PanelField>
          <PanelField label="Sum" mono>{formatChartValue(sum, chart.valueFormat)}</PanelField>
        {/if}
      </PanelFields>
    </PanelSection>

    {#if selection.count > 1}
      <PanelSection title="Each target" count={selection.count} flush>
        {#each selection.targets as target (chartTargetKey(target))}
          <PanelRow title={describe(target)} meta={target.kind} onselect={() => selection.click(target)} />
        {/each}
      </PanelSection>
    {/if}

    <PanelNote tone="gap">
      This panel receives semantic targets, not DOM nodes or array positions. The same target can
      drive formatting, comments, revisions, and an inspector after the chart is redrawn.
    </PanelNote>
  {/if}
</Panel>

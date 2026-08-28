<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";

  import ChartStage from "$views/development/analysis-demo/components/chart-stage.svelte";
  import DataTable from "$views/development/analysis-demo/components/data-table.svelte";
  import { ChartColors, copyChart } from "$components/authored/chart";
  import { PanelChoice, PanelNote } from "$components/authored/panel";
  import {
    ScreenAction,
    ScreenGroup,
    ScreenHeader,
    ScreenNote,
    ScreenSurface
  } from "$components/authored/screen";

  /**
   * The Analysis workspace, working.
   *
   * Everything on this page is connected: the table is the data, the chart is
   * that data, and changing a number changes the picture while you are looking
   * at it. That is the whole point of building it rather than drawing it — a
   * chart component is judged on what it does when the numbers move, and no
   * screenshot can show that.
   *
   * **The data is here rather than fetched.** There is no capability that can
   * answer "the rows behind this analysis" yet, so this holds its own array and
   * says so. What is being evaluated is the chart, the switching and the copy —
   * none of which get more true with a server behind them.
   */
  /**
   * Customer-minutes lost, split by cause.
   *
   * Three series in the same unit and of comparable size, which is not a
   * cosmetic choice: stacked, 100% and Marimekko all mean something only when
   * the series add up to a whole. The first version of this page plotted
   * outages, minutes and spend on one axis — three units, magnitudes two orders
   * apart — and two of the three were a flat line against the third. A chart
   * demo whose data cannot be stacked cannot show what stacking does.
   */
  type Row = { region: string; storm: number; equipment: number; planned: number };

  let rows = $state<Row[]>([
    { region: "Eastbrook", storm: 1180, equipment: 460, planned: 202 },
    { region: "Harlow", storm: 610, equipment: 380, planned: 200 },
    { region: "Ward 3", storm: 402, equipment: 338, planned: 200 },
    { region: "Millbrook", storm: 250, equipment: 220, planned: 150 },
    { region: "Deering", storm: 140, equipment: 130, planned: 110 }
  ]);

  const total = (row: Row) => row.storm + row.equipment + row.planned;

  let kind = $state("bar");
  let layout = $state("stack");
  let orientation = $state("vertical");
  let labels = $state("none");
  let sort = $state("total-desc");
  let threshold = $state(0);

  /**
   * Filter, then sort, then derive. The order matters: sorting before filtering
   * wastes the comparison, and deriving the total before filtering means the
   * threshold is read against a number the chart is not drawing.
   */
  const shown = $derived.by(() => {
    const kept = rows
      .filter((row) => total(row) >= threshold)
      .map((row) => ({ ...row, total: total(row) }));

    return [...kept].sort((a, b) => {
      if (sort === "name") return a.region.localeCompare(b.region);
      if (sort === "total-asc") return a.total - b.total;
      if (sort === "storm-desc") return b.storm - a.storm;
      return b.total - a.total;
    });
  });

  const CAUSES = [
    { key: "storm", label: "Storm" },
    { key: "equipment", label: "Equipment" },
    { key: "planned", label: "Planned" }
  ];

  /** Overrides by series key; anything absent falls back to the role tokens. */
  let colors = $state<Record<string, string>>({});
  let hovered = $state<string | undefined>(undefined);

  const SERIES = $derived(
    CAUSES.map((cause) => ({ ...cause, color: colors[cause.key] }))
  );

  let svg = $state<SVGSVGElement | null>(null);
  let copied = $state<string | undefined>(undefined);

  const copy = async () => {
    if (!svg) {
      copied = "no chart to copy yet";
      return;
    }
    const failure = await copyChart(svg);
    copied = failure ?? "Copied — paste it anywhere that takes an image.";
  };
</script>

<svelte:head>
  <title>Analysis — Icarus</title>
</svelte:head>

<ScreenSurface wide>
  <a href="/demo/vocabulary" class="text-caption text-interactive-text w-fit hover:underline">
    ← Composition vocabulary
  </a>

  <ScreenHeader
    title="Customer-minutes lost, by region and cause"
    about="The table below is the data. Change a number, or the chart kind, and the picture follows — nothing here is a screenshot."
  >
    {#snippet actions()}
      <ScreenAction label="Copy as image" icon={Copy} onclick={copy} />
    {/snippet}
  </ScreenHeader>

  {#if copied}
    <ScreenNote>{copied}</ScreenNote>
  {/if}

  <ScreenGroup label="Chart">
    {#snippet actions()}
      <ChartColors series={CAUSES} bind:colors onreset={() => (colors = {})} />
    {/snippet}
    <ChartStage
      bind:svg
      bind:hovered
      {kind}
      {layout}
      {orientation}
      {labels}
      data={shown}
      series={kind === "pie" ? [SERIES[0]] : SERIES}
      growth={orientation === "vertical" && kind !== "pie"}
      categories={shown.map((row) => row.region)}
      totals={shown.map((row) => row.total)}
    />
  </ScreenGroup>

  <ScreenGroup label="How it is drawn">
    <div class="flex flex-wrap items-start gap-6">
      <div class="flex flex-col gap-1">
        <span class="text-caption text-ink-muted">Kind</span>
        <PanelChoice
          label="Chart kind"
          value={kind}
          options={[
            { value: "bar", label: "Bar" },
            { value: "line", label: "Line" },
            { value: "area", label: "Area" },
            { value: "scatter", label: "Scatter" },
            { value: "pie", label: "Pie" },
            { value: "mixed", label: "Mixed" },
            { value: "mekko", label: "Marimekko" }
          ]}
          onchange={(next) => (kind = next)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-caption text-ink-muted">Series together</span>
        <PanelChoice
          label="How series share the space"
          value={layout}
          options={[
            { value: "group", label: "Clustered" },
            { value: "stack", label: "Stacked" },
            { value: "stackExpand", label: "100%" },
            { value: "overlap", label: "Overlaid" }
          ]}
          onchange={(next) => (layout = next)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-caption text-ink-muted">Orientation</span>
        <PanelChoice
          label="Orientation"
          value={orientation}
          options={[
            { value: "vertical", label: "Vertical" },
            { value: "horizontal", label: "Horizontal" }
          ]}
          onchange={(next) => (orientation = next)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-caption text-ink-muted">Figures</span>
        <PanelChoice
          label="Figures on the bars"
          value={labels}
          options={[
            { value: "none", label: "None" },
            { value: "value", label: "Each value" },
            { value: "total", label: "Total above" }
          ]}
          onchange={(next) => (labels = next)}
        />
      </div>

      <div class="flex flex-col gap-1">
        <span class="text-caption text-ink-muted">Order</span>
        <PanelChoice
          label="Order"
          value={sort}
          options={[
            { value: "total-desc", label: "Largest first" },
            { value: "total-asc", label: "Smallest first" },
            { value: "storm-desc", label: "Most storm" },
            { value: "name", label: "Name" }
          ]}
          onchange={(next) => (sort = next)}
        />
      </div>
    </div>

    <PanelNote>
      Clustered, stacked and 100% apply to bars and areas. A line, a scatter and
      a pie ignore them rather than pretending — a control that silently does
      nothing is worse than one that is visibly not for this. Figures on bars and
      the growth strip are for bars; the strip only reads along the category
      axis, so it is absent when the chart is horizontal.
    </PanelNote>
  </ScreenGroup>

  <ScreenGroup label="The data" count={`${shown.length} of ${rows.length}`}>
    <DataTable bind:rows bind:threshold bind:hovered hidden={rows.length - shown.length} />
  </ScreenGroup>

  <ScreenNote meta={`${shown.length} of ${rows.length} regions`}>
    Generated from the table above — the result itself is not stored. Series
    colours come from the role tokens rather than from the chart library, so this
    follows a theme swap; the copy bakes them in at the moment you press it.
  </ScreenNote>
</ScreenSurface>

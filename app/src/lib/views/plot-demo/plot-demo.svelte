<script lang="ts">
  import SelectionPanel from "$views/plot-demo/components/selection-panel.svelte";
  import {
    addAxisLine,
    addCagrLine,
    addChartText,
    addTrendLine,
    capabilitiesFor,
    ChartElement,
    createAreaChart,
    createBarChart,
    createBubbleChart,
    createChartSelection,
    createFunnelChart,
    createHeatmapChart,
    createLineChart,
    createMekkoChart,
    createPieChart,
    createRadarChart,
    createScatterChart,
    createTreemapChart,
    createWaterfallChart,
    removeChartElements,
    setChartDatumStyle,
    type ChartFrame,
    type ChartIdIssuer,
    type ChartModel,
    type ChartType
  } from "$lib/unique-components/chart";
  import { PanelButton, PanelChoice, PanelNote } from "$lib/unique-components/panel";
  import { ScreenGroup, ScreenNote, ScreenSurface } from "$lib/unique-components/screen";

  const CATEGORIES = [
    { id: "category-2021", key: "2021", label: "2021" },
    { id: "category-2022", key: "2022", label: "2022" },
    { id: "category-2023", key: "2023", label: "2023" },
    { id: "category-2024", key: "2024", label: "2024" },
    { id: "category-2025", key: "2025", label: "2025" }
  ] as const;

  const SERIES = [
    { id: "series-revenue", key: "revenue", label: "Revenue" },
    { id: "series-services", key: "services", label: "Services" },
    { id: "series-planned", key: "planned", label: "Planned" }
  ] as const;

  const ROWS = [
    [620, 230, 120],
    [710, 270, 140],
    [860, 310, 160],
    [990, 360, 190],
    [1180, 420, 220]
  ] as const;

  const TYPE_OPTIONS: { value: ChartType; label: string }[] = [
    { value: "bar", label: "Bar" },
    { value: "pie", label: "Pie / doughnut" },
    { value: "line", label: "Line" },
    { value: "area", label: "Area" },
    { value: "scatter", label: "Scatter" },
    { value: "bubble", label: "Bubble" },
    { value: "waterfall", label: "Waterfall" },
    { value: "mekko", label: "Mekko" },
    { value: "funnel", label: "Funnel" },
    { value: "radar", label: "Radar" },
    { value: "heatmap", label: "Heatmap" },
    { value: "treemap", label: "Treemap" }
  ];

  let sequence = 0;
  const demoId: ChartIdIssuer = (kind) => `demo-${kind}-${++sequence}`;
  const categoricalValues = CATEGORIES.flatMap((category, categoryIndex) =>
    SERIES.map((series, seriesIndex) => ({
      id: `datum-${category.key}-${series.key}`,
      categoryKey: category.key,
      seriesKey: series.key,
      value: ROWS[categoryIndex][seriesIndex]
    }))
  );
  const categoryData = {
    categories: CATEGORIES,
    series: SERIES,
    values: categoricalValues
  };
  const singleSeriesData = {
    categories: CATEGORIES,
    series: [{ id: "series-total", key: "total", label: "Operating value" }],
    values: CATEGORIES.map((category, index) => ({
      id: `datum-${category.key}-total`,
      categoryKey: category.key,
      seriesKey: "total",
      value: ROWS[index].reduce((sum, value) => sum + value, 0)
    }))
  };
  const pointData = {
    categories: CATEGORIES.map((entry, index) => ({ ...entry, label: `Business ${index + 1}` })),
    series: SERIES.slice(0, 2),
    values: CATEGORIES.flatMap((category, categoryIndex) =>
      SERIES.slice(0, 2).map((series, seriesIndex) => ({
        id: `point-${category.key}-${series.key}`,
        categoryKey: category.key,
        seriesKey: series.key,
        x: 18 + categoryIndex * 13 + seriesIndex * 5,
        value: 22 + categoryIndex * 17 + seriesIndex * 12,
        size: 30 + categoryIndex * 25 + seriesIndex * 18,
        label: `${category.label} · ${series.label}`
      }))
    )
  };

  const makeChart = (type: ChartType): ChartModel => {
    switch (type) {
      case "bar":
        return createBarChart(
          {
            id: "chart-operating-value-bar",
            title: "Operating value by year",
            data: categoryData,
            layout: "stack",
            labels: "value",
            valueFormat: { style: "number", compact: true, maximumFractionDigits: 1 }
          },
          demoId
        );
      case "pie":
        return createPieChart(
          {
            id: "chart-operating-value-pie",
            title: "Operating value contribution",
            data: singleSeriesData,
            labels: "percent",
            innerRadius: 0.25,
            legend: { visible: true, position: "end" }
          },
          demoId
        );
      case "line":
        return createLineChart(
          {
            id: "chart-operating-value-line",
            title: "Operating value trajectory",
            data: categoryData,
            curve: "smooth",
            points: "all",
            valueFormat: { style: "number", compact: true, maximumFractionDigits: 1 }
          },
          demoId
        );
      case "area":
        return createAreaChart(
          {
            id: "chart-operating-value-area",
            title: "Operating value composition",
            data: categoryData,
            layout: "stack",
            curve: "smooth",
            valueFormat: { style: "number", compact: true, maximumFractionDigits: 1 }
          },
          demoId
        );
      case "scatter":
        return createScatterChart(
          {
            id: "chart-return-scatter",
            title: "Scale versus return",
            data: pointData,
            labels: "custom",
            axes: { x: { title: "Scale" }, y: { title: "Return" } }
          },
          demoId
        );
      case "bubble":
        return createBubbleChart(
          {
            id: "chart-return-bubble",
            title: "Scale, return, and investment",
            data: pointData,
            labels: "category",
            axes: { x: { title: "Scale" }, y: { title: "Return" } }
          },
          demoId
        );
      case "waterfall": {
        const categories = [
          { id: "category-start", key: "start", label: "2024" },
          { id: "category-price", key: "price", label: "Price" },
          { id: "category-volume", key: "volume", label: "Volume" },
          { id: "category-cost", key: "cost", label: "Cost" },
          { id: "category-end", key: "end", label: "2025" }
        ];
        return createWaterfallChart(
          {
            id: "chart-ebitda-waterfall",
            title: "EBITDA bridge",
            data: {
              categories,
              series: [{ id: "series-change", key: "change", label: "Change" }],
              values: [900, 120, 80, -140, 960].map((value, index) => ({
                id: `waterfall-${categories[index].key}`,
                categoryKey: categories[index].key,
                seriesKey: "change",
                value
              }))
            },
            totals: ["category-start", "category-end"],
            valueFormat: { style: "currency", currency: "USD", compact: true }
          },
          demoId
        );
      }
      case "mekko":
        return createMekkoChart(
          {
            id: "chart-market-mekko",
            title: "Market share of segment",
            data: categoryData,
            widths: { kind: "total" },
            labels: "percent"
          },
          demoId
        );
      case "funnel": {
        const categories = [
          { id: "category-leads", key: "leads", label: "Leads" },
          { id: "category-qualified", key: "qualified", label: "Qualified" },
          { id: "category-proposals", key: "proposals", label: "Proposals" },
          { id: "category-wins", key: "wins", label: "Wins" }
        ];
        return createFunnelChart(
          {
            id: "chart-sales-funnel",
            title: "Commercial funnel",
            data: {
              categories,
              series: [{ id: "series-count", key: "count", label: "Opportunities" }],
              values: [1000, 610, 280, 125].map((value, index) => ({
                id: `funnel-${categories[index].key}`,
                categoryKey: categories[index].key,
                seriesKey: "count",
                value
              }))
            },
            labels: "percent"
          },
          demoId
        );
      }
      case "radar":
        return createRadarChart(
          {
            id: "chart-capability-radar",
            title: "Capability profile",
            data: categoryData,
            labels: "none",
            valueFormat: { style: "number", compact: true }
          },
          demoId
        );
      case "heatmap":
        return createHeatmapChart(
          {
            id: "chart-performance-heatmap",
            title: "Performance matrix",
            data: categoryData,
            labels: "value",
            valueFormat: { style: "number", compact: true }
          },
          demoId
        );
      case "treemap":
        return createTreemapChart(
          {
            id: "chart-portfolio-treemap",
            title: "Portfolio contribution",
            data: singleSeriesData,
            labels: "category"
          },
          demoId
        );
    }
  };

  let chart = $state<ChartModel>(makeChart("bar"));
  let frame = $state<ChartFrame>({ x: 20, y: 18, width: 720, height: 350 });
  let canvasWidth = $state(900);
  let selected = $state(true);
  const selection = createChartSelection();
  const offered = $derived(capabilitiesFor(chart.type));
  const selectedDatumIds = $derived(
    selection.targets.flatMap((target) => (target.kind === "datum" ? [target.datumId] : []))
  );
  const selectedElementIds = $derived(
    selection.targets.flatMap((target) => (target.kind === "element" ? [target.elementId] : []))
  );

  const chooseType = (type: ChartType) => {
    selection.clear();
    chart = makeChart(type);
  };

  const addCagr = () => {
    if (chart.type !== "bar" && chart.type !== "line" && chart.type !== "area") return;
    chart = addCagrLine(
      chart,
      {
        seriesId: "series-revenue",
        fromCategoryId: "category-2021",
        toCategoryId: "category-2025",
        periods: 4,
        label: "Revenue growth",
        showRate: true
      },
      demoId
    );
  };

  const addReference = () => {
    let axisId: string;
    let value: number;
    switch (chart.type) {
      case "bar":
      case "line":
      case "area":
        axisId = chart.axes.value.id;
        value = 1000;
        break;
      case "waterfall":
        axisId = chart.axes.value.id;
        value = 900;
        break;
      case "mekko":
        axisId = chart.axes.value.id;
        value = 0.5;
        break;
      case "scatter":
      case "bubble":
        axisId = chart.axes.y.id;
        value = 75;
        break;
      default:
        return;
    }
    chart = addAxisLine(
      chart,
      { axisId, position: { kind: "value", value }, label: "Review threshold" },
      demoId
    );
  };

  const addTrend = () => {
    if (chart.type !== "scatter" && chart.type !== "bubble") return;
    chart = addTrendLine(
      chart,
      {
        seriesId: "series-revenue",
        showEquation: true,
        showRSquared: true,
        label: "Revenue trend"
      },
      demoId
    );
  };

  const addText = () => {
    chart = addChartText(
      chart,
      { text: "Review with operations", position: { x: 0.7, y: 0.12 } },
      demoId
    );
  };

  const highlightSelection = () => {
    chart = setChartDatumStyle(chart, selectedDatumIds, {
      color: "var(--token-color-accent-1-fill)",
      opacity: 0.85
    });
  };

  const deleteSelectedElements = () => {
    chart = removeChartElements(chart, selectedElementIds);
    selection.prune(chart);
  };
</script>

<svelte:head>
  <title>Native chart system — Icarus</title>
</svelte:head>

<div class="flex h-full min-h-0">
  <ScreenSurface wide class="flex-1">
    <h1 class="text-h3 leading-h3 m-0 font-semibold tracking-tight">Native chart system</h1>
    <p class="text-body-sm text-ink-muted m-0 max-w-prose">
      Twelve chart types share one persisted identity and interaction system. Drag the title strip
      or resize from the lower-right corner, then select marks, axes, legends, and generated
      elements without changing the frame.
    </p>

    <ScreenGroup label="Interactive chart object">
      <div
        class="chart-canvas bg-surface-canvas border-border-subtle rounded-panel relative h-105 overflow-hidden border"
        bind:clientWidth={canvasWidth}
        onclick={(event) => {
          if (event.target === event.currentTarget) selected = false;
        }}
        role="presentation"
      >
        <ChartElement
          {chart}
          bind:frame
          bind:selected
          {selection}
          bounds={{ width: canvasWidth, height: 420 }}
        />
      </div>
    </ScreenGroup>

    <ScreenGroup label="Chart model">
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-caption text-ink-muted">Type</span>
          <PanelChoice
            label="Chart type"
            value={chart.type}
            options={TYPE_OPTIONS}
            onchange={(next) => chooseType(next as ChartType)}
          />
        </div>

        {#if chart.type === "bar"}
          <div class="flex flex-col gap-1">
            <span class="text-caption text-ink-muted">Series together</span>
            <PanelChoice
              label="Bar layout"
              value={chart.layout}
              options={[
                { value: "stack", label: "Stacked" },
                { value: "group", label: "Clustered" },
                { value: "expand", label: "100%" },
                { value: "overlap", label: "Overlaid" }
              ]}
              onchange={(next) => {
                if (chart.type === "bar") chart = { ...chart, layout: next as typeof chart.layout };
              }}
            />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-caption text-ink-muted">Orientation</span>
            <PanelChoice
              label="Bar orientation"
              value={chart.orientation}
              options={[
                { value: "vertical", label: "Vertical" },
                { value: "horizontal", label: "Horizontal" }
              ]}
              onchange={(next) => {
                if (chart.type === "bar") {
                  chart = { ...chart, orientation: next as typeof chart.orientation };
                }
              }}
            />
          </div>
        {:else if chart.type === "area"}
          <div class="flex flex-col gap-1">
            <span class="text-caption text-ink-muted">Areas together</span>
            <PanelChoice
              label="Area layout"
              value={chart.layout}
              options={[
                { value: "overlap", label: "Overlaid" },
                { value: "stack", label: "Stacked" },
                { value: "expand", label: "100%" }
              ]}
              onchange={(next) => {
                if (chart.type === "area") chart = { ...chart, layout: next as typeof chart.layout };
              }}
            />
          </div>
        {/if}
      </div>

      <div class="flex flex-wrap gap-2">
        {#if offered.addableElements.includes("cagr-line")}
          <PanelButton label="Add generated CAGR" onclick={addCagr} />
        {/if}
        {#if offered.addableElements.includes("trend-line")}
          <PanelButton label="Add linear trend" onclick={addTrend} />
        {/if}
        {#if offered.addableElements.includes("axis-line")}
          <PanelButton label="Add axis line" onclick={addReference} />
        {/if}
        <PanelButton label="Add text" onclick={addText} />
        {#if selectedDatumIds.length > 0}
          <PanelButton label="Recolour selection" onclick={highlightSelection} />
        {/if}
        {#if selectedElementIds.length > 0}
          <PanelButton label="Delete selected elements" onclick={deleteSelectedElements} />
        {/if}
      </div>

      <PanelNote>
        Capabilities come from the same discriminated type the renderer switches on. Pie, funnel,
        radar, heatmap, and treemap never receive Cartesian-only elements; scatter and bubble offer
        derived regressions; growth charts offer derived CAGR lines.
      </PanelNote>
    </ScreenGroup>

    <ScreenNote>
      Every chart, category, series, datum, axis, and added element has a stable id. Geometry and
      frame placement are derived around those identities, so switching size or refreshing values
      cannot silently move a selection to another fact.
    </ScreenNote>
  </ScreenSurface>

  <div class="border-border-subtle bg-surface-panel w-75 shrink-0 border-s">
    <SelectionPanel {selection} {chart} />
  </div>
</div>

<script lang="ts">
  import SelectionPanel from "$development-views/plot-demo/components/selection-panel.svelte";
  import {
    createChartSelection,
    settingsFor,
    type ChartType
  } from "$authored-components/chart";
  import { PlotBars, PlotPie } from "$authored-components/chart/plot";
  import { PanelChoice, PanelNote } from "$authored-components/panel";
  import { ScreenGroup, ScreenNote, ScreenSurface } from "$authored-components/screen";

  /**
   * The hand-rolled charts, and the thing they exist for: selection.
   *
   * A separate page from `/demo/analysis` on purpose. That one is the library
   * version and stays as the comparison — the defects it still has are the
   * argument for this one, and deleting the evidence would leave only an
   * assertion.
   *
   * **Click a bar. Click a slice.** That is the whole demonstration. Shift-click
   * adds; clicking a category label under the chart takes the whole column;
   * clicking a legend entry takes the whole series; Escape or a click on the
   * background clears. The panel on the right reads the selection and says what
   * shape it is, because a selection of one bar and a selection of a whole
   * series afford different things.
   */
  const DATA = [
    { region: "Eastbrook", storm: 1180, equipment: 460, planned: 202 },
    { region: "Harlow", storm: 610, equipment: 380, planned: 200 },
    { region: "Ward 3", storm: 402, equipment: 338, planned: 200 },
    { region: "Millbrook", storm: 250, equipment: 220, planned: 150 },
    { region: "Deering", storm: 140, equipment: 130, planned: 110 }
  ];

  const SERIES = [
    { key: "storm", label: "Storm" },
    { key: "equipment", label: "Equipment" },
    { key: "planned", label: "Planned" }
  ];

  const TOTALS = DATA.map((row) => ({
    region: row.region,
    total: row.storm + row.equipment + row.planned
  }));

  let type = $state<ChartType>("bar");
  let layout = $state("stack");
  let orientation = $state("vertical");
  let labels = $state("value");
  let hovered = $state<string | undefined>(undefined);

  const selection = createChartSelection();

  /** Which controls this type can even answer. A pie is offered none of them. */
  const offered = $derived(settingsFor(type));

  const format = (value: number) => value.toLocaleString();
</script>

<svelte:head>
  <title>Charts, hand-rolled — Icarus</title>
</svelte:head>

<div class="flex h-full min-h-0">
  <ScreenSurface wide class="flex-1">
    <a href="/demo/analysis" class="text-caption text-interactive-text w-fit hover:underline">
      ← The library version, for comparison
    </a>

    <h1 class="text-h3 leading-h3 m-0 font-semibold tracking-tight">Charts, hand-rolled</h1>
    <p class="text-body-sm text-ink-muted m-0 max-w-prose">
      Every bar and every slice is a thing you can point at. Click one. Shift-click
      to add another. Click a category label to take the whole column, or a legend
      entry to take the whole series. Escape clears.
    </p>

    <ScreenGroup label="Chart">
      {#snippet actions()}
        <!-- The legend is a control: each entry selects its whole series. -->
        <div class="flex flex-wrap items-center gap-2">
          {#each SERIES as entry, index (entry.key)}
            <button
              type="button"
              onmouseenter={() => (hovered = entry.key)}
              onmouseleave={() => (hovered = undefined)}
              onclick={(event) =>
                selection.series(
                  entry.key,
                  DATA.map((row) => row.region),
                  event.shiftKey || event.metaKey
                )}
              class="text-caption border-border-subtle bg-surface-panel hover:border-interactive-border rounded-control inline-flex cursor-pointer items-center gap-1.5 border px-1.5 py-1"
            >
              <span
                class="size-3 shrink-0 rounded-full"
                style="background: var(--color-{['accent-1', 'accent-2', 'interactive'][index]}-fill)"
              ></span>
              {entry.label}
            </button>
          {/each}
        </div>
      {/snippet}

      <div class="border-border-subtle rounded-panel bg-surface-panel border p-4">
        {#if type === "pie"}
          <!-- No axes, no grid, no frame. A pie has none of those to have. -->
          <PlotPie data={TOTALS} x="region" value="total" {selection} {format} height={320} />
        {:else}
          <PlotBars
            data={DATA}
            x="region"
            series={SERIES}
            layout={layout as "stack" | "group" | "expand" | "overlap"}
            horizontal={orientation === "horizontal"}
            labels={labels as "none" | "value" | "total"}
            {selection}
            bind:hovered
            {format}
            height={320}
          />
        {/if}
      </div>
    </ScreenGroup>

    <ScreenGroup label="How it is drawn">
      <div class="flex flex-wrap items-start gap-6">
        <div class="flex flex-col gap-1">
          <span class="text-caption text-ink-muted">Kind</span>
          <PanelChoice
            label="Chart kind"
            value={type}
            options={[
              { value: "bar", label: "Bar" },
              { value: "pie", label: "Pie" }
            ]}
            onchange={(next) => (type = next as ChartType)}
          />
        </div>

        <!--
          Absent rather than disabled. `settingsFor` says which controls a type
          can answer, so a pie is not offered a stacking mode it would ignore —
          which is what the library version does and what makes its panel a lie.
        -->
        {#if offered.layout}
          <div class="flex flex-col gap-1">
            <span class="text-caption text-ink-muted">Series together</span>
            <PanelChoice
              label="How series share the space"
              value={layout}
              options={[
                { value: "stack", label: "Stacked" },
                { value: "group", label: "Clustered" },
                { value: "expand", label: "100%" },
                { value: "overlap", label: "Overlaid" }
              ]}
              onchange={(next) => (layout = next)}
            />
          </div>
        {/if}

        {#if offered.orientation}
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
        {/if}

        {#if offered.labels && type !== "pie"}
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
        {/if}
      </div>

      <PanelNote>
        The controls a kind cannot answer are absent rather than greyed out. A pie
        is offered no stacking mode, because there is no honest thing for one to
        do.
      </PanelNote>
    </ScreenGroup>

    <ScreenNote>
      Drawn from `layout.ts`, which is pure functions over numbers — the geometry
      can be checked by reading it. That is the thing the library could not offer:
      its labels could be measured landing on top of each other but not corrected.
    </ScreenNote>
  </ScreenSurface>

  <div class="border-border-subtle bg-surface-panel w-75 shrink-0 border-s">
    <SelectionPanel {selection} data={DATA} series={SERIES} {format} />
  </div>
</div>

<script lang="ts">
  import ChartArea from "@lucide/svelte/icons/chart-area";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChartLine from "@lucide/svelte/icons/chart-line";
  import ChartPie from "@lucide/svelte/icons/chart-pie";
  import ChartScatter from "@lucide/svelte/icons/chart-scatter";
  import TableIcon from "@lucide/svelte/icons/table";

  import { Draggable, DropZone } from "$lib/unique-components/drag";
  import { PanelChip } from "$lib/unique-components/panel";
  import {
    ScreenBanner,
    ScreenHeader,
    ScreenNote,
    ScreenSurface
  } from "$lib/unique-components/screen";
  import { Button } from "$lib/simple-components/button";
  import { ToggleGroup, ToggleGroupItem } from "$lib/simple-components/toggle-group";
  import {
    analysis,
    chartFor,
    chartKinds,
    filtersIn,
    limitIn,
    placementsOn,
    relationship,
    resultFor,
    sortIn,
    tablesIn,
    type ChartKind,
    type ChartKindId,
    type Placement,
    type ResultColumn,
    type ResultRow,
    type TableField,
    type TableVariable
  } from "$mock-capabilities/analysis";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Analysis — one analysis: the chart, then the controls that made it.
   *
   * `docs/screen-panel-views/screens/analysis/workspace-one-analysis.md` is the
   * specification.
   *
   * **The chart is first, and it is three rows of seven.** It is the thing being
   * made; everything below it is how it got that way. The drop zones take two
   * rows because six of them wrap, and the header and the relationship banner
   * take one each because a title and a sentence are one line high. Those
   * proportions are the specification's layout table read straight down.
   *
   * **There is no root, no input and no join step.** Variables are variables: a
   * field goes on an axis and the chart appears. Where two of them turn out to
   * need relating, that is a problem stated *under* the chart rather than a
   * modelling step in front of it.
   *
   * **The bars draw one measure.** Y holds two aggregates whose magnitudes are
   * five orders apart, and two series on one scale would draw the second as
   * nothing. The measure the sort names is the one with a height; the others are
   * counted under each bar, and the legend says which is which.
   *
   * **Nothing here writes.** A definition is a door, and a mock door has nothing
   * to write to — so a drag, an add menu and a placement all open the lens for
   * whatever was touched. Both paths exist and both are reachable from a
   * keyboard, which is what the rule about nothing being drag-only protects.
   */
  let {
    /** Which analysis this is. View state on the screen, so only a parent knows it. */
    analysisId = "an-minutes"
  }: { analysisId?: string } = $props();

  const record = $derived(analysis(analysisId).current);
  const display = $derived(chartFor(analysisId).current);
  const kinds = $derived(chartKinds().current);
  const result = $derived(resultFor(analysisId).current);
  const across = $derived(placementsOn(analysisId, "x").current);
  const up = $derived(placementsOn(analysisId, "y").current);
  const tinted = $derived(placementsOn(analysisId, "colour").current);
  const filters = $derived(filtersIn(analysisId).current);
  const sort = $derived(sortIn(analysisId).current);
  const limit = $derived(limitIn(analysisId).current);
  const pairing = $derived(relationship(analysisId).current);
  const tables = $derived(tablesIn(mockWorkbench.project.id).current);

  const figure = (value: number): string => value.toLocaleString("en-GB");

  /** `outageEvents.subId` reads as `subId` where the variable is already named. */
  const fieldOf = (reference: string): string => reference.slice(reference.lastIndexOf(".") + 1);

  /* ---------------- the chart ---------------- */

  const KIND_ICON = {
    table: TableIcon,
    bar: ChartColumn,
    line: ChartLine,
    area: ChartArea,
    scatter: ChartScatter,
    pie: ChartPie
  } as const satisfies Record<ChartKindId, unknown>;

  /** Empty until someone picks one; until then the definition's own kind is active. */
  let picked = $state("");
  const kind = $derived(
    kinds.find((option: ChartKind) => option.id === picked)?.id ?? display.kind
  );
  /** Only these three are columns. A pie drawn as bars would be a lie about the kind. */
  const drawsColumns = $derived(kind === "bar" || kind === "line" || kind === "area");

  const measures = $derived(
    result.columns.filter((column: ResultColumn) => column.role === "measure")
  );
  /**
   * The measure with a height is the one the sort orders by. Giving the height
   * to an arbitrary column would put the tallest bar somewhere the sort does not
   * explain, which is the fastest way to make a chart lie.
   */
  const drawn = $derived(
    measures.find((column: ResultColumn) => column.key === sort?.reads) ?? measures[0]
  );
  const drawnAt = $derived(measures.indexOf(drawn));
  /** The measures with no height. Counted under each bar rather than drawn beside it. */
  const counted = $derived(measures.filter((column: ResultColumn) => column !== drawn));
  const asides = $derived(drawsColumns ? counted : measures);

  const heights = $derived(result.rows.map((row: ResultRow) => row.values[drawnAt]));
  const top = $derived(Math.max(...heights));
  /** `zeroBased` decides the floor. A bar chart off zero exaggerates every difference. */
  const floor = $derived(display.zeroBased ? 0 : Math.min(...heights));
  const heightOf = (value: number): number =>
    top === floor ? 100 : ((value - floor) / (top - floor)) * 100;

  const tallest = $derived(
    result.rows.reduce(
      (best: ResultRow | undefined, row: ResultRow) =>
        best === undefined || row.values[drawnAt] > best.values[drawnAt] ? row : best,
      undefined
    )
  );
  let markedRow = $state("");
  /** The tallest bar is marked until someone marks another one. */
  const marked = $derived(markedRow === "" ? (tallest?.id ?? "") : markedRow);

  const inspectMark = (row: ResultRow) => {
    markedRow = row.id;
    mockWorkbench.inspect("analysis.mark", { kind: "mark", id: row.id });
  };

  /**
   * Both captions, kept together. The first stops a chart being mistaken for a
   * stored result; the second stops a truncated view being mistaken for the
   * whole, which needs the limit as well as the two counts.
   */
  const shape = $derived(
    `Showing ${result.rows.length} of ${result.total}${limit === null ? "" : ` · limit ${limit.keep}`}`
  );

  /* ---------------- the drop zones ---------------- */

  /** Every field of every table, as one addable list. A field is what a zone takes. */
  const fields = $derived(
    tables.flatMap((table: TableVariable) =>
      table.fields.map((field: TableField) => ({
        value: `${table.id}:${table.name}.${field.name}`,
        label: `${table.name}.${field.name} — ${field.type}`
      }))
    )
  );

  /** A field added or dropped lands on the variable it came out of. */
  const openField = (value: string) => {
    const mark = value.indexOf(":");
    if (mark < 0) return;
    mockWorkbench.inspect("analysis.variable", { kind: "variable", id: value.slice(0, mark) });
  };

  const ZONES = [
    { value: "x", label: "X — across" },
    { value: "y", label: "Y — up" },
    { value: "filters", label: "Filters" },
    { value: "sort", label: "Sort" },
    { value: "limit", label: "Limit" },
    { value: "colour", label: "Colour" }
  ] as const;

  /** Where a placed field may go from here: every zone but the one it is in. */
  const elsewhere = (from: string) => ZONES.filter((zone) => zone.value !== from);

  const openPlacement = (placement: Placement) =>
    mockWorkbench.inspect("analysis.placement", { kind: "placement", id: placement.id });

  const openFilter = (filterId: string) =>
    mockWorkbench.inspect("analysis.filter", { kind: "filter", id: filterId });

  const openSort = () => mockWorkbench.inspect("analysis.sort");
  const openLimit = () => mockWorkbench.inspect("analysis.limit");

  /* ---------------- the relationship ---------------- */

  /**
   * Two variables are in play when the placed fields do not all come from one.
   * The banner exists only then — a relationship is a problem solved where the
   * problem is, not a step in front of the chart.
   */
  const inPlay = $derived(new Set([...across, ...up].map((placed: Placement) => placed.variable)));
</script>

<ScreenSurface wide>
  <div class="board">
    <div class="area-screen-header">
      <ScreenHeader title={record.title}>
        {#snippet actions()}
          <PanelChip tone={record.state === "Saved" ? "success" : "attention"}>
            {record.state}
          </PanelChip>
          <Button variant="outline" size="sm">Duplicate</Button>
        {/snippet}
      </ScreenHeader>
    </div>

    <!-- The picture, its title, the kind switcher, and the two honest captions. -->
    <div class="area-chart flex flex-col gap-3">
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <h2 class="text-body text-ink-primary m-0 font-medium">{display.title}</h2>
        <ToggleGroup type="single" bind:value={picked} variant="outline" size="sm">
          {#each kinds as option (option.id)}
            {@const Icon = KIND_ICON[option.id]}
            <ToggleGroupItem value={option.id} title={option.needs} aria-label={option.name}>
              <Icon aria-hidden="true" />
              {option.name}
            </ToggleGroupItem>
          {/each}
        </ToggleGroup>
      </div>

      <!--
        The fill is handed down as a custom property so no bar names a colour of
        its own: the definition's colour tokens are the only source of one.
      -->
      <div
        class="frame border-border-subtle bg-surface-panel rounded-panel border p-4"
        style="--bar-fill: var({display.colours[0].token})"
      >
        <div class="plot">
          <span class="text-caption text-ink-muted">{display.yLabel}</span>

          <div class="bars" class:is-listed={!drawsColumns}>
            {#each result.rows as row (row.id)}
              <button
                type="button"
                class="bar"
                class:is-marked={marked === row.id}
                aria-pressed={marked === row.id}
                onclick={() => inspectMark(row)}
              >
                {#if drawsColumns}
                  <span class="text-caption text-ink-secondary tabular-nums">
                    {figure(row.values[drawnAt])}
                  </span>
                  <span class="track">
                    <span class="column" style="height: {heightOf(row.values[drawnAt])}%"></span>
                  </span>
                {/if}
                <span class="text-caption text-ink-primary">{row.group}</span>
                {#each asides as column (column.key)}
                  <span class="text-caption text-ink-muted tabular-nums">
                    {figure(row.values[measures.indexOf(column)])}
                    {column.label.toLowerCase()}
                  </span>
                {/each}
              </button>
            {/each}
          </div>

          <span class="text-caption text-ink-muted text-center">{display.xLabel}</span>
        </div>

        {#if display.legend !== "None"}
          <ul class="legend">
            {#each measures as column, index (column.key)}
              <li class="text-caption text-ink-secondary flex items-center gap-1.5">
                {#if column === drawn && drawsColumns}
                  <span
                    class="rounded-control size-3 shrink-0"
                    style="background: var({display.colours[index % display.colours.length].token})"
                  ></span>
                {:else}
                  <!-- No height, no fill: an outline says the measure is here but not drawn. -->
                  <span class="border-border-strong rounded-control size-3 shrink-0 border"></span>
                {/if}
                <span class="min-w-0">
                  {column.label}
                  {#if column !== drawn || !drawsColumns}
                    <span class="text-ink-muted">· under each bar</span>
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <ScreenNote meta={shape}>
        Generated from current data — the result itself is not stored.
      </ScreenNote>
    </div>

    <!--
      Six places to put a field. Each is a `DropZone`, which carries the add menu
      and the keyboard path with it — nothing here is drag-only, and an empty
      zone says what belongs in it rather than sitting blank.
    -->
    <div class="area-drop-zones zones">
      <DropZone
        label="X — across"
        empty="drop a field to spread the chart across it"
        count={across.length}
        additions={fields}
        onadd={openField}
        ondrop={openField}
      >
        {#each across as placed (placed.id)}
          <Draggable
            id={placed.id}
            label={placed.reads}
            destinations={elsewhere("x")}
            onplace={() => openPlacement(placed)}
          >
            <button type="button" class="chip" onclick={() => openPlacement(placed)}>
              <span class="text-body-sm text-ink-primary">{placed.reads}</span>
              <span class="text-caption text-ink-muted">{placed.aggregation}</span>
            </button>
          </Draggable>
        {/each}
      </DropZone>

      <DropZone
        label="Y — up"
        empty="drop a number to give the chart a height"
        count={up.length}
        additions={fields}
        onadd={openField}
        ondrop={openField}
      >
        {#each up as placed (placed.id)}
          <Draggable
            id={placed.id}
            label={placed.reads}
            destinations={elsewhere("y")}
            onplace={() => openPlacement(placed)}
          >
            <button type="button" class="chip" onclick={() => openPlacement(placed)}>
              <span class="text-body-sm text-ink-primary">{placed.reads}</span>
              <span class="text-caption text-ink-muted">{placed.label}</span>
            </button>
          </Draggable>
        {/each}
      </DropZone>

      <DropZone
        label="Filters"
        empty="drop a field to filter by it"
        count={filters.length}
        additions={fields}
        onadd={openField}
        ondrop={openField}
      >
        {#each filters as rule (rule.id)}
          <Draggable
            id={rule.id}
            label={rule.reads}
            destinations={elsewhere("filters")}
            onplace={() => openFilter(rule.id)}
          >
            <button type="button" class="chip" onclick={() => openFilter(rule.id)}>
              <span class="text-body-sm text-ink-primary font-mono">{rule.reads}</span>
              <!-- Both numbers: a filter with no visible effect is usually a mistake. -->
              <span class="text-caption text-ink-muted tabular-nums">
                {figure(rule.rowsKept)} of {figure(rule.rowsIn)} kept
              </span>
            </button>
          </Draggable>
        {/each}
        {#if filters.length > 0}
          <!-- The instruction stays after the first rule: a filter list is never finished. -->
          <span class="text-caption text-ink-muted italic">drop a field to filter by it too</span>
        {/if}
      </DropZone>

      <DropZone
        label="Sort"
        empty="drop a placement to order the result by it"
        count={sort === null ? 0 : 1}
        additions={[...across, ...up].map((placed: Placement) => ({
          value: placed.id,
          label: placed.reads
        }))}
        onadd={openSort}
        ondrop={openSort}
      >
        {#if sort !== null}
          <Draggable
            id={sort.id}
            label={sort.reads}
            destinations={elsewhere("sort")}
            onplace={openSort}
          >
            <button type="button" class="chip" onclick={openSort}>
              <!-- A sort names a placement, never a bare field: the two mean different things. -->
              <span class="text-body-sm text-ink-primary">{sort.reads}</span>
              <span class="text-caption text-ink-muted">{sort.direction}</span>
            </button>
          </Draggable>
        {/if}
      </DropZone>

      <DropZone
        label="Limit"
        empty="say how much of the result to show"
        count={limit === null ? 0 : 1}
        additions={[
          { value: "10", label: "Keep 10" },
          { value: "25", label: "Keep 25" },
          { value: "50", label: "Keep 50" },
          { value: "all", label: "Keep everything" }
        ]}
        onadd={openLimit}
      >
        {#if limit !== null}
          <button type="button" class="chip" onclick={openLimit}>
            <span class="text-body-sm text-ink-primary">Keep {limit.keep}</span>
            <!-- One number without the other says nothing. -->
            <span class="text-caption text-ink-muted tabular-nums">of {limit.of}</span>
          </button>
        {/if}
      </DropZone>

      <!--
        Colour is a proposal rather than a persisted encoding — the door answers
        empty for it on purpose, which makes this the specification's own example
        of a zone that teaches its use instead of sitting blank.
      -->
      <DropZone
        label="Colour"
        empty="this chart doesn't need one — drop a field to split the bars"
        count={tinted.length}
        additions={fields}
        onadd={openField}
        ondrop={openField}
      >
        {#each tinted as placed (placed.id)}
          <Draggable
            id={placed.id}
            label={placed.reads}
            destinations={elsewhere("colour")}
            onplace={() => openPlacement(placed)}
          >
            <button type="button" class="chip" onclick={() => openPlacement(placed)}>
              <span class="text-body-sm text-ink-primary">{placed.reads}</span>
            </button>
          </Draggable>
        {/each}
      </DropZone>
    </div>

    <!--
      Present only when two variables are actually in play. Stated as a problem
      with a fix, with the match named as a guess — because it is one, and the
      chart above is quietly wrong whenever the guess is.
    -->
    {#if inPlay.size > 1}
      <div class="area-relationship">
        <ScreenBanner
          title="Two variables, no relationship"
          tone="attention"
          meta="{pairing.key.matched} of {pairing.key.of} match"
        >
          You dropped <strong>{pairing.placed[0]}</strong> and
          <strong>{pairing.placed[1]}</strong>. They line up on
          <strong>{fieldOf(pairing.key.left)} → {fieldOf(pairing.key.right)}</strong>, which is what
          this chart is using. Change it, or pick a different pairing.
          {#snippet actions()}
            <Button
              variant="outline"
              size="sm"
              onclick={() => mockWorkbench.inspect("analysis.relationship")}
            >
              Change the match
            </Button>
          {/snippet}
        </ScreenBanner>
      </div>
    {/if}
  </div>
</ScreenSurface>

<style>
  /**
   * The layout table from the specification, as `grid-template-areas`. One
   * track: the chart wants the whole plane, and so does a strip of six zones.
   *
   * The bands are proportional rather than fixed, and the proportions are the
   * repeated labels in the table — chart three rows, drop zones two, the header
   * and the banner one each. Read down, that is the argument the screen makes:
   * the picture is most of it, the controls that made the picture are the rest,
   * and a title and a warning are single lines around them.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 5);
    grid-template-columns: 1fr;
    grid-template-areas:
      "screen-header"
      "chart"
      "chart"
      "chart"
      "drop-zones"
      "drop-zones"
      "relationship";
    align-content: start;
  }

  .area-screen-header {
    grid-area: screen-header;
  }
  .area-chart {
    grid-area: chart;
  }
  .area-drop-zones {
    grid-area: drop-zones;
  }
  .area-relationship {
    grid-area: relationship;
  }

  /* The picture and its legend. `Right` is the definition's legend position. */
  .frame {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: calc(var(--token-spacing-unit) * 4);
    align-items: center;
  }

  .plot {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  /*
   * A definite height is what lets a bar be a percentage of anything. It is the
   * one dimension the content cannot supply, and it is set once, on the band,
   * rather than on every bar. A kind with no columns drops it again.
   */
  .bars {
    display: flex;
    height: calc(var(--token-spacing-unit) * 60);
    align-items: stretch;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .bars.is-listed {
    height: auto;
    flex-wrap: wrap;
  }

  .bar {
    display: flex;
    min-width: 0;
    flex: 1 1 0;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: var(--token-spacing-unit);
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    text-align: center;
  }

  .track {
    display: flex;
    width: 100%;
    min-height: 0;
    flex: 1 1 auto;
    align-items: flex-end;
  }

  /*
   * An unmarked bar is the same colour at less weight: what is marked is a
   * selection, not a category, and giving it a second colour would read as one.
   */
  .column {
    width: 100%;
    min-height: var(--token-spacing-unit);
    border-radius: var(--token-radius-control) var(--token-radius-control) 0 0;
    background: var(--bar-fill);
    opacity: 0.55;
  }

  .bar:hover .column {
    opacity: 0.8;
  }

  .bar.is-marked .column {
    opacity: 1;
  }

  .legend {
    display: flex;
    max-width: calc(var(--token-spacing-unit) * 44);
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Six zones that wrap rather than scroll: all six are read at once. */
  .zones {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(calc(var(--token-spacing-unit) * 52), 1fr));
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .chip {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    text-align: start;
  }

  /*
   * The board is one track already, so there is no column fallback to write.
   * What has to give way is the legend, which stops being *right* long before
   * the plane runs out.
   */
  @media (max-width: 60rem) {
    .frame {
      grid-template-columns: 1fr;
    }

    .legend {
      max-width: none;
      flex-direction: row;
      flex-wrap: wrap;
    }
  }
</style>

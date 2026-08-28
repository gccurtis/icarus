<script lang="ts">
  import ChartArea from "@lucide/svelte/icons/chart-area";
  import ChartCandlestick from "@lucide/svelte/icons/chart-candlestick";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChartColumnBig from "@lucide/svelte/icons/chart-column-big";
  import ChartColumnIncreasing from "@lucide/svelte/icons/chart-column-increasing";
  import ChartLine from "@lucide/svelte/icons/chart-line";
  import ChartNoAxesCombined from "@lucide/svelte/icons/chart-no-axes-combined";
  import ChartPie from "@lucide/svelte/icons/chart-pie";
  import ChartScatter from "@lucide/svelte/icons/chart-scatter";
  import Crosshair from "@lucide/svelte/icons/crosshair";
  import Grid3x3 from "@lucide/svelte/icons/grid-3x3";
  import Proportions from "@lucide/svelte/icons/proportions";
  import TableIcon from "@lucide/svelte/icons/table";

  import {
    createChartSelection,
    type ChartSelection,
    type ChartSpec,
    type Mark
  } from "$components/authored/chart";
  import { PlotBars } from "$components/authored/chart/plot";
  import { PanelInput, PanelSelect, PanelToggle } from "$components/authored/panel";
  import {
    ScreenCell,
    ScreenEmpty,
    ScreenHeadCell,
    ScreenHeader,
    ScreenNote,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$components/authored/screen";
  import { Button } from "$lib/components/vendor/button";
  import { ToggleGroup, ToggleGroupItem } from "$lib/components/vendor/toggle-group";
  import {
    aggregationsFor,
    analysis,
    chartFor,
    filtersIn,
    limitIn,
    placementsOn,
    relationship,
    resultFor,
    sortIn,
    tablesIn,
    type Aggregation,
    type FieldType,
    type FilterOperator,
    type Placement,
    type ResultColumn,
    type ResultRow,
    type TableField,
    type TableVariable
  } from "$capabilities/analysis";
  import { analyses, type AnalysisRow } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Analysis — one analysis, drawn, and the controls that drew it.
   *
   * **An analysis tab is the analysis.** It is keyed by `resourceId`, the same
   * field that makes two threads two tabs, so two charts stand open beside one
   * another and one chart reached three ways is one tab.
   *
   * **There is one centre and one title.** Which analyses exist is a map, and a
   * map belongs in the rail rather than in a centre of its own. The title on the
   * plane is the analysis' own — the chart's title, the save state and Duplicate
   * all belong to the overview panel, not to a second header.
   *
   * **Three bands, and the picture takes what the other two do not.** The chart
   * is the thing being made; the twelve kinds and the customisation grid are how
   * it got that way, so they are `auto` rows and the chart is `minmax(0, 1fr)`.
   * Nothing scrolls — a chart you have to scroll to is a chart you cannot read
   * against its own controls, which is the entire argument for this screen
   * existing rather than an editor's inspector doing the job.
   *
   * **The bars draw one measure, and the sort names it.** Y holds two aggregates
   * five orders of magnitude apart; drawn as two series the second is zero
   * pixels tall. The measure the sort orders by is the one with a height, the
   * others are named in the legend as not drawn, and changing the sort target
   * changes which one that is.
   *
   * **Twelve kinds are offered and two are built.** The other ten are selectable
   * and say what they are rather than being greyed out — the vocabulary is what
   * a person is choosing from, and hiding ten of it to avoid admitting they are
   * unbuilt would misrepresent the screen.
   *
   * **What can act on the result acts; what would rewrite the definition opens a
   * lens.** Sort, the conditions and the label options run over what came back,
   * so they take effect on the spot. Select Data, Create Join and Select
   * Aggregation change what the analysis *is*, and a mock door has nothing to
   * write to — so those hold their choice locally and hand the real edit to the
   * inspector.
   */

  /* ---------------- which analysis ---------------- */

  const everyAnalysis = $derived(analyses().current);

  /**
   * The tab is the analysis. The fallback is the first the library holds rather
   * than a hard-coded id, so a tab minted without one lands on something real.
   */
  const analysisId = $derived(view.active.resourceId ?? everyAnalysis[0]?.id ?? "");

  const record = $derived(analysis(analysisId).current);
  const chosen = $derived(everyAnalysis.find((row: AnalysisRow) => row.id === analysisId));

  /**
   * The name comes from the library row where there is one. `analysis()` is
   * still a stub that answers with the one saved definition whatever it is
   * asked, so its title cannot tell the five analyses apart and the row's can.
   */
  const title = $derived(chosen?.name ?? record.title);

  const display = $derived(chartFor(analysisId).current);
  const result = $derived(resultFor(analysisId).current);
  const stored = $derived(sortIn(analysisId).current);
  const limit = $derived(limitIn(analysisId).current);
  const pairing = $derived(relationship(analysisId).current);
  const rules = $derived(filtersIn(analysisId).current);
  const tables = $derived(tablesIn(view.project).current);
  const placedY = $derived(placementsOn(analysisId, "y").current);
  const placedX = $derived(placementsOn(analysisId, "x").current);

  /* ---------------- the fields anything can be built from ---------------- */

  /** Every field of every table variable, as one list a select can hold. */
  const fields = $derived(
    tables.flatMap((table: TableVariable) =>
      table.fields.map((field: TableField) => ({
        value: `${table.name}.${field.name}`,
        label: `${table.name}.${field.name} — ${field.type}`,
        type: field.type
      }))
    )
  );

  const fieldOptions = $derived(
    fields.map((field) => ({ value: field.value, label: field.label }))
  );

  const typeOf = (reference: string): FieldType =>
    fields.find((field) => field.value === reference)?.type ?? "number";

  /** `outageEvents.subId` reads as `subId` where the variable is already named. */
  const fieldOf = (reference: string): string => reference.slice(reference.lastIndexOf(".") + 1);

  const referenceOf = (placed: Placement | undefined): string =>
    placed === undefined ? "" : `${placed.variable}.${placed.field}`;

  /* ---------------- the result, as the screen shows it ---------------- */

  const groupColumn = $derived(
    result.columns.find((column: ResultColumn) => column.role === "group") ?? result.columns[0]
  );
  const measures = $derived(
    result.columns.filter((column: ResultColumn) => column.role === "measure")
  );

  /** Empty means unedited: a column keeps the label the result gave it. */
  let replacements = $state<Record<string, string>>({});
  const labelFor = (key: string): string =>
    replacements[key]?.trim() ||
    result.columns.find((column: ResultColumn) => column.key === key)?.label ||
    key;

  let compact = $state(false);
  const figure = (value: number): string =>
    compact
      ? value.toLocaleString("en-GB", { notation: "compact", maximumFractionDigits: 1 })
      : value.toLocaleString("en-GB");

  const valueIn = (row: ResultRow, key: string): string | number =>
    key === groupColumn.key
      ? row.group
      : (row.values[measures.findIndex((column: ResultColumn) => column.key === key)] ?? 0);

  /**
   * One sort, shown under both axes.
   *
   * `sortIn` answers with a single rule and says why — a tiebreak would need an
   * ordered list — so two sort controls writing to different places would let
   * this screen hold a contradiction the definition cannot express. What the
   * axis decides is which fields are worth offering, not how many sorts there
   * are.
   */
  let sortPicked = $state("");
  let directionPicked = $state("");
  const sortBy = $derived(sortPicked || stored?.reads || measures[0]?.key || groupColumn.key);
  const direction = $derived(directionPicked || stored?.direction || "High to low");

  /**
   * A condition per option, ANDed — which is how the definition chains its own
   * filters, and why three panels can each hold one without fighting. They run
   * over the *result*, so a condition takes effect the moment it is complete.
   *
   * `between` is deliberately not offered: it wants a second value, and this row
   * has one field for one.
   */
  type Condition = { field: string; operator: FilterOperator; value: string };

  let conditions = $state<Record<string, Condition>>({
    "x-axis": { field: "", operator: "is", value: "" },
    "y-axis": { field: "", operator: "≥", value: "" },
    data: { field: "", operator: "≥", value: "" }
  });

  const OPERATORS: readonly { value: FilterOperator; label: string }[] = [
    { value: "is", label: "is" },
    { value: "is not", label: "is not" },
    { value: "≥", label: "≥" },
    { value: "≤", label: "≤" }
  ];

  const passes = (row: ResultRow, rule: Condition): boolean => {
    if (rule.field === "" || rule.value.trim() === "") return true;
    const held = valueIn(row, rule.field);
    const wanted = rule.value.trim();
    if (rule.operator === "is") return String(held).toLowerCase() === wanted.toLowerCase();
    if (rule.operator === "is not") return String(held).toLowerCase() !== wanted.toLowerCase();
    const left = Number(held);
    const right = Number(wanted.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(left) || !Number.isFinite(right)) return true;
    return rule.operator === "≥" ? left >= right : left <= right;
  };

  const shown = $derived(
    result.rows
      .filter((row: ResultRow) =>
        Object.values(conditions).every((rule: Condition) => passes(row, rule))
      )
      .toSorted((a: ResultRow, b: ResultRow) => {
        const factor = direction === "High to low" ? -1 : 1;
        const left = valueIn(a, sortBy);
        const right = valueIn(b, sortBy);
        return typeof left === "number" && typeof right === "number"
          ? (left - right) * factor
          : String(left).localeCompare(String(right)) * factor;
      })
  );

  /** Both numbers, and the limit: a truncated view mistaken for the whole is the failure. */
  const shape = $derived(
    `Showing ${shown.length} of ${result.total}${limit === null ? "" : ` · limit ${limit.keep}`}`
  );

  const clearConditions = () => {
    for (const rule of Object.values(conditions)) {
      rule.field = "";
      rule.value = "";
    }
  };

  /**
   * What one condition does on its own — how many rows it keeps, of how many it
   * was handed. A filter with no visible effect is usually a mistake, and one
   * number without the other cannot say so.
   */
  const effectOf = (rule: Condition): string =>
    rule.field === "" || rule.value.trim() === ""
      ? "No condition set."
      : `Keeps ${result.rows.filter((row: ResultRow) => passes(row, rule)).length} of ${result.rows.length} rows.`;

  /* ---------------- the kind ---------------- */

  /**
   * The vocabulary, held here rather than read from `chartKinds()`: that door
   * answers with the six the definition can store and has no way to say which of
   * them draw, and both of those are what this row is about.
   */
  const KINDS = [
    { id: "table", label: "Table", icon: TableIcon },
    { id: "bar", label: "Bar", icon: ChartColumn },
    { id: "cluster", label: "Cluster", icon: ChartColumnBig },
    { id: "line", label: "Line", icon: ChartLine },
    { id: "bar-line", label: "Bar-Line", icon: ChartNoAxesCombined },
    { id: "pie", label: "Pie", icon: ChartPie },
    { id: "scatter", label: "Scatter", icon: ChartScatter },
    { id: "area", label: "Area", icon: ChartArea },
    { id: "histogram", label: "Histogram", icon: ChartColumnIncreasing },
    { id: "boxplot", label: "Boxplot", icon: ChartCandlestick },
    { id: "heatmap", label: "Heatmap", icon: Grid3x3 },
    { id: "mekko", label: "Mekko", icon: Proportions }
  ] as const;

  /** Empty until someone picks one; until then the definition's own kind is on. */
  let picked = $state("");
  const kind = $derived(picked === "" ? display.kind : picked);
  const kindEntry = $derived(KINDS.find((entry) => entry.id === kind) ?? KINDS[1]);
  const isBuilt = (id: string): boolean => id === "table" || id === "bar";

  /* ---------------- the spec, and what draws it ---------------- */

  /**
   * The measure with a height. Giving it to an arbitrary column would put the
   * tallest bar somewhere the sort does not explain, which is the fastest way to
   * make a chart lie.
   */
  const drawn = $derived(
    measures.find((column: ResultColumn) => column.key === sortBy) ?? measures[0]
  );

  let figures = $state(true);
  let sideways = $state(false);

  /** How tall the plot may be, measured off the band rather than guessed. */
  let stage = $state(0);

  /**
   * What the chart *is*, separately from how it is drawn — the same object an
   * inspector preview or a slide would render at another size.
   *
   * It is a bar spec because bar is the only drawn kind that is built. Table is
   * not a `ChartType` at all and never will be: it is the result itself, with no
   * encoding decisions to hold.
   */
  const spec = $derived<ChartSpec>({
    type: "bar",
    data: shown.map((row: ResultRow) => ({
      [groupColumn.key]: row.group,
      ...Object.fromEntries(
        measures.map((column: ResultColumn, index: number) => [column.key, row.values[index]])
      )
    })),
    x: { field: groupColumn.key, title: labelFor(groupColumn.key), grid: false },
    y: { title: labelFor(drawn?.key ?? ""), grid: true },
    series: [
      {
        key: drawn?.key ?? "",
        label: labelFor(drawn?.key ?? ""),
        // The definition's own colour, as a token: a chart pasted into a deck is the deck's palette.
        color: `var(${display.colours[0].token})`
      }
    ],
    settings: {
      layout: "overlap",
      orientation: sideways ? "horizontal" : "vertical",
      labels: figures ? "value" : "none",
      legend: display.legend !== "None",
      height: Math.max(180, stage),
      format: figure
    }
  });

  /* ---------------- what a click on the picture means ---------------- */

  const inspectGraph = () =>
    view.inspect(kind === "table" ? "analysis.table-graph" : "analysis.bar-graph");

  const marks = createChartSelection();

  const inspectMarks = () => {
    const [first, ...rest] = marks.ids;
    if (first === undefined) {
      inspectGraph();
      return;
    }
    view.inspect("analysis.bars", {
      kind: "bar",
      id: first,
      at: rest.length > 0 ? `${marks.count} bars` : undefined
    });
  };

  /**
   * The plot's selection, with the inspector following it.
   *
   * Wrapped rather than watched with an `$effect`: an effect over `ids` also
   * fires on mount, so arriving at Analysis would throw the inspector onto the
   * chart lens before anyone had touched anything. `PlotBars` owns the gestures;
   * what a gesture *means* to the rest of the screen is this screen's business.
   */
  const selection: ChartSelection = {
    get ids() {
      return marks.ids;
    },
    get count() {
      return marks.count;
    },
    get isEmpty() {
      return marks.isEmpty;
    },
    get shape() {
      return marks.shape;
    },
    has: (id: string) => marks.has(id),
    click: (id: string, additive = false) => {
      marks.click(id, additive);
      inspectMarks();
    },
    category: (category: string, series: readonly { key: string }[], additive = false) => {
      marks.category(category, series, additive);
      inspectMarks();
    },
    series: (key: string, categories: readonly string[], additive = false) => {
      marks.series(key, categories, additive);
      inspectMarks();
    },
    all: (every: readonly Mark[]) => {
      marks.all(every);
      inspectMarks();
    },
    clear: () => {
      marks.clear();
      inspectGraph();
    }
  };

  const inspectRow = (row: ResultRow) =>
    view.inspect("analysis.row", { kind: "row", id: row.id });
  const inspectColumn = (column: ResultColumn) =>
    view.inspect("analysis.column", { kind: "column", id: column.key });
  const inspectCell = (row: ResultRow, column: ResultColumn) =>
    view.inspect("analysis.cell", { kind: "cell", id: row.id, at: column.key });

  const isSelected = (kindName: string, id: string): boolean =>
    view.selection?.kind === kindName && view.selection.id === id;

  /* ---------------- the customisation panel ---------------- */

  const OPTIONS = [
    { id: "x-axis", label: "X-Axis", lens: "analysis.x-axis" },
    { id: "y-axis", label: "Y-Axis", lens: "analysis.y-axis" },
    { id: "data", label: "Data", lens: "analysis.data-button" },
    { id: "labels", label: "Labels", lens: "analysis.labels" }
  ] as const;

  type OptionId = (typeof OPTIONS)[number]["id"];

  let option = $state<OptionId>("x-axis");

  const lensOf = (id: OptionId) => (OPTIONS.find((entry) => entry.id === id) ?? OPTIONS[0]).lens;

  /** Choosing an option is also inspecting it: the lens is the long form of this grid. */
  const choose = (entry: (typeof OPTIONS)[number]) => {
    option = entry.id;
    view.inspect(entry.lens);
  };

  /**
   * The three data selects. Empty means unedited, so what shows is the placement
   * the definition actually holds until somebody changes it.
   */
  let xPicked = $state("");
  let yPicked = $state("");
  let dataPicked = $state("");
  let aggregationPicked = $state("");

  const xField = $derived(xPicked || referenceOf(placedX[0]) || fields[0]?.value || "");
  const yField = $derived(yPicked || referenceOf(placedY[0]) || fields[0]?.value || "");
  const dataField = $derived(dataPicked || referenceOf(placedY[0]) || fields[0]?.value || "");

  const aggregations = $derived(aggregationsFor(typeOf(dataField)).current);

  /**
   * Held to what the field's type permits: moving Data onto a text column has to
   * drop `Sum` rather than leave the select naming an aggregation the type
   * cannot answer.
   */
  const aggregation = $derived(
    aggregations.find(
      (entry: Aggregation) => entry === (aggregationPicked || placedY[0]?.aggregation)
    ) ??
      aggregations[0] ??
      "Sum"
  );

  /**
   * A field dragged in from the rail's Variables view.
   *
   * Written to `Draggable`'s transfer rather than one of its own: it carries the
   * item's id in `application/x-icarus-item` and its label in `text/plain`, so
   * both are read and a field row travelling as `outageEvents.subId` lands
   * whichever slot it used. A table resolves to its first field, because a
   * select here holds a field and a table is not one.
   *
   * Nothing drags yet — the Variables view is a list of `PanelField`s — so this
   * is the receiving half of a contract, and the half that can be written now.
   */
  const droppedField = (transfer: DataTransfer | null): string | undefined => {
    const carried = [
      transfer?.getData("application/x-icarus-item") ?? "",
      transfer?.getData("text/plain") ?? ""
    ].map((value) => value.trim());

    const field = carried.find((value) => fields.some((entry) => entry.value === value));
    if (field !== undefined) return field;

    const table = tables.find(
      (candidate: TableVariable) =>
        carried.includes(candidate.id) || carried.includes(candidate.name)
    );
    const first = table?.fields[0];
    return table !== undefined && first !== undefined ? `${table.name}.${first.name}` : undefined;
  };

  const sortOptions = $derived(
    result.columns.map((column: ResultColumn) => ({
      value: column.key,
      label: labelFor(column.key)
    }))
  );
</script>

<ScreenSurface wide>
  <div class="board">
    <!-- One title. The chart's own title, the state and Duplicate are the overview panel's. -->
    <ScreenHeader {title} about="The chart is the analysis. Everything under it is how it got that way." />

    <section class="stage-band">
      <div class="frame border-border-subtle bg-surface-panel rounded-panel border p-4">
        {#if kind === "table"}
          {#if shown.length === 0}
            <div class="stage stage-centre">
              <ScreenEmpty
                kind="no-matches"
                title="No rows match the conditions"
                icon={TableIcon}
                onclear={clearConditions}
              >
                Every group was filtered out by a condition set under an axis.
              </ScreenEmpty>
            </div>
          {:else}
            <!-- The result itself: the group column, then a column per measure. -->
            <div class="stage stage-scroll">
              <ScreenTable>
                {#snippet head()}
                  <tr>
                    <ScreenHeadCell>
                      <button type="button" class="head" onclick={() => inspectColumn(groupColumn)}>
                        {labelFor(groupColumn.key)}
                      </button>
                    </ScreenHeadCell>
                    {#each measures as column (column.key)}
                      <ScreenHeadCell align="end">
                        <button type="button" class="head" onclick={() => inspectColumn(column)}>
                          {labelFor(column.key)}
                        </button>
                      </ScreenHeadCell>
                    {/each}
                  </tr>
                {/snippet}

                {#each shown as row (row.id)}
                  <ScreenRow selected={isSelected("row", row.id)}>
                    <ScreenCell name={row.group} onselect={() => inspectRow(row)} />
                    {#each measures as column, index (column.key)}
                      <ScreenCell num>
                        <button type="button" class="cell" onclick={() => inspectCell(row, column)}>
                          {figure(row.values[index])}
                        </button>
                      </ScreenCell>
                    {/each}
                  </ScreenRow>
                {/each}
              </ScreenTable>
            </div>
          {/if}
        {:else if kind === "bar"}
          {#if shown.length === 0}
            <div class="stage stage-centre">
              <ScreenEmpty
                kind="no-matches"
                title="No bars match the conditions"
                icon={ChartColumn}
                onclear={clearConditions}
              >
                Every group was filtered out by a condition set under an axis.
              </ScreenEmpty>
            </div>
          {:else}
            <!--
              The plot is measured, not guessed: it takes the height the band has
              left, which is what lets the picture be the bulk of the screen at
              any window size without the screen scrolling. The inner layer is
              absolute so the svg's own height can never feed back into the
              measurement that decided it.
            -->
            <div class="stage" bind:clientHeight={stage}>
              <div class="stage-fill">
                <PlotBars
                  data={spec.data}
                  x={spec.x.field ?? groupColumn.key}
                  series={spec.series}
                  layout="overlap"
                  horizontal={spec.settings.orientation === "horizontal"}
                  labels={spec.settings.labels ?? "none"}
                  height={spec.settings.height ?? 180}
                  format={spec.settings.format ?? figure}
                  {selection}
                />
              </div>
            </div>
          {/if}

          {#if spec.settings.legend}
            <!-- Every measure, and which of them has a height. An outline is "here but not drawn". -->
            <ul class="legend">
              {#each measures as column (column.key)}
                <li class="text-caption text-ink-secondary flex items-center gap-1.5">
                  {#if column.key === drawn?.key}
                    <span
                      class="rounded-control size-3 shrink-0"
                      style="background: var({display.colours[0].token})"
                    ></span>
                  {:else}
                    <span class="border-border-strong rounded-control size-3 shrink-0 border"></span>
                  {/if}
                  {labelFor(column.key)}
                  {#if column.key !== drawn?.key}
                    <span class="text-ink-muted">· not drawn</span>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        {:else}
          {@const Icon = kindEntry.icon}
          <!--
            Selectable, present, and honest about itself. Ten of the twelve kinds
            land here; drawing an imitation nobody can tell from a real one would
            be worse than saying so.
          -->
          <div class="stage stage-centre">
            <ScreenEmpty title="{kindEntry.label} is not built yet" icon={Icon}>
              The kind is part of the vocabulary and can be chosen; only Table and Bar
              are drawn so far. The result underneath is unaffected — switch back to
              either and it is still there.
            </ScreenEmpty>
          </div>
        {/if}
      </div>

      <div class="foot">
        <div class="min-w-0 flex-1">
          <ScreenNote meta={shape}>
            Generated from current data — the result itself is not stored.
          </ScreenNote>
        </div>
        <!-- The keyboard path to the whole-chart lens; clicking the plot's background is the other. -->
        <Button variant="outline" size="sm" onclick={inspectGraph}>
          <Crosshair aria-hidden="true" />
          Inspect the chart
        </Button>
      </div>
    </section>

    <section class="customise">
      <!-- Twelve kinds, centred, wrapping rather than scrolling: all twelve are read at once. -->
      <ToggleGroup
        type="single"
        value={kind}
        variant="outline"
        size="sm"
        spacing={1}
        class="mx-auto flex-wrap justify-center"
        onValueChange={(next: string) => {
          if (next) picked = next;
        }}
      >
        {#each KINDS as entry (entry.id)}
          {@const Icon = entry.icon}
          <!-- The ten that do not draw say so on hover rather than by being greyed out. -->
          <ToggleGroupItem
            value={entry.id}
            aria-label={entry.label}
            title={isBuilt(entry.id) ? undefined : `${entry.label} is not built yet`}
          >
            <Icon aria-hidden="true" />
            {entry.label}
          </ToggleGroupItem>
        {/each}
      </ToggleGroup>

      <div class="grid-panel">
        <!--
          Buttons rather than a toggle group: pressing the option you are already
          on has to re-open its lens, and a toggle group calls nothing when the
          value does not change.
        -->
        <nav class="options" aria-label="What to customise">
          {#each OPTIONS as entry (entry.id)}
            <button
              type="button"
              class="option"
              class:on={option === entry.id}
              aria-pressed={option === entry.id}
              onclick={() => choose(entry)}
            >
              {entry.label}
            </button>
          {/each}
        </nav>

        <div class="controls">
          {#if option === "labels"}
            <!--
              A control a kind cannot answer is absent rather than greyed out —
              a table has no bars to put figures on and no orientation to take.
            -->
            <div class="control">
              <span class="text-caption text-ink-muted">Options</span>
              <!--
                A `div` and not a `label`: the switch is a button, a `label` does
                not name one, and wrapping it in one would draw an affordance
                that does nothing. The word beside it is a repeat of the
                switch's own accessible name, which is on the control.
              -->
              <div class="switch">
                <PanelToggle
                  label="Compact figures"
                  checked={compact}
                  onchange={(next) => (compact = next)}
                />
                <span class="text-body-sm text-ink-secondary">Compact figures</span>
              </div>
              {#if kind === "bar"}
                <div class="switch">
                  <PanelToggle
                    label="Figures on the bars"
                    checked={figures}
                    onchange={(next) => (figures = next)}
                  />
                  <span class="text-body-sm text-ink-secondary">Figures on the bars</span>
                </div>
                <div class="switch">
                  <PanelToggle
                    label="Bars along the side"
                    checked={sideways}
                    onchange={(next) => (sideways = next)}
                  />
                  <span class="text-body-sm text-ink-secondary">Bars along the side</span>
                </div>
              {/if}
            </div>

            <!-- Replacements are real: they name the axis, the legend and the table's headings. -->
            {#each result.columns as column (column.key)}
              <div class="control">
                <span class="text-caption text-ink-muted">Replace “{column.label}”</span>
                <PanelInput
                  label="Label for {column.label}"
                  placeholder={column.label}
                  bind:value={replacements[column.key]}
                  flush
                />
              </div>
            {/each}
          {:else}
            <!--
              The choice is held here and the lens is opened with it: this is one
              of the three that rewrites the definition, and the definition is
              what a mock door has nothing to write to.
            -->
            {@render selectData(
              option === "x-axis" ? xField : option === "y-axis" ? yField : dataField,
              (next: string) => {
                if (option === "x-axis") xPicked = next;
                else if (option === "y-axis") yPicked = next;
                else dataPicked = next;
                view.inspect(lensOf(option));
              }
            )}

            {#if option === "data"}
              <div class="control">
                <span class="text-caption text-ink-muted">Select aggregation</span>
                <PanelSelect
                  label="Aggregation"
                  value={aggregation}
                  options={aggregations.map((entry: Aggregation) => ({
                    value: entry,
                    label: entry
                  }))}
                  onchange={(next) => {
                    aggregationPicked = next;
                    view.inspect("analysis.data-button");
                  }}
                />
                <p class="text-caption text-ink-muted m-0">
                  What {typeOf(dataField)} fields permit. Changing it rewrites the definition,
                  which is the lens' job.
                </p>
              </div>
            {:else}
              <div class="control">
                <span class="text-caption text-ink-muted">Create join</span>
                <p class="text-body-sm text-ink-secondary m-0">
                  <strong>{pairing.placed[0]}</strong> and <strong>{pairing.placed[1]}</strong>
                  line up on
                  <span class="font-mono text-mono">
                    {fieldOf(pairing.key.left)} → {fieldOf(pairing.key.right)}
                  </span>
                  — {pairing.key.matched} of {pairing.key.of} match.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => view.inspect("analysis.relationship")}
                >
                  Change the join
                </Button>
              </div>

              <div class="control">
                <span class="text-caption text-ink-muted">Sort</span>
                <PanelSelect
                  label="Sort by"
                  value={sortBy}
                  options={sortOptions}
                  onchange={(next) => (sortPicked = next)}
                />
                <PanelSelect
                  label="Direction"
                  value={direction}
                  options={[
                    { value: "High to low", label: "High to low" },
                    { value: "Low to high", label: "Low to high" }
                  ]}
                  onchange={(next) => (directionPicked = next)}
                />
              </div>
            {/if}

            {@render setCondition(conditions[option])}
          {/if}
        </div>
      </div>
    </section>
  </div>
</ScreenSurface>

<!--
  A field select, and the drop target for one. `dragover` has to be cancelled or
  the browser refuses the drop outright, and cancelling it only for our own drag
  is what makes the cursor say no before the drop rather than after.
-->
{#snippet selectData(value: string, set: (next: string) => void)}
  <div
    class="control"
    role="group"
    aria-label="Select data"
    ondragover={(event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("application/x-icarus-item")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }}
    ondrop={(event: DragEvent) => {
      const dropped = droppedField(event.dataTransfer);
      if (dropped === undefined) return;
      event.preventDefault();
      set(dropped);
    }}
  >
    <span class="text-caption text-ink-muted">Select data</span>
    <PanelSelect label="Field" {value} options={fieldOptions} onchange={set} />
    <p class="text-caption text-ink-muted m-0">Or drop a table variable here.</p>
  </div>
{/snippet}

{#snippet setCondition(rule: Condition)}
  <div class="control">
    <span class="text-caption text-ink-muted">Set condition</span>
    <PanelSelect
      label="Condition field"
      value={rule.field}
      placeholder="No condition"
      options={sortOptions}
      onchange={(next) => (rule.field = next)}
    />
    <PanelSelect
      label="Operator"
      value={rule.operator}
      options={OPERATORS}
      onchange={(next) => (rule.operator = next as FilterOperator)}
    />
    <PanelInput label="Condition value" placeholder="Value" bind:value={rule.value} flush />
    <!-- What this one condition removed, then what the definition already removed before it. -->
    <p class="text-caption text-ink-muted m-0">
      {effectOf(rule)} Already filtered by {rules.map((entry) => entry.reads).join(", ")}.
    </p>
  </div>
{/snippet}

<style>
  /**
   * Title, picture, controls — and the picture takes everything the other two
   * leave. `minmax(0, 1fr)` rather than `1fr` because a grid row's automatic
   * minimum is its content, and a chart band that cannot shrink below its
   * content is the one thing that would make this screen scroll.
   */
  .board {
    display: grid;
    min-height: 0;
    flex: 1 1 auto;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: calc(var(--token-spacing-unit) * 4);
  }

  .stage-band {
    display: flex;
    min-height: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .frame {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  /*
   * Relative rather than plain, and the plot inside it absolute: the band's
   * height is decided by the grid, and nothing the renderer draws is allowed to
   * push back on it.
   */
  .stage {
    position: relative;
    min-height: 0;
    flex: 1 1 auto;
  }

  .stage-fill {
    position: absolute;
    inset: 0;
  }

  /* The one place a scroll is right: a long result inside a fixed band. */
  .stage-scroll {
    overflow: auto;
  }

  .stage-centre {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 4);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 4);
  }

  .head,
  .cell {
    border: none;
    background: none;
    padding: 0;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    cursor: pointer;
  }

  .head:hover,
  .cell:hover {
    text-decoration: underline;
  }

  .cell {
    display: block;
    width: 100%;
    min-height: calc(var(--token-spacing-unit) * 9);
    text-align: end;
  }

  .customise {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  /* The list names what the grid beside it is about, so the two are one row. */
  .grid-panel {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: calc(var(--token-spacing-unit) * 4);
    align-items: start;
  }

  .options {
    display: flex;
    min-width: calc(var(--token-spacing-unit) * 28);
    flex-direction: column;
    gap: var(--token-spacing-unit);
  }

  .option {
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 3);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    cursor: pointer;
    text-align: start;
  }

  .option:hover {
    background: var(--token-surface-panel-hover);
  }

  .option.on {
    border-color: var(--token-color-active-border);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  /* Wraps rather than scrolls: four controls is the widest any option asks for. */
  .controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(calc(var(--token-spacing-unit) * 46), 1fr));
    gap: calc(var(--token-spacing-unit) * 3);
    align-items: start;
  }

  .control {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--token-spacing-unit);
  }

  .switch {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  /* The options list stops being a column long before the plane runs out. */
  @media (max-width: 60rem) {
    .grid-panel {
      grid-template-columns: minmax(0, 1fr);
    }

    .options {
      flex-direction: row;
      flex-wrap: wrap;
    }
  }
</style>

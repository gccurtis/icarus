/**
 * An analysis: a chart definition over the project's variables, and what comes
 * back when it is run.
 *
 * `docs/screen-panel-views/context/analysis/` and `inspector/analysis/` are what
 * these serve — the Variables list with each table's fields expanded, the chart
 * kinds, the six drop zones, the compiled formula, and the lenses on a
 * placement, a filter, the sort, the limit, a mark and a relationship.
 *
 * **Nothing about a result is stored.** `resultFor`, `rowsUnder`, `lastRunOf`
 * and every match count under `relationship` are projections of running the
 * definition against the variables as they are now: replaceable, and gone the
 * moment the data moves. Only the definition persists, which is why the result
 * doors are separate doors rather than fields on the analysis record — a panel
 * that reads one is reading a fresh run, not a saved answer.
 *
 * The numbers chain, so a reviewer can follow them rather than suspect them:
 * 4,182 outage events, 2,904 after the storm-window filter, 27 after the named-
 * storm filter, 22 that find a substation to match, grouped into 6 rows out of
 * the project's 41 substations.
 */
import { RESOURCES } from "$mock-capabilities/cast";
import { read, type Read } from "$mock-capabilities/read.svelte";

/**
 * What a column holds, inferred by inspecting the value. It is what decides
 * where a field may go — and it is one label per column even when the column is
 * mixed, because there is no type for "mostly numbers with three strings in it".
 */
export type FieldType = "text" | "number" | "date" | "logic";

export type TableField = {
  readonly name: string;
  readonly type: FieldType;
};

/** A table variable with its fields expanded: here you pick a field, not a name. */
export type TableVariable = {
  readonly id: string;
  readonly name: string;
  readonly rows: number;
  readonly fields: readonly TableField[];
};

/** A scalar, or a range. Chartable as a reference line or a filter value, never on an axis. */
export type ValueVariable = {
  readonly id: string;
  readonly name: string;
  readonly type: FieldType | "range";
  readonly value: string;
  /** What it may be used for. What *dropping* one does is still undefined. */
  readonly use: string;
};

/** Visible so the name is not a surprise, never an input — a function is not a value. */
export type FunctionVariable = {
  readonly id: string;
  readonly name: string;
  /** As it is written at a call site. */
  readonly signature: string;
  readonly shape: string;
};

/**
 * A variable as the Analysis lens shows it. The authoring detail — lookup key,
 * order — is dropped here; only what can be charted survives.
 */
export type VariableLens = {
  readonly id: string;
  readonly name: string;
  readonly type: FieldType | "range" | "table" | "function";
  /** Tables only. A value has no row count and the lens must not print one. */
  readonly rows?: number;
  /** Values only. */
  readonly value?: string;
};

export type PreviewRow = {
  readonly id: string;
  readonly cells: readonly string[];
};

/** A bounded prefix of a table value: a header, the first rows, and how many there are in all. */
export type RowPreview = {
  readonly variable: string;
  readonly columns: readonly string[];
  readonly rows: readonly PreviewRow[];
  readonly total: number;
};

/**
 * One way two variables line up. `matched` and `of` are counted over the same
 * 41 substations for every candidate, so the numbers can be compared — and a
 * high one is not on its own a good key, which is what `note` is for.
 */
export type KeyPair = {
  readonly id: string;
  readonly left: string;
  readonly right: string;
  readonly matched: number;
  readonly of: number;
  readonly note: string;
};

/** What happens to rows that do not match — the part that changes the answer. */
export type JoinMode = "With a match" | "All on the left" | "All on the right" | "All of both";

/** How one variable lines up with another, and whether this chart is using it. */
export type Relation = {
  readonly id: string;
  /** The variable on the other side, named as a reader would recognise it. */
  readonly variable: string;
  readonly key: KeyPair;
  readonly used: boolean;
};

export type Relationship = {
  /** The two placed fields that made this a problem — the panel names fields, not variables. */
  readonly placed: readonly [string, string];
  /** The pairing the system picked. A guess, presented as a guess. */
  readonly key: KeyPair;
  readonly mode: JoinMode;
  readonly alternatives: readonly KeyPair[];
};

export type ChartKindId = "table" | "bar" | "line" | "area" | "scatter" | "pie";

export type ChartKind = {
  readonly id: ChartKindId;
  readonly name: string;
  /**
   * What the card says it draws with. Guidance, not a gate: the minimum-field
   * rules are undefined, so picking a kind that wants another field opens an
   * empty zone for it rather than refusing.
   */
  readonly needs: string;
};

/** A role token, never a literal colour, so a chart pasted into a slide is the deck's palette. */
export type ChartColour = {
  readonly id: string;
  readonly name: string;
  readonly token: string;
};

export type LegendPosition = "None" | "Right" | "Bottom";

export type ChartDisplay = {
  readonly kind: ChartKindId;
  /** What the picture says. Distinct from the analysis title, which is what the saved thing is called. */
  readonly title: string;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly zeroBased: boolean;
  readonly stacked: boolean;
  readonly legend: LegendPosition;
  readonly colours: readonly ChartColour[];
};

/** Colour is not a persisted encoding; that zone is a proposal, and it answers empty. */
export type PlacementAxis = "x" | "y" | "colour";

/** *Each value* is no aggregation at all, which is a real choice and belongs with the others. */
export type Aggregation = "Each value" | "Sum" | "Count" | "Average" | "Minimum" | "Maximum";

export type Placement = {
  readonly id: string;
  readonly axis: PlacementAxis;
  /** Named because two variables can both have a `name` column. */
  readonly variable: string;
  readonly field: string;
  readonly type: FieldType;
  readonly aggregation: Aggregation;
  /** What the axis says. Defaults from the field name, because `customerMinutes` is not a chart label. */
  readonly label: string;
  /** How the row reads in a zone, and how a sort names its target: `sum of customerMinutes`. */
  readonly reads: string;
};

export type FilterOperator = "is" | "is not" | "≥" | "≤" | "between";

export type FilterRule = {
  readonly id: string;
  readonly variable: string;
  readonly field: string;
  readonly type: FieldType;
  readonly operator: FilterOperator;
  /** Typed as text until there is a column-schema contract — a date picker waits on that. */
  readonly value: string;
  readonly reads: string;
  /**
   * What this one rule removed, which takes a run with it and a run without it.
   * Carried on the row because a filter with no visible effect is usually a
   * mistake, and the panel cannot say so without both numbers.
   */
  readonly rowsIn: number;
  readonly rowsKept: number;
};

export type SortRule = {
  readonly id: string;
  /**
   * The placement it orders by, never a bare source field: sorting by
   * `customerMinutes` when the chart shows `sum of customerMinutes` means
   * something else.
   */
  readonly placementId: string;
  readonly reads: string;
  readonly direction: "Low to high" | "High to low";
};

export type LimitRule = {
  readonly id: string;
  readonly keep: number;
  /** Out of how many there are. One number without the other says nothing. */
  readonly of: number;
};

/** Cost and size of the last run, for the Evaluation band and the Result section. */
export type RunStats = {
  readonly ran: string;
  readonly rows: number;
  readonly of: number;
  readonly duration: string;
};

export type ResultColumn = {
  /** Keyed by the placement that produced it: `sum of customerMinutes`. */
  readonly key: string;
  readonly label: string;
  readonly role: "group" | "measure";
};

export type ResultRow = {
  /** Stable enough to key a bar, and to ask what is underneath it. */
  readonly id: string;
  readonly group: string;
  /** One per measure column, in the order `columns` gives them. */
  readonly values: readonly number[];
};

export type AnalysisResult = {
  readonly columns: readonly ResultColumn[];
  readonly rows: readonly ResultRow[];
  /** Groups before the limit — the honest denominator for "6 of 41". */
  readonly total: number;
};

export type MarkValue = {
  /** Named by what put it there, so the picture points back at the definition. */
  readonly placement: string;
  readonly value: string;
};

export type Mark = {
  readonly id: string;
  readonly rowId: string;
  readonly values: readonly MarkValue[];
};

export type AnalysisRecord = {
  readonly id: string;
  readonly title: string;
  readonly state: "Saved" | "Saving" | "Unsaved";
  readonly revision: number;
  readonly updated: string;
  readonly updatedBy: string;
};

/** The saved analysis every door here is about: `r-minutes` in the cast. */
const SAVED = RESOURCES.find((resource) => resource.id === "r-minutes") ?? RESOURCES[0];

/** The same seven project variables the name manager holds, with the tables opened up. */
const TABLES: readonly TableVariable[] = [
  {
    id: "v-1",
    name: "outageEvents",
    rows: 4182,
    fields: [
      { name: "eventId", type: "text" },
      { name: "subId", type: "text" },
      { name: "feederId", type: "text" },
      { name: "regionId", type: "text" },
      { name: "eventDate", type: "date" },
      { name: "restoredAt", type: "date" },
      { name: "cause", type: "text" },
      { name: "customersAffected", type: "number" },
      { name: "customerMinutes", type: "number" },
      { name: "durationMinutes", type: "number" },
      { name: "crewHours", type: "number" },
      { name: "stormName", type: "text" },
      { name: "underStorm", type: "logic" }
    ]
  },
  {
    id: "v-2",
    name: "substations",
    rows: 41,
    fields: [
      { name: "id", type: "text" },
      { name: "name", type: "text" },
      { name: "regionId", type: "text" },
      { name: "undergroundPct", type: "number" },
      { name: "customersServed", type: "number" },
      { name: "commissioned", type: "date" },
      { name: "feeders", type: "number" },
      { name: "hardened", type: "logic" }
    ]
  }
];

const VALUES: readonly ValueVariable[] = [
  {
    id: "v-3",
    name: "hardeningBudget",
    type: "number",
    value: "46,000,000",
    use: "A reference line, or a number to filter against"
  },
  {
    id: "v-4",
    name: "filingDeadline",
    type: "date",
    value: "14 Nov 2026",
    use: "A reference line, or the far end of a date filter"
  },
  {
    id: "v-5",
    name: "filingParty",
    type: "text",
    value: "Northwind Power",
    use: "A filter value"
  },
  {
    id: "v-6",
    name: "feederWindow",
    type: "range",
    value: "Outages!A1:D400",
    use: "A source for a filter, not a scalar and not an axis"
  }
];

const FUNCTIONS: readonly FunctionVariable[] = [
  {
    id: "v-7",
    name: "avoidedMinutes",
    signature: "avoidedMinutes(t)",
    shape: "table → table"
  }
];

const PREVIEWS: readonly RowPreview[] = [
  {
    variable: "outageEvents",
    columns: ["eventId", "subId", "customerMinutes"],
    rows: [
      { id: "E-8841", cells: ["E-8841", "S-12", "918,400"] },
      { id: "E-8842", cells: ["E-8842", "S-12", "612,300"] },
      { id: "E-8843", cells: ["E-8843", "S-07", "44,600"] }
    ],
    total: 4182
  },
  {
    variable: "substations",
    columns: ["id", "name", "undergroundPct"],
    rows: [
      { id: "S-12", cells: ["S-12", "Feeder 12", "4"] },
      { id: "S-07", cells: ["S-07", "Ridgeview", "31"] },
      { id: "S-19", cells: ["S-19", "Alder Creek", "12"] }
    ],
    total: 41
  }
];

const KEY_SUB: KeyPair = {
  id: "k-sub",
  left: "outageEvents.subId",
  right: "substations.id",
  matched: 39,
  of: 41,
  note: "Two substations commissioned this year have no events to match yet."
};

const KEY_REGION: KeyPair = {
  id: "k-region",
  left: "outageEvents.regionId",
  right: "substations.regionId",
  matched: 41,
  of: 41,
  note: "Reaches every substation because a region is not a key — an event would match all seven in its region."
};

const KEY_FEEDER: KeyPair = {
  id: "k-feeder",
  left: "outageEvents.feederId",
  right: "substations.id",
  matched: 12,
  of: 41,
  note: "Feeder identifiers only collide with substation identifiers for the twelve rebuilt in 2024."
};

/** Only the two tables relate to anything. A scalar lines up with nothing. */
const RELATIONS: Readonly<Record<string, readonly Relation[]>> = {
  "v-1": [
    { id: "rel-1", variable: "substations", key: KEY_SUB, used: true },
    { id: "rel-2", variable: "substations", key: KEY_REGION, used: false }
  ],
  "v-2": [
    { id: "rel-3", variable: "outageEvents", key: KEY_SUB, used: true },
    { id: "rel-4", variable: "outageEvents", key: KEY_REGION, used: false }
  ]
};

const PLACEMENTS: readonly Placement[] = [
  {
    id: "p-x",
    axis: "x",
    variable: "substations",
    field: "name",
    type: "text",
    aggregation: "Each value",
    label: "Substation",
    reads: "substations.name"
  },
  {
    id: "p-y1",
    axis: "y",
    variable: "outageEvents",
    field: "customerMinutes",
    type: "number",
    aggregation: "Sum",
    label: "Customer-minutes",
    reads: "sum of customerMinutes"
  },
  {
    id: "p-y2",
    axis: "y",
    variable: "outageEvents",
    field: "eventId",
    type: "text",
    aggregation: "Count",
    label: "Events",
    reads: "count of eventId"
  }
];

/** Each aggregation set is what the type permits: a text field cannot be summed. */
const PERMITTED: Readonly<Record<FieldType, readonly Aggregation[]>> = {
  number: ["Each value", "Sum", "Count", "Average", "Minimum", "Maximum"],
  date: ["Each value", "Count", "Minimum", "Maximum"],
  text: ["Each value", "Count"],
  logic: ["Each value", "Count"]
};

/** Chained, in order: 4,182 in, 2,904 through the first, 27 through the second. */
const FILTERS: readonly FilterRule[] = [
  {
    id: "f-1",
    variable: "outageEvents",
    field: "eventDate",
    type: "date",
    operator: "≥",
    value: "2026-01-01",
    reads: "eventDate ≥ 2026-01-01",
    rowsIn: 4182,
    rowsKept: 2904
  },
  {
    id: "f-2",
    variable: "outageEvents",
    field: "underStorm",
    type: "logic",
    operator: "is",
    value: "true",
    reads: "underStorm is true",
    rowsIn: 2904,
    rowsKept: 27
  }
];

const SORT: SortRule = {
  id: "s-1",
  placementId: "p-y1",
  reads: "sum of customerMinutes",
  direction: "High to low"
};

const LIMIT: LimitRule = { id: "l-1", keep: 10, of: 41 };

const COMPILED = `=SORT(LIMIT(GROUPBY(
   FILTER(
     RELATE(outageEvents, substations, "subId", "id"),
     AND(outageEvents.eventDate >= "2026-01-01", outageEvents.underStorm)
   ),
   ["substations.name"],
   [SUM("customerMinutes"), COUNT("eventId")]
 ), 10), 2, "desc")`;

/**
 * Six rows out of 41 substations: the storm filters leave 27 events, 22 of which
 * find a substation to match. The limit of 10 does not bite, which is why the
 * caption has to carry both numbers — 6 of 41 is the true shape of the answer.
 */
const RESULT: AnalysisResult = {
  columns: [
    { key: "substations.name", label: "Substation", role: "group" },
    { key: "sum of customerMinutes", label: "Customer-minutes", role: "measure" },
    { key: "count of eventId", label: "Events", role: "measure" }
  ],
  rows: [
    { id: "row-1", group: "Feeder 12", values: [1842000, 3] },
    { id: "row-2", group: "Ridgeview", values: [1204500, 5] },
    { id: "row-3", group: "Alder Creek", values: [968400, 4] },
    { id: "row-4", group: "Kestrel Bay", values: [613750, 2] },
    { id: "row-5", group: "Harbour Point", values: [402180, 6] },
    { id: "row-6", group: "Milburn East", values: [188900, 2] }
  ],
  total: 41
};

export const analysis = (analysisId: string): Read<AnalysisRecord> => {
  void analysisId;
  return read({
    id: SAVED.id,
    title: SAVED.name,
    state: "Saved",
    revision: 12,
    updated: SAVED.updated,
    updatedBy: SAVED.updatedBy
  }, "analysis.analysis");
};

export const tablesIn = (projectId: string): Read<readonly TableVariable[]> => {
  void projectId;
  return read(TABLES, "analysis.tablesIn");
};

export const valuesIn = (projectId: string): Read<readonly ValueVariable[]> => {
  void projectId;
  return read(VALUES, "analysis.valuesIn");
};

export const functionsIn = (projectId: string): Read<readonly FunctionVariable[]> => {
  void projectId;
  return read(FUNCTIONS, "analysis.functionsIn");
};

/** Derived from the three lists, so the lens can never disagree with the row it was opened from. */
export const variable = (variableId: string): Read<VariableLens> => {
  const table = TABLES.find((candidate) => candidate.id === variableId);
  if (table !== undefined) {
    return read({ id: table.id, name: table.name, type: "table", rows: table.rows }, "analysis.variable");
  }
  const fn = FUNCTIONS.find((candidate) => candidate.id === variableId);
  if (fn !== undefined) {
    return read({ id: fn.id, name: fn.name, type: "function" }, "analysis.variable");
  }
  const value = VALUES.find((candidate) => candidate.id === variableId) ?? VALUES[0];
  return read({ id: value.id, name: value.name, type: value.type, value: value.value }, "analysis.variable");
};

/** Tables only: a scalar shows its value, not a prefix of one. */
export const previewOf = (variableId: string): Read<RowPreview> => {
  const table = TABLES.find((candidate) => candidate.id === variableId);
  return read(
    PREVIEWS.find((preview) => preview.variable === table?.name) ?? PREVIEWS[0],
    "analysis.previewOf"
  );
};

export const relationsFor = (variableId: string): Read<readonly Relation[]> =>
  read(RELATIONS[variableId] ?? [], "analysis.relationsFor");

export const chartKinds = (): Read<readonly ChartKind[]> =>
  read([
    {
      id: "table",
      name: "Table",
      needs: "Any result. It makes no encoding decisions, which is why it is the default."
    },
    { id: "bar", name: "Bar", needs: "A field on X, and at least one on Y." },
    { id: "line", name: "Line", needs: "An ordered field on X — usually a date — and a number on Y." },
    {
      id: "area",
      name: "Area",
      needs: "A line's fields, with the space beneath filled. Stacks when there is more than one series."
    },
    {
      id: "scatter",
      name: "Scatter",
      needs: "A number on X and a number on Y, one point per row, nothing summarised."
    },
    {
      id: "pie",
      name: "Pie",
      needs: "One field to split by and one number to size the slices. Unreadable past about six."
    }
  ], "analysis.chartKinds");

export const chartFor = (analysisId: string): Read<ChartDisplay> => {
  void analysisId;
  return read({
    kind: "bar",
    title: "Customer-minutes by substation, 2026 storms",
    xLabel: "Substation",
    yLabel: "Customer-minutes",
    zeroBased: true,
    stacked: false,
    legend: "Right",
    colours: [
      { id: "c-1", name: "Accent", token: "--token-color-accent-1-fill" },
      { id: "c-2", name: "Accent two", token: "--token-color-accent-2-fill" },
      { id: "c-3", name: "Interactive", token: "--token-color-interactive-fill" },
      { id: "c-4", name: "Intelligence", token: "--token-color-intelligence-fill" }
    ]
  }, "analysis.chartFor");
};

/** Answers empty for `colour`: it is a proposed zone, not something the definition can hold. */
export const placementsOn = (analysisId: string, axis: PlacementAxis): Read<readonly Placement[]> => {
  void analysisId;
  return read(PLACEMENTS.filter((placed) => placed.axis === axis), "analysis.placementsOn");
};

export const placement = (placementId: string): Read<Placement> =>
  read(PLACEMENTS.find((placed) => placed.id === placementId) ?? PLACEMENTS[0], "analysis.placement");

export const aggregationsFor = (type: FieldType): Read<readonly Aggregation[]> =>
  read(PERMITTED[type], "analysis.aggregationsFor");

export const filtersIn = (analysisId: string): Read<readonly FilterRule[]> => {
  void analysisId;
  return read(FILTERS, "analysis.filtersIn");
};

export const filter = (filterId: string): Read<FilterRule> =>
  read(FILTERS.find((rule) => rule.id === filterId) ?? FILTERS[0], "analysis.filter");

/** Null when the zone is empty. Only one sort is offered; a tiebreak would need an ordered list. */
export const sortIn = (analysisId: string): Read<SortRule | null> => {
  void analysisId;
  return read(SORT, "analysis.sortIn");
};

export const limitIn = (analysisId: string): Read<LimitRule | null> => {
  void analysisId;
  return read(LIMIT, "analysis.limitIn");
};

/** Read-only: editing it would break the round trip back to the builder, so it is a diagnostic. */
export const compiledFor = (analysisId: string): Read<string> => {
  void analysisId;
  return read(COMPILED, "analysis.compiledFor");
};

export const lastRunOf = (analysisId: string): Read<RunStats> => {
  void analysisId;
  return read(
    { ran: "2 minutes ago", rows: RESULT.rows.length, of: RESULT.total, duration: "0.4 s" },
    "analysis.lastRunOf"
  );
};

export const resultFor = (analysisId: string): Read<AnalysisResult> => {
  void analysisId;
  return read(RESULT, "analysis.resultFor");
};

export const mark = (markId: string): Read<Mark> => {
  void markId;
  return read({
    id: "m-1",
    rowId: "row-1",
    values: [
      { placement: "substations.name", value: "Feeder 12" },
      { placement: "sum of customerMinutes", value: "1,842,000" },
      { placement: "count of eventId", value: "3" }
    ]
  }, "analysis.mark");
};

/**
 * The source rows a mark was aggregated from — a second query rather than a
 * property of the result, which is why it is its own door and not a field on
 * `Mark`.
 */
export const rowsUnder = (markId: string): Read<RowPreview> => {
  void markId;
  return read({
    variable: "outageEvents",
    columns: ["eventId", "eventDate", "cause", "customerMinutes"],
    rows: [
      { id: "E-8841", cells: ["E-8841", "14 Jan 2026", "Ice loading", "918,400"] },
      { id: "E-8842", cells: ["E-8842", "14 Jan 2026", "Ice loading", "612,300"] },
      { id: "E-8877", cells: ["E-8877", "3 Feb 2026", "Relay mis-coordination", "311,300"] }
    ],
    total: 3
  }, "analysis.rowsUnder");
};

/** Present only because two variables are in play. The key is inferred, and it can be wrong. */
export const relationship = (analysisId: string): Read<Relationship> => {
  void analysisId;
  return read({
    placed: ["substations.name", "outageEvents.customerMinutes"],
    key: KEY_SUB,
    mode: "With a match",
    alternatives: [KEY_REGION, KEY_FEEDER]
  }, "analysis.relationship");
};

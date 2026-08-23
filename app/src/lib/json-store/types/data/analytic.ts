import type { FormulaValue } from "$json-store/types/content/formula-value";
import type { Id } from "$json-store/types/core/id";
import type { ChartModel, ChartNumberFormat } from "$json-store/types/data/chart";

/**
 * The authoring areas an analytic can expose. A display chooses a subset rather
 * than pretending every visual has two axes: pie has data and labels, while a
 * heatmap has x, y, data and optional labels.
 */
export type AnalyticSlot = "x" | "y" | "data" | "labels" | "size";

/**
 * One named project variable. Its current formula value is normalized to a
 * table at evaluation time; its original scalar/list/record/table shape is not
 * duplicated here and cannot become stale.
 */
export type AnalyticInput = {
  id: string;
  variable: string;
  /** A readable qualifier when the same variable is used more than once. */
  as?: string;
};

/**
 * How a table becomes a list. Column keys address body columns, row indexes
 * address data rows (headers are metadata), and a formula is a lambda over the
 * complete normalized table.
 */
export type AnalyticListSelector =
  | { kind: "column"; key: string }
  | { kind: "row"; index: number }
  | { kind: "function"; formulaId: Id<"formulas"> };

/** A qualified list anywhere in the definition. */
export type AnalyticListReference = {
  inputId: string;
  selector: AnalyticListSelector;
};

/** One dropped table and the list from it that this dimension displays. */
export type AnalyticDimensionInput = {
  id: string;
  inputId: string;
  values: AnalyticListSelector;
  label?: string;
};

export type AnalyticJoinKind = "inner" | "left" | "right" | "outer";

/**
 * Each step consumes the accumulated dimension and one not-yet-used input.
 * Their order is semantic and is exactly the top-to-bottom order shown by the
 * editor.
 */
export type AnalyticDimensionStep =
  | {
      id: string;
      kind: "extend";
      rightBindingId: string;
    }
  | {
      id: string;
      kind: "join";
      rightBindingId: string;
      leftKey: AnalyticListReference;
      rightKey: AnalyticListReference;
      /** `outer` is the default null-preserving join described by the UI. */
      join: AnalyticJoinKind;
      /** Which value becomes the displayed dimension after matching rows. */
      values: "left" | "right" | "coalesce";
    };

export type AnalyticFormulaReference = { kind: "formula"; formulaId: Id<"formulas"> };

export type AnalyticValueReference =
  | { kind: "list"; list: AnalyticListReference }
  | { kind: "operation"; operationId: string }
  | AnalyticFormulaReference;

/** Operations local to a dimension; their array order is their execution order. */
export type AnalyticDimensionOperation =
  | { id: string; kind: "filter"; predicate: AnalyticFormulaReference }
  | { id: string; kind: "group"; by: AnalyticListReference[] }
  | {
      id: string;
      kind: "sort";
      by: AnalyticValueReference | { kind: "values" };
      direction: "asc" | "desc";
    }
  | { id: string; kind: "limit"; count: number }
  | { id: string; kind: "formula"; formulaId: Id<"formulas"> };

/**
 * X and Y share this exact structure. Labels and size use it too because they
 * are also lists aligned to the materialized rows, even though they are not
 * drawn as axes.
 */
export type AnalyticDimension = {
  id: string;
  slot: Exclude<AnalyticSlot, "data">;
  inputs: AnalyticDimensionInput[];
  steps: AnalyticDimensionStep[];
  operations: AnalyticDimensionOperation[];
};

/**
 * Any relation that can feed a later join or the data pipeline. A reference is
 * explicit so evaluation never guesses that the last dimension or bridge is
 * the intended root.
 */
export type AnalyticRelationReference =
  | { kind: "input"; inputId: string }
  | { kind: "dimension"; dimensionId: string }
  | { kind: "bridge"; bridgeId: string };

/**
 * A bridge makes two independently composed dimensions one relation before the
 * data channel is evaluated. No bridge is required when their input sets
 * already overlap.
 */
export type AnalyticBridge = {
  id: string;
  kind: "join";
  /** Bridge references are evaluated top-to-bottom; a bridge may use an earlier bridge. */
  left: AnalyticRelationReference;
  right: AnalyticRelationReference;
  leftKey: AnalyticListReference;
  rightKey: AnalyticListReference;
  join: AnalyticJoinKind;
};

export type AnalyticAggregation =
  | "sum"
  | "count"
  | "average"
  | "minimum"
  | "maximum"
  | "first"
  | "last";

/**
 * The data pipeline is deliberately sequential. Filtering before sorting can
 * mean something different from filtering after it, and the model must never
 * erase that distinction by collecting operations into unordered buckets.
 */
export type AnalyticDataOperation =
  | { id: string; kind: "filter"; predicate: AnalyticFormulaReference }
  | { id: string; kind: "group"; by: AnalyticListReference[] }
  | {
      id: string;
      kind: "aggregate";
      input: AnalyticValueReference;
      aggregation: AnalyticAggregation;
      as: string;
    }
  | {
      id: string;
      kind: "sort";
      by: AnalyticValueReference;
      direction: "asc" | "desc";
    }
  | { id: string; kind: "limit"; count: number }
  | { id: string; kind: "formula"; formulaId: Id<"formulas">; as?: string };

/** One final quantitative series supplied to the visualization. */
export type AnalyticDataOutput = {
  id: string;
  label: string;
  value: AnalyticValueReference;
  format?: ChartNumberFormat;
};

export type AnalyticDataChannel = {
  /** The complete relation over which the ordered operations execute. */
  from: AnalyticRelationReference;
  operations: AnalyticDataOperation[];
  outputs: AnalyticDataOutput[];
};

/** The persisted, editable computation behind one analytic component. */
export type AnalyticDataDefinition = {
  inputs: AnalyticInput[];
  dimensions: AnalyticDimension[];
  bridges: AnalyticBridge[];
  data: AnalyticDataChannel;
};

/** Identified table output so inspector targets survive sorting and re-rendering. */
export type AnalyticTableColumn = {
  id: string;
  key: string;
  label: string;
  format?: ChartNumberFormat;
};

export type AnalyticTableCell = {
  id: string;
  columnId: string;
  value: FormulaValue;
};

export type AnalyticTableRow = {
  id: string;
  key: string;
  cells: AnalyticTableCell[];
};

export type AnalyticTableModel = {
  id: string;
  title?: string;
  columns: AnalyticTableColumn[];
  rows: AnalyticTableRow[];
};

/**
 * The single reusable output contract. Analysis, a document block, a slide and
 * a spreadsheet overlay render this same object through `AnalyticComponent`.
 */
export type AnalyticComponentModel =
  | { kind: "chart"; chart: ChartModel }
  | { kind: "table"; table: AnalyticTableModel };

/**
 * A failed edit does not erase the last good component. `stale` and `error`
 * therefore accompany that materialization with stable issue ids rather than
 * replacing it with an empty rendering.
 */
export type AnalyticMaterialization = {
  state: "ready" | "stale" | "error";
  issueIds: string[];
  evaluatedAt?: number;
};

/** A saved analytic: editable definition plus its current materialized component. */
export type AnalyticModel = {
  id: string;
  title: string;
  definition: AnalyticDataDefinition;
  component: AnalyticComponentModel;
  materialization: AnalyticMaterialization;
};

/** A live reference placed over a spreadsheet; the surface owns only geometry. */
export type SpreadsheetAnalytic = {
  id: string;
  analyticId: Id<"analyses">;
  anchor: { rowId: string; columnId: string };
  offset: { x: number; y: number };
  size: { width: number; height: number };
  zIndex?: number;
};

/** The same semantic inspector targets regardless of the surface hosting it. */
export type AnalyticTableSelectionTarget =
  | { kind: "table"; analyticId: string; tableId: string }
  | { kind: "table-column"; analyticId: string; tableId: string; columnId: string }
  | { kind: "table-row"; analyticId: string; tableId: string; rowId: string }
  | {
      kind: "table-cell";
      analyticId: string;
      tableId: string;
      rowId: string;
      columnId: string;
      cellId: string;
    };

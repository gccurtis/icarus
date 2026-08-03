// Structured Analytic canonical model.
//
// A saved analytic is the recipe for one table or chart — Tableau pills. The
// pills are the authoring surface because they are manipulable; a Formula
// expression compiled from them is the semantics. See
// scratch/structured-analytic-design/.

export type IsoTimestamp = string;

// ─── Saved record ─────────────────────────────────────────────────────────────

export interface StructuredAnalytic {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly definition: AnalyticDefinition;

  /** Compare-and-swap target for update and delete. Starts at 1. */
  readonly revision: number;

  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

// There is deliberately no `deletedAt`. Delete archives the final snapshot into
// the shared resource-history table and removes the current row.

// ─── Definition ───────────────────────────────────────────────────────────────

export interface AnalyticDefinition {
  /** Nonempty. The first input is the root of the join sequence. */
  readonly inputs: readonly AnalyticInput[];
  readonly joins: readonly AnalyticJoin[];

  readonly rows: readonly AnalyticFieldPlacement[];
  readonly columns: readonly AnalyticFieldPlacement[];
  readonly filters: readonly AnalyticFilter[];
  readonly sorts: readonly AnalyticSort[];
  readonly limit?: number;

  readonly display: AnalyticDisplay;
}

export interface AnalyticInput {
  /** Structured Data display name, stored as authored. The selector. */
  readonly name: string;
  /**
   * A second label, needed only when one definition uses the same name twice —
   * a self-join. Omitted in ordinary definitions.
   */
  readonly as?: string;
  /**
   * Best-effort record of which entry this name meant when it was saved. A
   * repair hint for rename recovery, never the selector.
   */
  readonly entryId?: string;
}

/** An input's key: its `as` label when given, otherwise its name. */
export const inputKey = (input: AnalyticInput): string => input.as ?? input.name;

export interface AnalyticFieldRef {
  /** An input key. */
  readonly input: string;
  /** Exact, case-sensitive field name in the normalized input table. */
  readonly field: string;
}

// ─── Shelf placements ─────────────────────────────────────────────────────────

export const ANALYTIC_AGGREGATIONS = [
  "none",
  "sum",
  "count",
  "average",
  "min",
  "max"
] as const;

export type AnalyticAggregation = (typeof ANALYTIC_AGGREGATIONS)[number];

export interface AnalyticFieldPlacement {
  /** Unique across Rows and Columns in one definition. */
  readonly id: string;
  readonly field: AnalyticFieldRef;
  readonly aggregation: AnalyticAggregation;
  readonly label?: string;
}

export type AnalyticShelf = "row" | "column";

/** The output column name for a placement: its label, else its source field. */
export const placementName = (placement: AnalyticFieldPlacement): string =>
  placement.label ?? placement.field.field;

// ─── Display ──────────────────────────────────────────────────────────────────

export const ANALYTIC_DISPLAY_KINDS = [
  "table",
  "bar",
  "line",
  "area",
  "scatter",
  "pie"
] as const;

export type AnalyticDisplayKind = (typeof ANALYTIC_DISPLAY_KINDS)[number];

/**
 * An object rather than a bare enum so richer renderings — side-by-side panels,
 * overlaid series, dual axes — are additive rather than a migration of every
 * persisted definition.
 */
export interface AnalyticDisplay {
  readonly kind: AnalyticDisplayKind;
}

// ─── Joins ────────────────────────────────────────────────────────────────────

export const ANALYTIC_JOIN_KINDS = ["inner", "left"] as const;

export type AnalyticJoinKind = (typeof ANALYTIC_JOIN_KINDS)[number];

export interface AnalyticJoinKey {
  readonly leftField: string;
  readonly rightField: string;
}

export interface AnalyticJoin {
  readonly kind: AnalyticJoinKind;
  /** Input keys. */
  readonly left: string;
  readonly right: string;
  /** Nonempty equality-key list. Multiple keys are ANDed. */
  readonly on: readonly AnalyticJoinKey[];
}

// ─── Filters ──────────────────────────────────────────────────────────────────

/**
 * Deliberately the scalar arm of FormulaWireValue verbatim, so filter literals
 * and result cells share one representation with no conversion layer.
 */
export type AnalyticScalar =
  | { readonly kind: "null" }
  | {
      readonly kind: "number";
      readonly numerator: string;
      readonly denominator: string;
    }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "logic"; readonly value: boolean };

export const ANALYTIC_COMPARISON_OPERATORS = [
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual"
] as const;

export type AnalyticComparisonOperator = (typeof ANALYTIC_COMPARISON_OPERATORS)[number];

export const ANALYTIC_FILTER_OPERATORS = [
  ...ANALYTIC_COMPARISON_OPERATORS,
  "in",
  "contains",
  "isNull",
  "isNotNull"
] as const;

export type AnalyticFilterOperator = (typeof ANALYTIC_FILTER_OPERATORS)[number];

export type AnalyticFilter =
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: AnalyticComparisonOperator;
      readonly value: AnalyticScalar;
    }
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: "in";
      readonly values: readonly AnalyticScalar[];
    }
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: "contains";
      readonly value: string;
      readonly caseSensitive: boolean;
    }
  | {
      readonly field: AnalyticFieldRef;
      readonly operator: "isNull" | "isNotNull";
    };

// ─── Sorts ────────────────────────────────────────────────────────────────────

export const ANALYTIC_SORT_DIRECTIONS = ["asc", "desc"] as const;

export type AnalyticSortDirection = (typeof ANALYTIC_SORT_DIRECTIONS)[number];

export interface AnalyticSort {
  /** ID of a Rows or Columns placement. */
  readonly placementId: string;
  readonly direction: AnalyticSortDirection;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export interface CreateAnalyticInput {
  readonly title: string;
  readonly description?: string;
  readonly definition: AnalyticDefinition;
}

export interface UpdateAnalyticInput {
  readonly id: string;
  readonly expectedRevision: number;
  readonly title: string;
  readonly description?: string;
  /** Complete replacement, not a patch. */
  readonly definition: AnalyticDefinition;
}

export interface DeleteAnalyticInput {
  readonly id: string;
  readonly expectedRevision: number;
}

export interface PurgeAnalyticInput {
  readonly id: string;
}

/** Save the compiled formula to Structured Data under a name. Stays live. */
export interface SaveAnalyticInput {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

/** Resolve now and store the rows as a literal table. Frozen. */
export interface CopyAnalyticInput {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export type AnalyticCommand =
  | { readonly type: "analytic.create"; readonly input: CreateAnalyticInput }
  | { readonly type: "analytic.update"; readonly input: UpdateAnalyticInput }
  | { readonly type: "analytic.delete"; readonly input: DeleteAnalyticInput }
  | { readonly type: "analytic.purge"; readonly input: PurgeAnalyticInput }
  | { readonly type: "analytic.save"; readonly input: SaveAnalyticInput }
  | { readonly type: "analytic.copy"; readonly input: CopyAnalyticInput };

export type AnalyticCommandType = AnalyticCommand["type"];

/** The Structured Data entry a save or copy produced. */
export interface AnalyticEntryRef {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
}

export type AnalyticCommandResult =
  | { readonly type: "analytic.created"; readonly analytic: StructuredAnalytic }
  | { readonly type: "analytic.updated"; readonly analytic: StructuredAnalytic }
  | { readonly type: "analytic.deleted"; readonly analyticId: string }
  | { readonly type: "analytic.purged"; readonly analyticId: string }
  | {
      readonly type: "analytic.saved";
      readonly analyticId: string;
      readonly entry: AnalyticEntryRef;
    }
  | {
      readonly type: "analytic.copied";
      readonly analyticId: string;
      readonly entry: AnalyticEntryRef;
      readonly rowCount: number;
    };

// ─── Queries ──────────────────────────────────────────────────────────────────

export type AnalyticQuery =
  | { readonly type: "analytic.get"; readonly id: string }
  | { readonly type: "analytic.list" }
  | { readonly type: "analytic.pull"; readonly id: string }
  | { readonly type: "analytic.check"; readonly id: string };

export type AnalyticQueryType = AnalyticQuery["type"];

export type AnalyticQueryResult =
  | { readonly type: "analytic.record"; readonly analytic: StructuredAnalytic }
  | {
      readonly type: "analytic.records";
      readonly analytics: readonly StructuredAnalytic[];
    }
  | { readonly type: "analytic.pull"; readonly pull: AnalyticPull }
  | { readonly type: "analytic.check"; readonly check: AnalyticCheck };

// ─── The pull ─────────────────────────────────────────────────────────────────

export type AnalyticResultKind = "number" | "text" | "logic" | "unknown" | "mixed";

export interface AnalyticResultField {
  readonly placementId: string;
  readonly name: string;
  readonly shelf: AnalyticShelf;
  readonly kind: AnalyticResultKind;
  readonly aggregation: AnalyticAggregation;
}

export type AnalyticSourceStatus = "ok" | "renamed" | "retargeted";

/** How one input resolved, and what it was, when this pull read it. */
export interface AnalyticSourceRead {
  /** The input key, so a self-join reports both sides. */
  readonly input: string;
  /** The Structured Data name that answered, current as of this pull. */
  readonly name: string;
  /** The entry that answered. Stable across renames. */
  readonly entryId: string;
  /** Revision of that entry at read time. */
  readonly revision: number | string;
  readonly status: AnalyticSourceStatus;
}

export interface AnalyticPull {
  readonly analyticId: string;
  /** The saved definition revision this calculation used. */
  readonly analyticRevision: number;
  /**
   * The pills that produced this data. Returned because compilation is one-way:
   * a client cannot recover them from the result, and an editing surface needs
   * them alongside the table.
   */
  readonly definition: AnalyticDefinition;
  readonly display: AnalyticDisplay;
  /** Rows placements first, then Columns placements, preserving shelf order. */
  readonly fields: readonly AnalyticResultField[];
  readonly rows: readonly (readonly AnalyticScalar[])[];

  /** Receipt: exactly what was read. */
  readonly sources: readonly AnalyticSourceRead[];
  readonly pulledAt: IsoTimestamp;
}

// ─── The freshness check ──────────────────────────────────────────────────────

export type AnalyticCheckStatus = AnalyticSourceStatus | "missing";

export interface AnalyticCheckSource {
  readonly input: string;
  readonly name: string;
  readonly entryId?: string;
  readonly revision?: number | string;
  readonly status: AnalyticCheckStatus;
}

export interface AnalyticCheck {
  readonly analyticId: string;
  readonly analyticRevision: number;
  readonly sources: readonly AnalyticCheckSource[];
  readonly checkedAt: IsoTimestamp;
}

// ─── Options ──────────────────────────────────────────────────────────────────

/**
 * Shape limits only — how big a recipe may be, not how big its data is. Data
 * size is Formula's business and is enforced by the evaluator.
 */
export interface StructuredAnalyticOptions {
  readonly maxAnalyticsPerProject: number;
  readonly maxInputs: number;
  readonly maxJoinKeys: number;
  readonly maxPlacements: number;
  readonly maxFilters: number;
  readonly maxSorts: number;
  readonly maxTitleBytes: number;
  readonly maxNameBytes: number;
}

export const DEFAULT_STRUCTURED_ANALYTIC_OPTIONS: StructuredAnalyticOptions = {
  maxAnalyticsPerProject: 500,
  maxInputs: 8,
  maxJoinKeys: 8,
  maxPlacements: 32,
  maxFilters: 32,
  maxSorts: 8,
  maxTitleBytes: 4_096,
  maxNameBytes: 256
};

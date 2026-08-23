/** The reusable analytic output and its table-composition contract. */
export { default as AnalyticComponent } from "./analytic-component.svelte";
export { default as AnalyticElement } from "./analytic-element.svelte";
export { default as AnalyticTableRenderer } from "./analytic-table-renderer.svelte";

export type {
  AnalyticAggregation,
  AnalyticBridge,
  AnalyticComponentModel,
  AnalyticDataChannel,
  AnalyticDataDefinition,
  AnalyticDataOperation,
  AnalyticDataOutput,
  AnalyticDimension,
  AnalyticDimensionInput,
  AnalyticDimensionOperation,
  AnalyticDimensionStep,
  AnalyticFormulaReference,
  AnalyticInput,
  AnalyticJoinKind,
  AnalyticListReference,
  AnalyticListSelector,
  AnalyticMaterialization,
  AnalyticModel,
  AnalyticRelationReference,
  AnalyticSlot,
  AnalyticTableCell,
  AnalyticTableColumn,
  AnalyticTableModel,
  AnalyticTableRow,
  AnalyticTableSelectionTarget,
  AnalyticValueReference,
  SpreadsheetAnalytic
} from "$json-store/types/data/analytic";

export {
  analyticDisplayKind,
  analyticIssues,
  assertAnalyticModel,
  compileAnalyticFormula,
  customizationSlotsFor,
  formatAnalyticValue,
  formatListSelector,
  listRequirementFor,
  normalizeAnalyticValue,
  planAnalytic,
  type AnalyticDisplayKind,
  type AnalyticIssue,
  type AnalyticIssueCode,
  type AnalyticListRequirement,
  type AnalyticPlanLine,
  type AnalyticSlotContract,
  type NormalizedAnalyticColumn,
  type NormalizedAnalyticRow,
  type NormalizedAnalyticTable
} from "./analytic-model";

import type { FormulaValue } from "$json-store/types/content/formula-value";
import type {
  AnalyticComponentModel,
  AnalyticDataOperation,
  AnalyticDimension,
  AnalyticDimensionOperation,
  AnalyticListReference,
  AnalyticListSelector,
  AnalyticModel,
  AnalyticRelationReference,
  AnalyticSlot,
  AnalyticTableModel,
  AnalyticValueReference
} from "$json-store/types/data/analytic";
import type { ChartNumberFormat, ChartType } from "$json-store/types/data/chart";
import {
  chartIssues,
  formatChartValue
} from "$lib/unique-components/chart/chart-model";

export type AnalyticDisplayKind = "table" | ChartType;

export type AnalyticSlotContract = {
  slot: AnalyticSlot;
  label: string;
  required: boolean;
  accepts: "list" | "data";
};

const listSlot = (
  slot: Exclude<AnalyticSlot, "data">,
  required: boolean
): AnalyticSlotContract => ({
  slot,
  label: slot === "x" ? "X axis" : slot === "y" ? "Y axis" : slot === "labels" ? "Labels" : "Size",
  required,
  accepts: "list"
});

const dataSlot = (): AnalyticSlotContract => ({
  slot: "data",
  label: "Data",
  required: true,
  accepts: "data"
});

/**
 * The bottom customization strip reads this exhaustive chart-specific contract.
 * Unsupported controls are absent rather than disabled decoration.
 */
export const customizationSlotsFor = (
  kind: AnalyticDisplayKind
): readonly AnalyticSlotContract[] => {
  switch (kind) {
    case "table":
      return [dataSlot()];
    case "pie":
    case "funnel":
    case "treemap":
      return [dataSlot(), listSlot("labels", true)];
    case "bubble":
      return [
        listSlot("x", true),
        listSlot("y", true),
        dataSlot(),
        listSlot("size", true),
        listSlot("labels", false)
      ];
    case "scatter":
      return [
        listSlot("x", true),
        listSlot("y", true),
        dataSlot(),
        listSlot("labels", false)
      ];
    case "mekko":
    case "heatmap":
      return [
        listSlot("x", true),
        listSlot("y", true),
        dataSlot(),
        listSlot("labels", false)
      ];
    case "bar":
    case "line":
    case "area":
    case "waterfall":
    case "radar":
      return [
        listSlot("x", true),
        listSlot("y", false),
        dataSlot(),
        listSlot("labels", false)
      ];
  }
};

export const analyticDisplayKind = (component: AnalyticComponentModel): AnalyticDisplayKind =>
  component.kind === "table" ? "table" : component.chart.type;

export type AnalyticIssueCode =
  | "duplicate-id"
  | "duplicate-slot"
  | "missing-reference"
  | "invalid-selector"
  | "invalid-order"
  | "missing-slot"
  | "unsupported-slot"
  | "missing-bridge"
  | "invalid-operation"
  | "invalid-component";

export type AnalyticIssue = {
  /** Stable enough for the materialization state and UI badges to retain. */
  id: string;
  code: AnalyticIssueCode;
  severity: "error" | "warning";
  path: string;
  message: string;
};

const issue = (
  analyticId: string,
  code: AnalyticIssueCode,
  path: string,
  message: string,
  severity: AnalyticIssue["severity"] = "error"
): AnalyticIssue => ({
  id: `${analyticId}:${code}:${path}`,
  code,
  severity,
  path,
  message
});

const selectorProblem = (selector: AnalyticListSelector): string | undefined => {
  switch (selector.kind) {
    case "column":
      return selector.key.trim() === "" ? "a column selector needs a non-empty key" : undefined;
    case "row":
      return !Number.isInteger(selector.index) || selector.index < 0
        ? "a row selector needs a non-negative integer index"
        : undefined;
    case "function":
      return selector.formulaId === "" ? "a function selector needs a formula id" : undefined;
  }
};

const formulaProblem = (formulaId: string): string | undefined =>
  formulaId.trim() === "" ? "a formula reference needs a formula id" : undefined;

const listReferencesIn = (value: AnalyticValueReference): AnalyticListReference[] =>
  value.kind === "list" ? [value.list] : [];

const listReferencesInDimensionOperation = (
  operation: AnalyticDimensionOperation
): AnalyticListReference[] => {
  switch (operation.kind) {
    case "group":
      return operation.by;
    case "sort":
      return operation.by.kind === "list" ? [operation.by.list] : [];
    case "filter":
    case "limit":
    case "formula":
      return [];
  }
};

const listReferencesInDataOperation = (
  operation: AnalyticDataOperation
): AnalyticListReference[] => {
  switch (operation.kind) {
    case "group":
      return operation.by;
    case "aggregate":
      return listReferencesIn(operation.input);
    case "sort":
      return listReferencesIn(operation.by);
    case "filter":
    case "limit":
    case "formula":
      return [];
  }
};

const relationKey = (reference: AnalyticRelationReference): string => {
  switch (reference.kind) {
    case "input":
      return `input:${reference.inputId}`;
    case "dimension":
      return `dimension:${reference.dimensionId}`;
    case "bridge":
      return `bridge:${reference.bridgeId}`;
  }
};

/** Validate an editable definition without requiring it to be complete. */
export const analyticIssues = (analytic: AnalyticModel): AnalyticIssue[] => {
  const issues: AnalyticIssue[] = [];
  const definition = analytic.definition;
  const display = analyticDisplayKind(analytic.component);
  const contracts = customizationSlotsFor(display);
  const inputById = new Map(definition.inputs.map((entry) => [entry.id, entry]));
  const dimensionBySlot = new Map(definition.dimensions.map((entry) => [entry.slot, entry]));
  const relationInputs = new Map<string, Set<string>>(
    definition.inputs.map((entry) => [relationKey({ kind: "input", inputId: entry.id }), new Set([entry.id])])
  );

  const idPaths: { id: string; path: string }[] = [
    { id: analytic.id, path: "id" },
    ...definition.inputs.map((entry, index) => ({ id: entry.id, path: `definition.inputs[${index}].id` })),
    ...definition.dimensions.flatMap((dimension, dimensionIndex) => [
      { id: dimension.id, path: `definition.dimensions[${dimensionIndex}].id` },
      ...dimension.inputs.map((entry, inputIndex) => ({
        id: entry.id,
        path: `definition.dimensions[${dimensionIndex}].inputs[${inputIndex}].id`
      })),
      ...dimension.steps.map((entry, stepIndex) => ({
        id: entry.id,
        path: `definition.dimensions[${dimensionIndex}].steps[${stepIndex}].id`
      })),
      ...dimension.operations.map((entry, operationIndex) => ({
        id: entry.id,
        path: `definition.dimensions[${dimensionIndex}].operations[${operationIndex}].id`
      }))
    ]),
    ...definition.bridges.map((entry, index) => ({ id: entry.id, path: `definition.bridges[${index}].id` })),
    ...definition.data.operations.map((entry, index) => ({
      id: entry.id,
      path: `definition.data.operations[${index}].id`
    })),
    ...definition.data.outputs.map((entry, index) => ({
      id: entry.id,
      path: `definition.data.outputs[${index}].id`
    }))
  ];
  const firstIdPath = new Map<string, string>();
  for (const entry of idPaths) {
    const first = firstIdPath.get(entry.id);
    if (first !== undefined) {
      issues.push(issue(analytic.id, "duplicate-id", entry.path, `id '${entry.id}' is already used at ${first}`));
    } else firstIdPath.set(entry.id, entry.path);
  }

  definition.inputs.forEach((entry, index) => {
    if (entry.variable.trim() === "") {
      issues.push(issue(analytic.id, "invalid-selector", `definition.inputs[${index}].variable`, "an input needs a variable name"));
    }
  });

  const seenSlots = new Set<AnalyticDimension["slot"]>();
  definition.dimensions.forEach((dimension, dimensionIndex) => {
    const path = `definition.dimensions[${dimensionIndex}]`;
    if (seenSlots.has(dimension.slot)) {
      issues.push(issue(analytic.id, "duplicate-slot", `${path}.slot`, `slot '${dimension.slot}' already has a dimension`));
    }
    seenSlots.add(dimension.slot);

    const contract = contracts.find((entry) => entry.slot === dimension.slot);
    if (contract === undefined) {
      issues.push(issue(analytic.id, "unsupported-slot", `${path}.slot`, `${display} does not expose ${dimension.slot}`));
    }
    if (dimension.inputs.length === 0) {
      issues.push(issue(analytic.id, "missing-reference", `${path}.inputs`, `${dimension.slot} needs at least one list`, "warning"));
      return;
    }

    const bindingById = new Map(dimension.inputs.map((entry) => [entry.id, entry]));
    dimension.inputs.forEach((entry, inputIndex) => {
      if (!inputById.has(entry.inputId)) {
        issues.push(issue(analytic.id, "missing-reference", `${path}.inputs[${inputIndex}].inputId`, `input '${entry.inputId}' does not exist`));
      }
      const problem = selectorProblem(entry.values);
      if (problem !== undefined) {
        issues.push(issue(analytic.id, "invalid-selector", `${path}.inputs[${inputIndex}].values`, problem));
      }
    });

    const accumulatedBindingIds = new Set<string>([dimension.inputs[0].id]);
    const accumulatedInputIds = new Set<string>([dimension.inputs[0].inputId]);
    for (const [stepIndex, step] of dimension.steps.entries()) {
      const stepPath = `${path}.steps[${stepIndex}]`;
      const right = bindingById.get(step.rightBindingId);
      if (right === undefined) {
        issues.push(issue(analytic.id, "missing-reference", `${stepPath}.rightBindingId`, `binding '${step.rightBindingId}' does not exist`));
        continue;
      }
      if (accumulatedBindingIds.has(right.id)) {
        issues.push(issue(analytic.id, "invalid-order", `${stepPath}.rightBindingId`, `binding '${right.id}' was already consumed`));
        continue;
      }
      if (step.kind === "join") {
        if (!accumulatedInputIds.has(step.leftKey.inputId)) {
          issues.push(issue(analytic.id, "invalid-order", `${stepPath}.leftKey`, "the left join key must come from the accumulated inputs above this step"));
        }
        if (step.rightKey.inputId !== right.inputId) {
          issues.push(issue(analytic.id, "invalid-order", `${stepPath}.rightKey`, "the right join key must come from the input this step adds"));
        }
        for (const [name, reference] of [["leftKey", step.leftKey], ["rightKey", step.rightKey]] as const) {
          const problem = selectorProblem(reference.selector);
          if (problem !== undefined) issues.push(issue(analytic.id, "invalid-selector", `${stepPath}.${name}.selector`, problem));
        }
      }
      accumulatedBindingIds.add(right.id);
      accumulatedInputIds.add(right.inputId);
    }
    if (accumulatedBindingIds.size !== dimension.inputs.length) {
      issues.push(issue(analytic.id, "invalid-order", `${path}.steps`, "every input after the first needs one ordered extend or join step", "warning"));
    }

    dimension.operations.forEach((operation, operationIndex) => {
      const operationPath = `${path}.operations[${operationIndex}]`;
      if (operation.kind === "group" && operation.by.length === 0) {
        issues.push(issue(analytic.id, "invalid-operation", `${operationPath}.by`, "group needs at least one list"));
      }
      if (operation.kind === "limit" && (!Number.isInteger(operation.count) || operation.count <= 0)) {
        issues.push(issue(analytic.id, "invalid-operation", `${operationPath}.count`, "limit must be a positive integer"));
      }
      if (operation.kind === "filter") {
        const problem = formulaProblem(operation.predicate.formulaId);
        if (problem !== undefined) issues.push(issue(analytic.id, "invalid-operation", `${operationPath}.predicate`, problem));
      }
      if (operation.kind === "formula") {
        const problem = formulaProblem(operation.formulaId);
        if (problem !== undefined) issues.push(issue(analytic.id, "invalid-operation", `${operationPath}.formulaId`, problem));
      }
      listReferencesInDimensionOperation(operation).forEach((reference) => {
        if (!accumulatedInputIds.has(reference.inputId)) {
          issues.push(issue(analytic.id, "missing-reference", operationPath, `input '${reference.inputId}' is not part of this dimension`));
        }
        const problem = selectorProblem(reference.selector);
        if (problem !== undefined) issues.push(issue(analytic.id, "invalid-selector", `${operationPath}.selector`, problem));
      });
    });

    relationInputs.set(
      relationKey({ kind: "dimension", dimensionId: dimension.id }),
      new Set(accumulatedInputIds)
    );
  });

  for (const contract of contracts) {
    if (contract.slot !== "data" && contract.required && !dimensionBySlot.has(contract.slot)) {
      issues.push(issue(analytic.id, "missing-slot", `definition.dimensions.${contract.slot}`, `${contract.label} is required for ${display}`, "warning"));
    }
  }
  if (definition.data.outputs.length === 0) {
    issues.push(issue(analytic.id, "missing-slot", "definition.data.outputs", `Data is required for ${display}`, "warning"));
  }

  definition.bridges.forEach((bridge, bridgeIndex) => {
    const path = `definition.bridges[${bridgeIndex}]`;
    const leftInputs = relationInputs.get(relationKey(bridge.left));
    const rightInputs = relationInputs.get(relationKey(bridge.right));
    if (leftInputs === undefined) {
      issues.push(issue(analytic.id, "missing-reference", `${path}.left`, "the left relation does not exist or is a later bridge"));
    }
    if (rightInputs === undefined) {
      issues.push(issue(analytic.id, "missing-reference", `${path}.right`, "the right relation does not exist or is a later bridge"));
    }
    for (const [name, reference] of [["leftKey", bridge.leftKey], ["rightKey", bridge.rightKey]] as const) {
      const problem = selectorProblem(reference.selector);
      if (problem !== undefined) issues.push(issue(analytic.id, "invalid-selector", `${path}.${name}.selector`, problem));
    }
    if (leftInputs === undefined || rightInputs === undefined) return;
    if (!leftInputs.has(bridge.leftKey.inputId) || !rightInputs.has(bridge.rightKey.inputId)) {
      issues.push(issue(analytic.id, "missing-reference", path, "each bridge key must come from the relation on its side"));
      return;
    }
    relationInputs.set(
      relationKey({ kind: "bridge", bridgeId: bridge.id }),
      new Set([...leftInputs, ...rightInputs])
    );
  });

  const dataInputs = relationInputs.get(relationKey(definition.data.from));
  if (dataInputs === undefined) {
    issues.push(issue(analytic.id, "missing-reference", "definition.data.from", "the data relation does not exist or points to a later bridge"));
  } else {
    for (const dimension of definition.dimensions) {
      const own = relationInputs.get(relationKey({ kind: "dimension", dimensionId: dimension.id }));
      if (own !== undefined && [...own].some((inputId) => !dataInputs.has(inputId))) {
        issues.push(issue(
          analytic.id,
          "missing-bridge",
          "definition.data.from",
          `${dimension.slot} uses a disconnected table set; join it into the data relation before computing values`,
          "warning"
        ));
      }
    }
  }

  const validateDataList = (reference: AnalyticListReference, path: string) => {
    if (!inputById.has(reference.inputId)) {
      issues.push(issue(analytic.id, "missing-reference", path, `input '${reference.inputId}' does not exist`));
      return;
    }
    const problem = selectorProblem(reference.selector);
    if (problem !== undefined) issues.push(issue(analytic.id, "invalid-selector", `${path}.selector`, problem));
    if (dataInputs !== undefined && !dataInputs.has(reference.inputId)) {
      issues.push(issue(
        analytic.id,
        "missing-bridge",
        path,
        `input '${reference.inputId}' is not part of the data relation; add a join before using it`,
        "warning"
      ));
    }
  };

  const completedOperations = new Set<string>();
  definition.data.operations.forEach((operation, operationIndex) => {
    const path = `definition.data.operations[${operationIndex}]`;
    if (operation.kind === "group" && operation.by.length === 0) {
      issues.push(issue(analytic.id, "invalid-operation", `${path}.by`, "group needs at least one list"));
    }
    if (operation.kind === "limit" && (!Number.isInteger(operation.count) || operation.count <= 0)) {
      issues.push(issue(analytic.id, "invalid-operation", `${path}.count`, "limit must be a positive integer"));
    }
    if (operation.kind === "filter") {
      const problem = formulaProblem(operation.predicate.formulaId);
      if (problem !== undefined) issues.push(issue(analytic.id, "invalid-operation", `${path}.predicate`, problem));
    }
    if (operation.kind === "formula") {
      const problem = formulaProblem(operation.formulaId);
      if (problem !== undefined) issues.push(issue(analytic.id, "invalid-operation", `${path}.formulaId`, problem));
    }
    const references: AnalyticValueReference[] = [];
    if (operation.kind === "aggregate") references.push(operation.input);
    if (operation.kind === "sort") references.push(operation.by);
    for (const reference of references) {
      if (reference.kind === "operation" && !completedOperations.has(reference.operationId)) {
        issues.push(issue(analytic.id, "invalid-order", path, `operation '${reference.operationId}' must appear above this use`));
      }
      if (reference.kind === "formula") {
        const problem = formulaProblem(reference.formulaId);
        if (problem !== undefined) issues.push(issue(analytic.id, "invalid-operation", path, problem));
      }
    }
    for (const reference of listReferencesInDataOperation(operation)) validateDataList(reference, path);
    completedOperations.add(operation.id);
  });

  definition.data.outputs.forEach((output, outputIndex) => {
    const path = `definition.data.outputs[${outputIndex}].value`;
    if (output.label.trim() === "") {
      issues.push(issue(analytic.id, "invalid-operation", `definition.data.outputs[${outputIndex}].label`, "a data output needs a label"));
    }
    if (output.value.kind === "operation" && !completedOperations.has(output.value.operationId)) {
      issues.push(issue(analytic.id, "missing-reference", path, `operation '${output.value.operationId}' does not exist`));
    }
    if (output.value.kind === "list") validateDataList(output.value.list, path);
    if (output.value.kind === "formula") {
      const problem = formulaProblem(output.value.formulaId);
      if (problem !== undefined) issues.push(issue(analytic.id, "invalid-operation", path, problem));
    }
  });

  if (analytic.materialization.state === "ready" && analytic.materialization.issueIds.length > 0) {
    issues.push(issue(analytic.id, "invalid-component", "materialization.issueIds", "a ready materialization cannot carry unresolved issue ids"));
  }

  if (analytic.component.kind === "chart") {
    chartIssues(analytic.component.chart).forEach((chartIssue) => {
      issues.push(issue(analytic.id, "invalid-component", `component.chart.${chartIssue.path}`, chartIssue.message));
    });
  } else {
    issues.push(...tableIssues(analytic.id, analytic.component.table));
  }

  return issues;
};

const tableIssues = (analyticId: string, table: AnalyticTableModel): AnalyticIssue[] => {
  const issues: AnalyticIssue[] = [];
  const ids = new Set<string>([table.id]);
  const columnIds = new Set<string>();
  const columnKeys = new Set<string>();
  table.columns.forEach((column, index) => {
    if (ids.has(column.id)) {
      issues.push(issue(analyticId, "duplicate-id", `component.table.columns[${index}].id`, `id '${column.id}' is duplicated`));
    }
    if (columnKeys.has(column.key)) {
      issues.push(issue(analyticId, "duplicate-id", `component.table.columns[${index}].key`, `column key '${column.key}' is duplicated`));
    }
    ids.add(column.id);
    columnIds.add(column.id);
    columnKeys.add(column.key);
  });
  const rowKeys = new Set<string>();
  table.rows.forEach((row, rowIndex) => {
    if (ids.has(row.id)) issues.push(issue(analyticId, "duplicate-id", `component.table.rows[${rowIndex}].id`, `id '${row.id}' is duplicated`));
    ids.add(row.id);
    if (rowKeys.has(row.key)) issues.push(issue(analyticId, "duplicate-id", `component.table.rows[${rowIndex}].key`, `row key '${row.key}' is duplicated`));
    rowKeys.add(row.key);
    const seenColumns = new Set<string>();
    row.cells.forEach((cell, cellIndex) => {
      const path = `component.table.rows[${rowIndex}].cells[${cellIndex}]`;
      if (ids.has(cell.id)) issues.push(issue(analyticId, "duplicate-id", `${path}.id`, `id '${cell.id}' is duplicated`));
      ids.add(cell.id);
      if (!columnIds.has(cell.columnId)) issues.push(issue(analyticId, "missing-reference", `${path}.columnId`, `column '${cell.columnId}' does not exist`));
      if (seenColumns.has(cell.columnId)) issues.push(issue(analyticId, "invalid-component", `${path}.columnId`, `row '${row.id}' has more than one cell for column '${cell.columnId}'`));
      seenColumns.add(cell.columnId);
    });
    for (const columnId of columnIds) {
      if (!seenColumns.has(columnId)) issues.push(issue(analyticId, "missing-reference", `component.table.rows[${rowIndex}].cells`, `row '${row.id}' has no cell for column '${columnId}'`));
    }
  });
  return issues;
};

export const assertAnalyticModel = (analytic: AnalyticModel): void => {
  const first = analyticIssues(analytic).find((entry) => entry.severity === "error");
  if (first !== undefined) throw new Error(`${first.path}: ${first.message}`);
};

const quoted = (value: string) => JSON.stringify(value);

export const formatListSelector = (inputName: string, selector: AnalyticListSelector): string => {
  switch (selector.kind) {
    case "column":
      return `${inputName}[${quoted(selector.key)}]`;
    case "row":
      return `ROW(${inputName}, ${selector.index})`;
    case "function":
      return `APPLY(FORMULA(${quoted(selector.formulaId)}), ${inputName})`;
  }
};

export type AnalyticPlanLine = {
  id: string;
  scope: "input" | AnalyticSlot | "bridge" | "component";
  expression: string;
};

const valueExpression = (
  value: AnalyticValueReference,
  inputName: (inputId: string) => string
): string => {
  switch (value.kind) {
    case "list":
      return formatListSelector(inputName(value.list.inputId), value.list.selector);
    case "operation":
      return `$${value.operationId}`;
    case "formula":
      return `FORMULA(${quoted(value.formulaId)})`;
  }
};

/**
 * A canonical, formula-shaped explanation of the ordered evaluation. It is
 * intentionally readable now and can become the Formula compiler's input
 * without changing the persisted definition.
 */
export const planAnalytic = (analytic: AnalyticModel): AnalyticPlanLine[] => {
  const lines: AnalyticPlanLine[] = [];
  const inputs = new Map(analytic.definition.inputs.map((entry) => [entry.id, entry]));
  const relationExpressions = new Map<string, string>();
  const inputName = (inputId: string) => {
    const input = inputs.get(inputId);
    return input === undefined ? `$missing_${inputId}` : `$${input.as ?? input.variable}`;
  };

  analytic.definition.inputs.forEach((input) => {
    relationExpressions.set(relationKey({ kind: "input", inputId: input.id }), inputName(input.id));
    lines.push({
      id: input.id,
      scope: "input",
      expression: `${inputName(input.id)} = TABLE(${quoted(input.variable)})`
    });
  });

  analytic.definition.dimensions.forEach((dimension) => {
    if (dimension.inputs.length === 0) {
      relationExpressions.set(
        relationKey({ kind: "dimension", dimensionId: dimension.id }),
        `$missing_${dimension.id}`
      );
      return;
    }
    const bindingById = new Map(dimension.inputs.map((entry) => [entry.id, entry]));
    let expression = `DIMENSION(${inputName(dimension.inputs[0].inputId)}, ${formatListSelector(inputName(dimension.inputs[0].inputId), dimension.inputs[0].values)})`;
    for (const step of dimension.steps) {
      const right = bindingById.get(step.rightBindingId);
      if (right === undefined) continue;
      const rightValues = formatListSelector(inputName(right.inputId), right.values);
      if (step.kind === "extend") expression = `EXTEND_DIMENSION(${expression}, ${inputName(right.inputId)}, ${rightValues})`;
      else {
        expression = `DIMENSION_JOIN(${expression}, ${inputName(right.inputId)}, ${step.join.toUpperCase()}, ${formatListSelector(inputName(step.leftKey.inputId), step.leftKey.selector)} = ${formatListSelector(inputName(step.rightKey.inputId), step.rightKey.selector)}, ${step.values.toUpperCase()}_VALUES(${rightValues}))`;
      }
    }
    lines.push({ id: dimension.id, scope: dimension.slot, expression: `$${dimension.id} = ${expression}` });
    let current = `$${dimension.id}`;
    for (const operation of dimension.operations) {
      switch (operation.kind) {
        case "filter":
          lines.push({ id: operation.id, scope: dimension.slot, expression: `$${operation.id} = FILTER(${current}, FORMULA(${quoted(operation.predicate.formulaId)}))` });
          break;
        case "group":
          lines.push({ id: operation.id, scope: dimension.slot, expression: `$${operation.id} = GROUP(${current}, ${operation.by.map((entry) => formatListSelector(inputName(entry.inputId), entry.selector)).join(", ")})` });
          break;
        case "sort":
          lines.push({ id: operation.id, scope: dimension.slot, expression: `$${operation.id} = SORT(${current}, ${operation.by.kind === "values" ? "VALUES" : valueExpression(operation.by, inputName)}, ${operation.direction.toUpperCase()})` });
          break;
        case "limit":
          lines.push({ id: operation.id, scope: dimension.slot, expression: `$${operation.id} = LIMIT(${current}, ${operation.count})` });
          break;
        case "formula":
          lines.push({ id: operation.id, scope: dimension.slot, expression: `$${operation.id} = APPLY(FORMULA(${quoted(operation.formulaId)}), ${current})` });
          break;
      }
      current = `$${operation.id}`;
    }
    relationExpressions.set(
      relationKey({ kind: "dimension", dimensionId: dimension.id }),
      current
    );
  });

  const relationExpression = (reference: AnalyticRelationReference): string =>
    relationExpressions.get(relationKey(reference)) ?? `$missing_${relationKey(reference).replace(":", "_")}`;

  analytic.definition.bridges.forEach((bridge) => {
    const left = relationExpression(bridge.left);
    const right = relationExpression(bridge.right);
    lines.push({
      id: bridge.id,
      scope: "bridge",
      expression: `$${bridge.id} = ${bridge.join.toUpperCase()}_JOIN(${left}, ${right}, ${formatListSelector(inputName(bridge.leftKey.inputId), bridge.leftKey.selector)} = ${formatListSelector(inputName(bridge.rightKey.inputId), bridge.rightKey.selector)})`
    });
    relationExpressions.set(relationKey({ kind: "bridge", bridgeId: bridge.id }), `$${bridge.id}`);
  });

  let dataCurrent = relationExpression(analytic.definition.data.from);
  analytic.definition.data.operations.forEach((operation) => {
    switch (operation.kind) {
      case "filter":
        lines.push({ id: operation.id, scope: "data", expression: `$${operation.id} = FILTER(${dataCurrent}, FORMULA(${quoted(operation.predicate.formulaId)}))` });
        break;
      case "group":
        lines.push({ id: operation.id, scope: "data", expression: `$${operation.id} = GROUP(${dataCurrent}, ${operation.by.map((entry) => formatListSelector(inputName(entry.inputId), entry.selector)).join(", ")})` });
        break;
      case "aggregate":
        lines.push({ id: operation.id, scope: "data", expression: `$${operation.id} = AGGREGATE(${dataCurrent}, ${operation.aggregation.toUpperCase()}(${valueExpression(operation.input, inputName)}) AS ${quoted(operation.as)})` });
        break;
      case "sort":
        lines.push({ id: operation.id, scope: "data", expression: `$${operation.id} = SORT(${dataCurrent}, ${valueExpression(operation.by, inputName)}, ${operation.direction.toUpperCase()})` });
        break;
      case "limit":
        lines.push({ id: operation.id, scope: "data", expression: `$${operation.id} = LIMIT(${dataCurrent}, ${operation.count})` });
        break;
      case "formula":
        lines.push({ id: operation.id, scope: "data", expression: `$${operation.id} = APPLY(FORMULA(${quoted(operation.formulaId)}), ${dataCurrent})${operation.as === undefined ? "" : ` AS ${quoted(operation.as)}`}` });
        break;
    }
    dataCurrent = `$${operation.id}`;
  });

  lines.push({
    id: `${analytic.id}-component`,
    scope: "component",
    expression: analytic.component.kind === "table"
      ? `TABLE_COMPONENT(${analytic.definition.data.outputs.map((entry) => valueExpression(entry.value, inputName)).join(", ")})`
      : `CHART_COMPONENT(${quoted(analytic.component.chart.type)}, ${analytic.definition.data.outputs.map((entry) => valueExpression(entry.value, inputName)).join(", ")})`
  });
  return lines;
};

export const compileAnalyticFormula = (analytic: AnalyticModel): string =>
  `LET(\n${planAnalytic(analytic).map((line) => `  ${line.expression}`).join(",\n")}\n)`;

export type NormalizedAnalyticColumn = { key: string; label: string };
export type NormalizedAnalyticRow = { id: string; values: Record<string, FormulaValue> };
export type NormalizedAnalyticTable = {
  id: string;
  columns: NormalizedAnalyticColumn[];
  rows: NormalizedAnalyticRow[];
};

const empty: FormulaValue = { kind: "empty" };

const uniqueColumnKeys = (labels: readonly (string | undefined)[]): NormalizedAnalyticColumn[] => {
  const used = new Set<string>();
  return labels.map((label, index) => {
    const base = label?.trim() || `column-${index + 1}`;
    let key = base;
    let suffix = 2;
    while (used.has(key)) key = `${base}-${suffix++}`;
    used.add(key);
    return { key, label: label?.trim() || `Column ${index + 1}` };
  });
};

/** Normalize every resolved formula value into the one table algebra analytics uses. */
export const normalizeAnalyticValue = (
  inputId: string,
  value: FormulaValue
): NormalizedAnalyticTable => {
  if (value.kind === "range") throw new Error("a range must be resolved before analytic normalization");
  if (value.kind === "function") throw new Error("a function must be applied before analytic normalization");
  if (value.kind === "table") {
    const columns = uniqueColumnKeys(value.columns.map((column) => column.name));
    return {
      id: inputId,
      columns,
      rows: value.rows.map((row, rowIndex) => ({
        id: `${inputId}:row:${rowIndex}`,
        values: Object.fromEntries(columns.map((column, columnIndex) => [column.key, row[columnIndex] ?? empty]))
      }))
    };
  }
  if (value.kind === "record") {
    const columns = uniqueColumnKeys(Object.keys(value.fields));
    const sourceKeys = Object.keys(value.fields);
    return {
      id: inputId,
      columns,
      rows: [{
        id: `${inputId}:row:0`,
        values: Object.fromEntries(columns.map((column, index) => [column.key, value.fields[sourceKeys[index]] ?? empty]))
      }]
    };
  }
  if (value.kind === "list") {
    return {
      id: inputId,
      columns: [{ key: "value", label: "Value" }],
      rows: value.values.map((entry, index) => ({ id: `${inputId}:row:${index}`, values: { value: entry } }))
    };
  }
  return {
    id: inputId,
    columns: [{ key: "value", label: "Value" }],
    rows: [{ id: `${inputId}:row:0`, values: { value } }]
  };
};

export type AnalyticListRequirement =
  | { state: "ready"; selector: AnalyticListSelector }
  | {
      state: "needs-list";
      message: string;
      detail: string;
      choices: readonly ("column" | "row" | "function")[];
    };

/** The compact warning and the inspector explanation come from one decision. */
export const listRequirementFor = (value: FormulaValue): AnalyticListRequirement => {
  if (value.kind === "list" || ["empty", "number", "text", "logic", "date"].includes(value.kind)) {
    return { state: "ready", selector: { kind: "column", key: "value" } };
  }
  return {
    state: "needs-list",
    message: "Needs a list, not a table",
    detail: "Choose any body column or data row from the normalized table, or define a function that returns a list. Headers label columns and are not included in their values.",
    choices: ["column", "row", "function"]
  };
};

export const formatAnalyticValue = (
  value: FormulaValue,
  format?: ChartNumberFormat
): string => {
  switch (value.kind) {
    case "empty":
      return "";
    case "number":
      return formatChartValue(value.value, format);
    case "text":
      return value.value;
    case "logic":
      return value.value ? "True" : "False";
    case "date":
      return `${value.value.year.toString().padStart(4, "0")}-${value.value.month.toString().padStart(2, "0")}-${value.value.day.toString().padStart(2, "0")}`;
    case "list":
      return `${value.values.length} values`;
    case "record":
      return `${Object.keys(value.fields).length} fields`;
    case "table":
      return `${value.rows.length} × ${value.columns.length}`;
    case "range":
      return "Spreadsheet range";
    case "function":
      return `Function(${value.parameters.join(", ")})`;
  }
};

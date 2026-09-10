import type { StoreUnitOfWork } from "$model/server/store/index.server";
import { addressesIn, writeAddress } from "$representation/data/behavior/formulas/addresses";
import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import { isStoredSpreadsheetSnapshot } from "$representation/data/behavior/spreadsheets/stored-snapshot";
import {
  isStoredDataBackReference,
  isStoredFormula
} from "$representation/data/behavior/spreadsheets/stored-formula";
import {
  recalculated,
  sourceOf,
  type SheetSource,
  type Surroundings
} from "$representation/data/behavior/spreadsheets/formulas";
import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { Id } from "$representation/data/types/core/id";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";

import { cellsOf, cellRowsOf } from "$capabilities/spreadsheet/api/shared/cells";
import type { StoreReads } from "$capabilities/spreadsheet/api/shared/ports";

/**
 * Everything a formula in this project can reach.
 *
 * The capability is the one place that can see all of it at once, which is why
 * it is the authority on what a formula answers: a client sees the sheet it has
 * open, and this sees the project.
 */
export const surroundingsOf = (
  store: StoreReads,
  projectId: Id<"projects">,
  here: Id<"spreadsheets">
): Surroundings => {
  const names = new Map<string, FormulaValue>();
  const variables = store.read("variables");
  if (variables?.table === "variables" && variables.kind === "table") {
    for (const row of variables.rows) {
      if (row.projectId !== projectId) continue;
      names.set(row.name.toLowerCase(), row.value);
    }
  }

  const sheets = new Map<string, SheetSource>();
  const snapshots = store.read("spreadsheetSnapshots");
  if (snapshots?.table === "spreadsheetSnapshots" && snapshots.kind === "table") {
    if (!snapshots.rows.every(isStoredSpreadsheetSnapshot)) {
      throw new Error("the spreadsheetSnapshots table contains a non-current row");
    }
    for (const row of snapshots.rows) {
      if (row.projectId !== projectId || row.role !== "leader") continue;
      if (row.resourceId === here) continue;
      const cells = cellsOf(cellRowsOf(store, projectId, row.resourceId));
      sheets.set(row.resourceId, sourceOf(row.resourceId, { body: row.body, cells }));
    }
  }

  return {
    variable: (name) => names.get(name.toLowerCase()),
    sheetAt: (resourceId) => sheets.get(resourceId)
  };
};

/** The sheet with every formula in it answered. */
export const answered = (
  store: StoreReads,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">,
  sheet: LiveSheet
): LiveSheet => {
  const source = sourceOf(resourceId, sheet);
  const ops = recalculated(source, surroundingsOf(store, projectId, resourceId));
  return ops.length === 0 ? sheet : applyOps(sheet, ops);
};

const usedBy = (resourceId: Id<"spreadsheets">, key: string) => ({
  in: "resource" as const,
  ref: { kind: "spreadsheet", id: resourceId },
  path: key
});

/**
 * The `formulas` rows and the back references that go with the sheet's cells.
 *
 * One row per distinct formula, keyed by what it says: two cells holding the
 * same formula hold the same row, which is what makes `usedBy` worth reading.
 * A cell learns its row's id, so nothing has to search by text later.
 */
export const writeFormulas = (
  unit: StoreUnitOfWork,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">,
  sheet: LiveSheet
): LiveSheet => {
  const rows = unit.read("formulas");
  const all = rows?.table === "formulas" && rows.kind === "table" ? rows.rows : [];
  if (!all.every(isStoredFormula)) {
    throw new Error("the formulas table contains a non-current row");
  }
  const held = all.filter((row) => row.projectId === projectId);
  const usesById = new Map(held.map((row) => [row._id, row.usedBy]));
  const byText = new Map(held.map((row) => [row.representation, row]));

  const at = Date.now();
  const wanted = new Map<string, string[]>();
  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (cell.expression === undefined) continue;
    wanted.set(cell.expression, [...(wanted.get(cell.expression) ?? []), key]);
  }

  const idOf = new Map<string, Id<"formulas">>();
  for (const [representation, keys] of wanted) {
    const existing = byText.get(representation);
    const uses = [
      ...(existing === undefined ? [] : usesById.get(existing._id)!).filter(
        (use) =>
          !(
            use.in === "resource" &&
            use.ref.kind === "spreadsheet" &&
            use.ref.id === resourceId
          )
      ),
      ...keys.map((key) => usedBy(resourceId, key))
    ];
    if (existing === undefined) {
      const id = unit.create("formulas", { projectId, representation, usedBy: uses, updatedAt: at }) as Id<"formulas">;
      idOf.set(representation, id);
      writeBackReferences(unit, projectId, id, representation, at);
      continue;
    }
    idOf.set(representation, existing._id);
    if (JSON.stringify(existing.usedBy) !== JSON.stringify(uses)) {
      unit.update(`formulas.${existing._id}`, {
        projectId: existing.projectId,
        representation: existing.representation,
        usedBy: uses,
        updatedAt: at
      });
    }
  }

  for (const row of held) {
    if (wanted.has(row.representation)) continue;
    const previous = usesById.get(row._id)!;
    const kept = previous.filter(
      (use) =>
        !(
          use.in === "resource" &&
          use.ref.kind === "spreadsheet" &&
          use.ref.id === resourceId
        )
    );
    if (kept.length === previous.length) continue;
    if (kept.length === 0) {
      unit.remove(`formulas.${row._id}`);
      clearBackReferences(unit, row._id);
      continue;
    }
    unit.update(`formulas.${row._id}`, {
      projectId: row.projectId,
      representation: row.representation,
      usedBy: kept,
      updatedAt: at
    });
  }

  const cells = { ...sheet.cells };
  for (const [key, cell] of Object.entries(cells)) {
    const wantedId = cell.expression === undefined ? undefined : idOf.get(cell.expression);
    if (cell.formulaId === wantedId) continue;
    if (wantedId === undefined) {
      const { formulaId: _formulaId, ...withoutFormula } = cell;
      cells[key] = withoutFormula;
    } else {
      cells[key] = { ...cell, formulaId: wantedId };
    }
  }
  return { ...sheet, cells };
};

const clearBackReferences = (unit: StoreUnitOfWork, formulaId: Id<"formulas">): void => {
  const rows = unit.read("dataBackReferences");
  if (rows?.table !== "dataBackReferences" || rows.kind !== "table") return;
  if (!rows.rows.every(isStoredDataBackReference)) {
    throw new Error("the dataBackReferences table contains a non-current row");
  }
  for (const row of rows.rows) {
    if (row.formulaId === formulaId) unit.remove(`dataBackReferences.${row._id}`);
  }
};

/** What one formula points at, stored so the graph does not have to be re-read from text. */
const writeBackReferences = (
  unit: StoreUnitOfWork,
  projectId: Id<"projects">,
  formulaId: Id<"formulas">,
  representation: string,
  at: number
): void => {
  for (const address of addressesIn(representation)) {
    if (address.at === "resource") {
      unit.create("dataBackReferences", {
        projectId,
        formulaId,
        targetKind: "name",
        target: writeAddress(address),
        updatedAt: at
      });
      continue;
    }
    if (address.at === "cell") {
      unit.create("dataBackReferences", {
        projectId,
        formulaId,
        targetKind: "cell",
        target: `${address.resourceId}|${address.cell.rowId}|${address.cell.columnId}`,
        updatedAt: at
      });
      continue;
    }
    unit.create("dataBackReferences", {
      projectId,
      formulaId,
      targetKind: "range",
      target: `${address.resourceId}|${address.range.from.rowId}|${address.range.from.columnId}`,
      to: `${address.resourceId}|${address.range.to.rowId}|${address.range.to.columnId}`,
      updatedAt: at
    });
  }
};

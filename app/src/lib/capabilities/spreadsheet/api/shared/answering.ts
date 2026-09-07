import type { StoreModel } from "$model/server/store/index.server";
import { addressesIn, writeAddress } from "$representation/data/behavior/formulas/addresses";
import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import { emptyBody } from "$representation/data/behavior/spreadsheets/empty-sheet";
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

/**
 * Everything a formula in this project can reach.
 *
 * The capability is the one place that can see all of it at once, which is why
 * it is the authority on what a formula answers: a client sees the sheet it has
 * open, and this sees the project.
 */
export const surroundingsOf = (
  store: StoreModel,
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
    for (const row of snapshots.rows) {
      if (row.projectId !== projectId || row.role !== "leader") continue;
      if (row.resourceId === here) continue;
      const cells = cellsOf(cellRowsOf(store, projectId, row.resourceId));
      sheets.set(row.resourceId, sourceOf(row.resourceId, { body: row.body ?? emptyBody(), cells }));
    }
  }

  return {
    variable: (name) => names.get(name.toLowerCase()),
    sheetAt: (resourceId) => sheets.get(resourceId)
  };
};

/** The sheet with every formula in it answered. */
export const answered = (
  store: StoreModel,
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
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">,
  sheet: LiveSheet
): LiveSheet => {
  const rows = store.read("formulas");
  const held = rows?.table === "formulas" && rows.kind === "table" ? rows.rows.filter((row) => row.projectId === projectId) : [];
  const byText = new Map(held.map((row) => [row.representation, row]));

  const at = Date.now();
  const wanted = new Map<string, string[]>();
  for (const [key, cell] of Object.entries(sheet.cells)) {
    if (cell.expression === undefined) continue;
    wanted.set(cell.expression, [...(wanted.get(cell.expression) ?? []), key]);
  }

  const idOf = new Map<string, Id<"formulas">>();
  for (const [representation, keys] of wanted) {
    const uses = keys.map((key) => usedBy(resourceId, key));
    const existing = byText.get(representation);
    if (existing === undefined) {
      const id = store.create("formulas", { projectId, representation, usedBy: uses, updatedAt: at }) as Id<"formulas">;
      idOf.set(representation, id);
      writeBackReferences(store, projectId, id, representation, at);
      continue;
    }
    idOf.set(representation, existing._id);
    if (JSON.stringify(existing.usedBy) !== JSON.stringify(uses)) {
      store.update(`formulas.${existing._id}`, { ...existing, usedBy: uses, updatedAt: at });
    }
  }

  for (const row of held) {
    if (wanted.has(row.representation)) continue;
    const kept = (row.usedBy ?? []).filter((use) => !(use.in === "resource" && use.ref.id === resourceId));
    if (kept.length === (row.usedBy ?? []).length) continue;
    if (kept.length === 0) {
      store.remove(`formulas.${row._id}`);
      clearBackReferences(store, row._id);
      continue;
    }
    store.update(`formulas.${row._id}`, { ...row, usedBy: kept, updatedAt: at });
  }

  const cells = { ...sheet.cells };
  for (const [key, cell] of Object.entries(cells)) {
    const wantedId = cell.expression === undefined ? undefined : idOf.get(cell.expression);
    if (cell.formulaId === wantedId) continue;
    cells[key] = wantedId === undefined ? { ...cell, formulaId: undefined } : { ...cell, formulaId: wantedId };
  }
  return { ...sheet, cells };
};

const clearBackReferences = (store: StoreModel, formulaId: Id<"formulas">): void => {
  const rows = store.read("dataBackReferences");
  if (rows?.table !== "dataBackReferences" || rows.kind !== "table") return;
  for (const row of rows.rows) {
    if (row.formulaId === formulaId) store.remove(`dataBackReferences.${row._id}`);
  }
};

/** What one formula points at, stored so the graph does not have to be re-read from text. */
const writeBackReferences = (
  store: StoreModel,
  projectId: Id<"projects">,
  formulaId: Id<"formulas">,
  representation: string,
  at: number
): void => {
  for (const address of addressesIn(representation)) {
    if (address.at === "resource") {
      store.create("dataBackReferences", {
        projectId,
        formulaId,
        targetKind: "name",
        target: writeAddress(address),
        updatedAt: at
      });
      continue;
    }
    if (address.at === "cell") {
      store.create("dataBackReferences", {
        projectId,
        formulaId,
        targetKind: "cell",
        target: `${address.resourceId}|${address.cell.rowId}|${address.cell.columnId}`,
        updatedAt: at
      });
      continue;
    }
    store.create("dataBackReferences", {
      projectId,
      formulaId,
      targetKind: "range",
      target: `${address.resourceId}|${address.range.from.rowId}|${address.range.from.columnId}`,
      to: `${address.resourceId}|${address.range.to.rowId}|${address.range.to.columnId}`,
      updatedAt: at
    });
  }
};

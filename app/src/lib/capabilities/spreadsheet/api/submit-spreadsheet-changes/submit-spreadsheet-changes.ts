import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { StoreModel } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import { canonicalOf } from "$representation/data/behavior/spreadsheets/history";

import { cellRowsOf, cellsOf } from "$capabilities/spreadsheet/api/shared/cells";
import { answered, writeFormulas } from "$capabilities/spreadsheet/api/shared/answering";
import { leaderOf } from "$capabilities/spreadsheet/api/shared/leader";
import { withoutSharedReferences } from "$capabilities/spreadsheet/api/shared/without-shared-references";
import { applyOps } from "$capabilities/spreadsheet/api/submit-spreadsheet-changes/apply-ops";
import { validateSubmitSpreadsheetChanges } from "$capabilities/spreadsheet/api/submit-spreadsheet-changes/validate-submit-spreadsheet-changes";
import { writeCells } from "$capabilities/spreadsheet/api/submit-spreadsheet-changes/write-cells";
import type { SubmitSpreadsheetChangesResult } from "$capabilities/spreadsheet/types/submit-spreadsheet-changes";
import { enqueueSemanticOutboxFor } from "$capabilities/semantic-overlay/index";

type Landed = {
  readonly revision: number;
  readonly ops: readonly SpreadsheetOp[];
  readonly touched: readonly string[];
};

type Prepared =
  | { readonly canonical: ReturnType<typeof canonicalOf>; readonly applied: LiveSheet }
  | { readonly refusal: string };

const sheetExists = (
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">
): boolean => {
  const found = store.read("spreadsheets");
  if (found?.table !== "spreadsheets" || found.kind !== "table") return false;
  return found.rows.some((row) => row._id === resourceId && row.projectId === projectId);
};

const related = (a: string, b: string): boolean =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

const landedBetween = (
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">,
  base: number,
  head: number
): readonly Landed[] | undefined => {
  const found = store.read("spreadsheetChangeSets");
  if (found?.table !== "spreadsheetChangeSets" || found.kind !== "table") return undefined;

  const landed = found.rows
    .filter(
      (row) =>
        row.projectId === projectId &&
        row.resourceId === resourceId &&
        row.revision > base &&
        row.revision <= head
    )
    .sort((a, b) => a.revision - b.revision);

  return landed.length === head - base ? landed : undefined;
};

const catchUpFor = (
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"spreadsheets">,
  base: number,
  head: number,
  touched: readonly string[]
): readonly SpreadsheetOp[] | undefined => {
  if (base === head) return [];
  if (base > head) return undefined;

  const landed = landedBetween(store, projectId, resourceId, base, head);
  if (landed === undefined) return undefined;

  const clashes = landed.some((held) =>
    held.touched.some((theirs) => touched.some((mine) => related(mine, theirs)))
  );
  return clashes ? undefined : landed.flatMap((held) => held.ops);
};

export const submitSpreadsheetChanges = async (
  input: unknown
): Promise<SubmitSpreadsheetChangesResult> => {
  const scope = await requireScope();
  const submitted = validateSubmitSpreadsheetChanges(input);

  const changeSet = withoutSharedReferences(submitted);
  const model = serverModel();
  const store = model.store;
  const projectId = scope.projectId as Id<"projects">;
  const resourceId = changeSet.resourceId as Id<"spreadsheets">;
  const actor = { kind: "user" as const, userId: scope.userId as Id<"users"> };

  if (!sheetExists(store, projectId, resourceId)) {
    return {
      accepted: false,
      reason: "missing",
      revision: 0,
      detail: "no spreadsheet in this project has that id"
    };
  }

  const leader = leaderOf(store, projectId, resourceId);
  if (leader === undefined) {
    return {
      accepted: false,
      reason: "missing",
      revision: 0,
      detail: "that spreadsheet has no leader snapshot to change"
    };
  }
  const revision = leader.revision;

  const catchUp = catchUpFor(
    store,
    projectId,
    resourceId,
    changeSet.baseRevision,
    revision,
    changeSet.touched
  );
  if (catchUp === undefined) {
    return {
      accepted: false,
      reason: "stale",
      revision,
      detail: `authored against revision ${changeSet.baseRevision}, the leader is at ${revision}`
    };
  }

  const rows = cellRowsOf(store, projectId, resourceId);

  /**
   * Everything the ops decide, worked out before anything is written.
   *
   * A sheet that cannot answer its own formulas is the client's problem and is
   * refused. A store that cannot keep what was decided is not, so the writes
   * below are outside this and their failures are raised rather than reported.
   */
  const prepared = ((): Prepared => {
    try {
      const held = { body: leader.body, cells: cellsOf(rows) };
      const canonical = canonicalOf(held, changeSet.ops);
      const applied = applyOps(held, canonical.ops);
      return { canonical, applied: answered(store, projectId, resourceId, applied) };
    } catch (error) {
      return { refusal: error instanceof Error ? error.message : String(error) };
    }
  })();

  if ("refusal" in prepared) {
    return { accepted: false, reason: "unresolved", revision, detail: prepared.refusal };
  }

  const advanced = revision + 1;
  const at = Date.now();

  /**
   * One revision, in one commit.
   *
   * The change set, the leader snapshot, the cells, the formula rows and their
   * back references are the same fact written in six places. A reader that saw
   * any one of them without the others would be reading a sheet that never
   * existed, so they cross the durable boundary together or not at all.
   */
  store.transaction((unit) => {
    const next = writeFormulas(unit, projectId, resourceId, prepared.applied);

    unit.create("spreadsheetChangeSets", {
      projectId,
      resourceId,
      revision: advanced,
      baseRevision: changeSet.baseRevision,
      tier: "recent",
      ops: prepared.canonical.ops,
      touched: prepared.canonical.touched,
      actor,
      at
    });

    unit.update(`spreadsheetSnapshots.${leader._id}`, {
      projectId,
      resourceId,
      revision: advanced,
      role: "leader",
      part: 0,
      body: next.body,
      at
    });

    writeCells(unit, projectId, resourceId, rows, next);

    unit.update(`spreadsheets.${resourceId}.updatedAt`, at);
    unit.update(`spreadsheets.${resourceId}.updatedBy`, actor);
    enqueueSemanticOutboxFor(
      model,
      unit,
      projectId,
      { kind: "spreadsheet", id: resourceId },
      advanced
    );
  });

  return catchUp.length === 0
    ? { accepted: true, revision: advanced }
    : { accepted: true, revision: advanced, catchUp };
};

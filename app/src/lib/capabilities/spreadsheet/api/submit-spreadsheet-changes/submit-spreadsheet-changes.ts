import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { StoreModel } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import { emptyBody } from "$representation/data/behavior/spreadsheets/empty-sheet";

import { cellRowsOf, cellsOf } from "$capabilities/spreadsheet/api/shared/cells";
import { leaderOf } from "$capabilities/spreadsheet/api/shared/leader";
import { withoutSharedReferences } from "$capabilities/spreadsheet/api/shared/without-shared-references";
import { applyOps } from "$capabilities/spreadsheet/api/submit-spreadsheet-changes/apply-ops";
import { validateSubmitSpreadsheetChanges } from "$capabilities/spreadsheet/api/submit-spreadsheet-changes/validate-submit-spreadsheet-changes";
import { writeCells } from "$capabilities/spreadsheet/api/submit-spreadsheet-changes/write-cells";
import type { SubmitSpreadsheetChangesResult } from "$capabilities/spreadsheet/types/submit-spreadsheet-changes";

type Landed = {
  readonly revision: number;
  readonly ops: readonly SpreadsheetOp[];
  readonly touched: readonly string[];
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
  const store = serverModel().store;
  const projectId = scope.projectId as Id<"projects">;
  const resourceId = changeSet.resourceId as Id<"spreadsheets">;
  const actor = { kind: "user" as const, userId: scope.userId as Id<"users"> };

  const leader = leaderOf(store, projectId, resourceId);
  const revision = leader?.revision ?? 0;

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
  let next;
  try {
    next = applyOps({ body: leader?.body ?? emptyBody(), cells: cellsOf(rows) }, changeSet.ops);
  } catch (error) {
    return {
      accepted: false,
      reason: "unresolved",
      revision,
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  const advanced = revision + 1;
  const at = Date.now();

  store.create("spreadsheetChangeSets", {
    projectId,
    resourceId,
    revision: advanced,
    baseRevision: changeSet.baseRevision,
    tier: "recent",
    ops: changeSet.ops,
    touched: changeSet.touched,
    actor,
    at
  });

  const snapshot = {
    projectId,
    resourceId,
    revision: advanced,
    role: "leader",
    part: 0,
    body: next.body,
    at
  };

  if (leader === undefined) store.create("spreadsheetSnapshots", snapshot);
  else store.update(`spreadsheetSnapshots.${leader._id}`, snapshot);

  writeCells(store, projectId, resourceId, rows, next);

  store.update(`spreadsheets.${resourceId}.updatedAt`, at);
  store.update(`spreadsheets.${resourceId}.updatedBy`, actor);

  return catchUp.length === 0
    ? { accepted: true, revision: advanced }
    : { accepted: true, revision: advanced, catchUp };
};

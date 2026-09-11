import {
  hasExactFields,
  isStoredActor,
  isStoredChoice,
  isStoredIdentifier,
  isStoredJson,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
type ChangeSetTable = "documentChangeSets" | "presentationChangeSets" | "spreadsheetChangeSets";
type ResourceTable = "documents" | "presentations" | "spreadsheets";

export type StoredChangeSetContract = {
  readonly table: ChangeSetTable;
  readonly resourceTable: ResourceTable;
  readonly setTargets: readonly string[];
  readonly listTargets: readonly string[];
  readonly moveTargets: readonly string[];
  readonly text: boolean;
};

const nullableIdentifier = (value: unknown): boolean =>
  value === null || isStoredIdentifier(value);

const identifierList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((entry) => isStoredIdentifier(entry)) &&
  new Set(value).size === value.length;

const listOperation = (
  op: Record<string, unknown>,
  contract: StoredChangeSetContract
): boolean =>
  hasExactFields(op, ["op", "target", "path", "ids", "after", "values"]) &&
  isStoredChoice(op.target, contract.listTargets) &&
  isStoredText(op.path, 10_000) && op.path.length > 0 &&
  identifierList(op.ids) &&
  nullableIdentifier(op.after) &&
  Array.isArray(op.values) &&
  op.values.every((value) => isStoredJson(value));

/** Exact admission for one current operation under a resource's change-set contract. */
export const isStoredChangeSetOperation = (
  value: unknown,
  contract: StoredChangeSetContract
): boolean => {
  const op = storedFields(value);
  if (op === undefined) return false;
  if (op.op === "set") {
    return hasExactFields(op, ["op", "target", "path", "value", "was"]) &&
      isStoredChoice(op.target, contract.setTargets) &&
      isStoredText(op.path, 10_000) && op.path.length > 0 &&
      isStoredJson(op.value) && isStoredJson(op.was);
  }
  if (op.op === "insert" || op.op === "remove") return listOperation(op, contract);
  if (op.op === "move") {
    return hasExactFields(
      op,
      ["op", "target", "path", "id", "after", "wasAfter"]
    ) && isStoredChoice(op.target, contract.moveTargets) &&
      isStoredText(op.path, 10_000) && op.path.length > 0 &&
      isStoredIdentifier(op.id) && nullableIdentifier(op.after) &&
      nullableIdentifier(op.wasAfter) && op.after !== op.id;
  }
  return contract.text && op.op === "text" &&
    hasExactFields(op, ["op", "target", "path", "at", "insert", "remove"]) &&
    op.target === "atom" && isStoredText(op.path, 10_000) && op.path.length > 0 &&
    isStoredNatural(op.at) && isStoredText(op.insert) && isStoredText(op.remove) &&
    (op.insert.length > 0 || op.remove.length > 0);
};

const matchingTouched = (
  ops: readonly unknown[],
  touched: readonly unknown[]
): boolean => {
  if (!touched.every((path) => isStoredText(path, 10_000))) return false;
  const paths = ops.map((op) => storedFields(op)?.path);
  const expected = [...new Set(paths)];
  return touched.length === expected.length &&
    touched.every((path, index) => path === expected[index]);
};

/** Exact current change-set row and recursive operation union. */
export const isStoredChangeSet = (
  value: unknown,
  contract: StoredChangeSetContract
): boolean => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(row, [
      "_id", "_creationTime", "projectId", "resourceId", "revision", "baseRevision",
      "tier", "ops", "touched", "actor", "at"
    ]) &&
    isStoredRowId(row._id, contract.table) &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.resourceId, contract.resourceTable) &&
    isStoredNatural(row.revision) && row.revision >= 1 &&
    isStoredNatural(row.baseRevision) && row.baseRevision < row.revision &&
    (row.tier === "recent" || row.tier === "historical") &&
    Array.isArray(row.ops) && row.ops.length > 0 &&
    row.ops.every((op) => isStoredChangeSetOperation(op, contract)) &&
    Array.isArray(row.touched) && matchingTouched(row.ops, row.touched) &&
    isStoredActor(row.actor) &&
    isStoredTime(row.at);
};

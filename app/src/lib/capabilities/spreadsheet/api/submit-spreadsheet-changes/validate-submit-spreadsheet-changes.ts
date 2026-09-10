import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { SpreadsheetChangeSetInput } from "$capabilities/spreadsheet/types/submit-spreadsheet-changes";
import {
  hasExactFields,
  isStoredIdentifier,
  isStoredJson,
  isStoredNatural,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";

const SET_TARGETS = ["cell", "mark", "formatRule", "sheet"] as const;
const LIST_TARGETS = ["gridRow", "gridColumn", "formatRule", "mark", "sheet"] as const;
const MOVE_TARGETS = ["gridRow", "gridColumn"] as const;

/** What one submission may carry, so a malformed or hostile one is cheap to refuse. */
export const MAX_OPS = 500;
export const MAX_PATH = 512;
export const MAX_ID = 128;
export const MAX_LIST = 500;
export const MAX_OP_BYTES = 64_000;
export const MAX_SET_BYTES = 1_000_000;

const fail = (why: string): never => {
  throw new Error(`spreadsheet/submit-spreadsheet-changes: ${why}`);
};

const bounded = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= limit;

/** Nothing but JSON, and nothing deeper than a sheet ever needs. */
const plain = (value: unknown, depth = 0): boolean => {
  if (depth > 12) return false;
  if (value === null) return true;
  switch (typeof value) {
    case "string":
      return value.length <= MAX_OP_BYTES;
    case "number":
      return Number.isFinite(value);
    case "boolean":
      return true;
    case "object":
      break;
    default:
      return false;
  }
  if (Array.isArray(value)) {
    return value.length <= MAX_LIST &&
      isStoredJson(value) &&
      value.every((member) => plain(member, depth + 1));
  }
  const record = storedFields(value);
  if (record === undefined) return false;
  const keys = Reflect.ownKeys(record) as string[];
  return keys.length <= 64 && keys.every((key) => key.length <= 64 && plain(record[key], depth + 1));
};

const ids = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= MAX_LIST &&
  isStoredJson(value) &&
  value.every((id) => isStoredIdentifier(id, MAX_ID)) &&
  new Set(value).size === value.length;

const targetIs = <Target extends string>(
  value: unknown,
  choices: readonly Target[]
): value is Target => typeof value === "string" && choices.includes(value as Target);

/**
 * One op, checked variant by variant.
 *
 * A set carries its prior value; an insert and remove carry ids, values and
 * where they go; a move carries both positions. The server still recomputes
 * history from authoritative state, but the command must name the one current
 * operation shape rather than relying on the server to complete an older or
 * partial shape.
 */
const opOf = (value: unknown): SpreadsheetOp => {
  const fields = storedFields(value);
  if (fields === undefined) return fail("every op is a plain data object");
  const { op, target, path } = fields;

  if (!bounded(path, MAX_PATH)) return fail("every op names a path");
  if (!plain(value)) return fail("an op carries plain JSON of a bounded size");
  if (JSON.stringify(value).length > MAX_OP_BYTES) return fail("that op is too large");

  switch (op) {
    case "set":
      if (
        !hasExactFields(fields, ["op", "target", "path", "value", "was"]) ||
        !targetIs(target, SET_TARGETS) ||
        !isStoredJson(fields.value) ||
        !isStoredJson(fields.was)
      ) return fail("a set has exactly the current set shape");
      return value as SpreadsheetOp;
    case "insert": {
      if (
        !hasExactFields(fields, ["op", "target", "path", "ids", "after", "values"]) ||
        !targetIs(target, LIST_TARGETS) ||
        !ids(fields.ids)
      ) return fail("an insert has exactly the current insert shape");
      if (
        !Array.isArray(fields.values) ||
        !isStoredJson(fields.values) ||
        fields.values.length !== fields.ids.length
      ) {
        return fail("an insert carries one value per id");
      }
      if (fields.after !== null && !isStoredIdentifier(fields.after, MAX_ID)) {
        return fail("an insert goes after an id or at the front");
      }
      return value as SpreadsheetOp;
    }
    case "remove": {
      if (
        !hasExactFields(fields, ["op", "target", "path", "ids", "after", "values"]) ||
        !targetIs(target, LIST_TARGETS) ||
        !ids(fields.ids) ||
        !Array.isArray(fields.values) ||
        !isStoredJson(fields.values) ||
        fields.values.length !== fields.ids.length
      ) return fail("a remove has exactly the current remove shape");
      if (fields.after !== null && !isStoredIdentifier(fields.after, MAX_ID)) {
        return fail("a remove follows an id or was at the front");
      }
      return value as SpreadsheetOp;
    }
    case "move": {
      if (
        !hasExactFields(fields, ["op", "target", "path", "id", "after", "wasAfter"]) ||
        !targetIs(target, MOVE_TARGETS) ||
        !isStoredIdentifier(fields.id, MAX_ID) ||
        (fields.after !== null && !isStoredIdentifier(fields.after, MAX_ID)) ||
        (fields.wasAfter !== null && !isStoredIdentifier(fields.wasAfter, MAX_ID)) ||
        fields.after === fields.id
      ) return fail("a move has exactly the current move shape");
      return value as SpreadsheetOp;
    }
    default:
      return fail(`${String(op)} is not an operation`);
  }
};

export const validateSubmitSpreadsheetChanges = (input: unknown): SpreadsheetChangeSetInput => {
  const envelope = storedFields(input);
  if (envelope === undefined || !hasExactFields(envelope, ["changeSet"])) {
    return fail("exactly one changeSet object is required");
  }

  const changeSet = storedFields(envelope.changeSet);
  if (
    changeSet === undefined ||
    !hasExactFields(changeSet, ["resourceId", "baseRevision", "ops", "touched"])
  ) return fail("a changeSet has exactly the current fields");

  const { resourceId, baseRevision, ops } = changeSet;

  if (!isStoredRowId(resourceId, "spreadsheets") || resourceId.length > MAX_ID) {
    return fail("resourceId is a spreadsheet id");
  }
  if (!isStoredNatural(baseRevision)) {
    return fail("baseRevision is a revision number");
  }
  if (!Array.isArray(ops) || ops.length === 0) return fail("a change set carries at least one op");
  if (ops.length > MAX_OPS) return fail(`a change set carries at most ${MAX_OPS} ops`);
  if (JSON.stringify(ops).length > MAX_SET_BYTES) return fail("that change set is too large");

  const checked = ops.map(opOf);
  const expectedTouched = [...new Set(checked.map((op) => op.path))];
  if (
    !Array.isArray(changeSet.touched) ||
    !isStoredJson(changeSet.touched) ||
    changeSet.touched.length !== expectedTouched.length ||
    !changeSet.touched.every((path, index) => path === expectedTouched[index])
  ) return fail("touched exactly matches the paths the ops reach");

  return changeSet as SpreadsheetChangeSetInput;
};

import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { SpreadsheetChangeSetInput } from "$capabilities/spreadsheet/types/submit-spreadsheet-changes";

const TARGETS = ["cell", "mark", "formatRule", "gridRow", "gridColumn", "sheet"];

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
    return value.length <= MAX_LIST && value.every((member) => plain(member, depth + 1));
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.length <= 64 && keys.every((key) => key.length <= 64 && plain(record[key], depth + 1));
};

const ids = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= MAX_LIST &&
  value.every((id) => bounded(id, MAX_ID));

/**
 * One op, checked variant by variant.
 *
 * A set carries a value; an insert carries ids, values and where they go; a
 * remove carries ids; a move carries one id and where it goes. Anything else in
 * the object is somebody's idea rather than the shape, and `was`, `wasAfter` and
 * a remove's `values` are dropped here because the server works them out.
 */
const opOf = (value: unknown): SpreadsheetOp => {
  if (!isRecord(value)) return fail("every op is an object");
  const { op, target, path } = value;

  if (!bounded(path, MAX_PATH)) return fail("every op names a path");
  if (typeof target !== "string" || !TARGETS.includes(target)) return fail(`${String(target)} is not a target`);
  if (!plain(value)) return fail("an op carries plain JSON of a bounded size");
  if (JSON.stringify(value).length > MAX_OP_BYTES) return fail("that op is too large");

  const head = { target, path } as { target: SpreadsheetOp["target"]; path: string };

  switch (op) {
    case "set":
      if (!("value" in value)) return fail("a set carries a value");
      return { op: "set", ...head, value: value.value, was: null } as SpreadsheetOp;
    case "insert": {
      if (!ids(value.ids)) return fail("an insert names the ids it is adding");
      if (!Array.isArray(value.values) || value.values.length !== value.ids.length) {
        return fail("an insert carries one value per id");
      }
      if (value.after !== null && !bounded(value.after, MAX_ID)) {
        return fail("an insert goes after an id or at the front");
      }
      return { op: "insert", ...head, ids: value.ids, values: value.values, after: value.after } as SpreadsheetOp;
    }
    case "remove":
      if (!ids(value.ids)) return fail("a remove names the ids it is taking");
      return { op: "remove", ...head, ids: value.ids, values: [], after: null } as SpreadsheetOp;
    case "move": {
      if (!bounded(value.id, MAX_ID)) return fail("a move names what it is moving");
      if (value.after !== null && !bounded(value.after, MAX_ID)) {
        return fail("a move goes after an id or to the front");
      }
      return { op: "move", ...head, id: value.id, after: value.after, wasAfter: null } as SpreadsheetOp;
    }
    default:
      return fail(`${String(op)} is not an operation`);
  }
};

export const validateSubmitSpreadsheetChanges = (input: unknown): SpreadsheetChangeSetInput => {
  if (!isRecord(input)) return fail("an object is required");

  const { changeSet } = input;
  if (!isRecord(changeSet)) return fail("a changeSet is required");

  const { resourceId, baseRevision, ops } = changeSet;

  if (!bounded(resourceId, MAX_ID)) return fail("resourceId is required");
  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) {
    return fail("baseRevision is a revision number");
  }
  if (!Array.isArray(ops) || ops.length === 0) return fail("a change set carries at least one op");
  if (ops.length > MAX_OPS) return fail(`a change set carries at most ${MAX_OPS} ops`);
  if (JSON.stringify(ops).length > MAX_SET_BYTES) return fail("that change set is too large");

  const checked = ops.map(opOf);
  return {
    resourceId,
    baseRevision,
    ops: checked,
    touched: [...new Set(checked.map((op) => op.path))]
  };
};

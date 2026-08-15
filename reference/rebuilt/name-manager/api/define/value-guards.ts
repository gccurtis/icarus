import { NameManagerError } from "$name-manager/errors";

/**
 * The two shapes every admission step needs: what counts as a record, and how a
 * value is refused.
 *
 * `isRecord` excludes arrays deliberately. An array is a value in its own right
 * here — a list or a table holds one — so treating it as a record would let a
 * `[]` satisfy a record declaration with no fields.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Returns `never` so a caller can `return invalidValue(...)` in a position that
 * owes a value, which is what keeps the admission switch exhaustive without a
 * `throw` statement breaking each arm's expression form.
 */
export const invalidValue = (path: string, expectation: string): never => {
  throw new NameManagerError("invalid-value", `${path} must be ${expectation}`);
};

import type { ResourceRef } from "$representation/data/types/core/resource";

/**
 * One place a formula is held. A list on the formula rather than rows of its
 * own, because the lookup key is the formula's own id.
 *
 * `path` addresses the cell or the block inside the resource, in the same form
 * an op's path takes.
 */
export type FormulaUse =
  | { in: "resource"; ref: ResourceRef; path: string }
  | { in: "variable"; name: string };

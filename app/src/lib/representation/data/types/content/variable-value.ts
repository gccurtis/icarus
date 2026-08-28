import type { FormulaValue } from "$representation/data/types/content/formula-value";
import type { ResourceRef } from "$representation/data/types/core/resource";

/**
 * What a name holds: everything a formula can produce, plus a reference.
 *
 * A reference is not a copy — it resolves when it is asked for, walking to
 * another variable until it reaches a value. Storing what it currently resolves
 * to would make an alias a snapshot, which is the one thing an alias is not.
 */
export type VariableValue =
  | FormulaValue
  | {
      kind: "reference";
      target: { to: "variable"; name: string } | { to: "resource"; ref: ResourceRef };
    };

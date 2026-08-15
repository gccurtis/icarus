import type { NamedVariable } from "$name-manager/types/variables";

/**
 * Severs every object reference between what `define` returns and what its
 * caller passed in.
 *
 * Only `define` needs this. Every other function returns a value that came out
 * of the database, and `currentNamedVariable` already copies at that boundary —
 * a second copy on top of it would be pure waste.
 *
 * `define` is the exception because the variable it returns was built from the
 * caller's own input and still shares structure with it. Without this, mutating
 * that input afterwards would change what `define` appeared to have returned,
 * while the stored row stayed as it was.
 */
export const copyVariable = (variable: NamedVariable): NamedVariable =>
  structuredClone(variable);

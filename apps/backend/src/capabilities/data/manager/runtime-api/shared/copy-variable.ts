import type { NamedVariable } from "#data-manager/types/variables.js";

/**
 * Severs every object reference between the catalog and a caller, in both
 * directions: what is stored, and what is handed back.
 */
export const copyVariable = (variable: NamedVariable): NamedVariable =>
  structuredClone(variable);

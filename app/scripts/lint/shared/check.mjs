/**
 * What a check is.
 *
 * One file, one name, one invariant. A check that needs a paragraph to explain
 * is two checks; a check that can fail for two unrelated reasons declares those
 * reasons as subjects, so a finding says which one broke without a lookup.
 *
 * `run` is a function over a `Tree` rather than a script, so a check can be
 * pointed at a deliberately-broken fixture. A rule with a typo'd condition never
 * fires, and a linter that never fires reports success forever.
 */

/**
 * @param {{
 *   name: string,
 *   says: string,
 *   subjects?: Record<string, string>,
 *   run: (tree: import("./tree.mjs").Tree) => Array<{ ... }> | Promise<Array<{
 *     subject?: string, path: string, line?: number, message: string
 *   }>>
 * }} definition
 */
export const check = (definition) => {
  const known = Object.keys(definition.subjects ?? {});
  return {
    ...definition,
    async run(tree) {
      const found = (await definition.run(tree)) ?? [];
      for (const failure of found) {
        if (failure.subject && !known.includes(failure.subject)) {
          throw new Error(`${definition.name}: reported unknown subject "${failure.subject}"`);
        }
        if (!failure.subject && known.length > 0) {
          throw new Error(`${definition.name}: has subjects, so every finding must name one`);
        }
      }
      return found;
    }
  };
};

/** A finding. `path` may be absolute; the runner reports it relative to the package. */
export const at = (path, message, extra = {}) => ({ path, message, ...extra });

import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { digest128 } from "$knowledge/api/shared/digest";
import type { ScopeManifest } from "$knowledge/types/retrieval";
import { resolve } from "$resource-sets/api/resolve/resolve";
import type { ResourceRef, SetExpression } from "$shared/types/set-expression";

const keyOf = (ref: ResourceRef) => `${ref.kind}:${ref.id}`;

/** JSON with every object's keys in one order, so a digest is over the value. */
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const fields = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`);
    return `{${fields.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

/** Deduplicated and in one order, so the same membership digests the same way. */
const canonicalEntries = (refs: readonly ResourceRef[]): ResourceRef[] => {
  const found = new Map<string, ResourceRef>();
  for (const ref of refs) if (!found.has(keyOf(ref))) found.set(keyOf(ref), ref);
  return [...found.values()].sort((left, right) => (keyOf(left) < keyOf(right) ? -1 : 1));
};

/**
 * Whether the caller wrote a scope that selects from nothing.
 *
 * An absent scope and an empty one both mean the whole lattice. **A scope that
 * *resolved* to nothing does not** — it means a scope whose resources are gone
 * or were never the caller's, and reading that as "no restriction" would answer
 * from the whole project exactly when the caller asked for the least.
 *
 * Only the two empty forms qualify, because every other operator names something
 * to look up. `{ op: "project" }` is how the whole lattice is said positively,
 * so nobody has to write an empty scope to mean everything.
 */
const namesNothing = (expression: SetExpression): boolean =>
  (expression.op === "resources" && expression.refs.length === 0) ||
  (expression.op === "union" && expression.of.length === 0);

/**
 * Resolve a scope once, into the set of source ids retrieval will admit.
 *
 * **The source id is the authoritative membership key.** A kind guides
 * resolution — it says which table to walk, and a connector expands to its files
 * — and it is carried as provenance, but admission compares ids alone. A window
 * whose source id is in the set is admissible whatever anything is called.
 *
 * The manifest returned is what makes a scoped answer checkable: "why was this
 * not found" is either "the source was not admissible" or "it was, and descent
 * did not reach it", and only the manifest distinguishes them.
 */
export const resolveScope = async (
  ctx: QueryCtx,
  scope: Scope,
  expression: SetExpression | undefined
): Promise<ScopeManifest | null> => {
  if (!expression || namesNothing(expression)) return null;

  const entries = canonicalEntries(await resolve(ctx, scope, expression));
  const sourceIds = [...new Set(entries.map((entry) => entry.id))].sort();

  return {
    input: expression,
    entries,
    sourceIds,
    inputDigest: digest128(canonical(expression)),
    // Over what the scope resolved to rather than what it was written as, so
    // two ways of naming one membership are one scope.
    scopeDigest: digest128(canonical({ entries, sourceIds })),
    resolvedAt: Date.now()
  };
};

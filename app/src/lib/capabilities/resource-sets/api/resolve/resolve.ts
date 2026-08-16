import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import { kindRefs } from "$resource-sets/api/resolve/kind-refs";
import { namedRefs } from "$resource-sets/api/resolve/named-refs";
import { storedKinds } from "$resource-sets/api/resolve/resource-tables";
import { requireSet } from "$resource-sets/api/shared/require-set";
import { ResourceSetsError, type SetStep } from "$resource-sets/errors";
import type { ResourceRef, SetExpression } from "$shared/types/set-expression";

const keyOf = (ref: ResourceRef) => `${ref.kind}:${ref.id}`;

/**
 * A resolution is a set, so a resource selected twice appears once. First
 * appearance wins, which is what makes one project resolve to the same list
 * twice.
 */
const distinct = (refs: ResourceRef[]): ResourceRef[] => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = keyOf(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * What an expression selects, right now.
 *
 * **The answer is a moment and is not stored.** A consumer that needs to
 * remember what it saw — a derived output explaining its output — records the
 * refs and their revisions in its own row. The set stays lazy; the consumer
 * captures. That is also why this is a query: it writes nothing at all.
 *
 * `trail` is the sets walked to get here, and it is passed down rather than
 * accumulated in one shared list: a set named twice in different branches of a
 * union is an ordinary expression, while a set reachable from *itself* is a
 * configuration mistake that would otherwise recurse forever.
 *
 * The expression may be an inline one or a `{ op: "set" }` naming a saved one.
 * There is one mechanism rather than a saved form and an inline form.
 */
export const resolve = async (
  ctx: QueryCtx,
  scope: Scope,
  expression: SetExpression,
  trail: readonly SetStep[] = []
): Promise<ResourceRef[]> => {
  switch (expression.op) {
    case "project": {
      const found: ResourceRef[] = [];
      for (const kind of storedKinds) found.push(...(await kindRefs(ctx, scope, kind)));
      return distinct(found);
    }

    case "kind":
      return distinct(await kindRefs(ctx, scope, expression.kind));

    case "resources":
      return distinct(await namedRefs(ctx, scope, expression.refs));

    case "set": {
      const looped = trail.findIndex((step) => step.id === expression.setId);
      if (looped !== -1) {
        const cycle = [...trail.slice(looped), trail[looped]];
        throw new ResourceSetsError(
          "cycle",
          `Resource sets reference each other: ${cycle.map((step) => step.name).join(" → ")}`,
          cycle
        );
      }

      const set = await requireSet(ctx, scope, expression.setId);
      return await resolve(ctx, scope, set.expression, [
        ...trail,
        { id: set._id, name: set.name }
      ]);
    }

    case "union": {
      const found: ResourceRef[] = [];
      for (const member of expression.of) found.push(...(await resolve(ctx, scope, member, trail)));
      return distinct(found);
    }

    case "difference": {
      const from = await resolve(ctx, scope, expression.from, trail);
      const removed = new Set(
        (await resolve(ctx, scope, expression.remove, trail)).map(keyOf)
      );
      return from.filter((ref) => !removed.has(keyOf(ref)));
    }
  }
};

import type { StoreModel } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import { needsRow, ruleWords } from "$representation/data/behavior/core/scope-draft";
import type { Actor } from "$representation/data/types/core/actor";
import type {
  BoundTo,
  ResourceSet,
  TemplatedResourceSet
} from "$representation/data/types/core/resource-set";

import { recordsIn } from "$capabilities/templates/api/shared/store";

/**
 * A chosen rule becomes a term, and a row only when it has to.
 *
 * Four surfaces choose a scope: a variable's default from either editor's panel
 * or from the library inspector, and an answer given while placing a template.
 * All four send the rule they built and none of them writes anything, because
 * the normalisation is the same every time and a client-side write would put a
 * second round trip in front of a save that can then half-fail.
 *
 * **A rule that excludes anything, or names particular resources, is stored.**
 * Resolving a template substitutes a variable term for what fills it, and a
 * variable term may sit on either side of a prompt's scope. One term for one
 * term works on both sides; one term for a difference does not. So the
 * difference lives inside a row and what points at it is a single `set` term.
 * Everything else is said inline, which is the common case.
 */

export type ScopeOwner = BoundTo;

const named = (store: StoreModel, projectId: string): ReadonlySet<string> =>
  new Set(
    recordsIn(store, "resourceSets")
      .filter(
        (row) => row.projectId === projectId && typeof row._id === "string" && row.name !== undefined
      )
      .map((row) => row._id as string)
  );

const sameOwner = (held: unknown, owner: ScopeOwner): boolean => {
  if (held === null || typeof held !== "object") return false;
  const record = held as Record<string, unknown>;
  if (owner.kind === "variable") {
    return (
      record.kind === "variable" &&
      record.templateId === owner.templateId &&
      record.variable === owner.variable
    );
  }
  return (
    record.kind === "resource" &&
    record.resourceId === owner.resourceId &&
    record.variable === owner.variable
  );
};

/** Every row bound to one resource, whichever variable it answered. */
export const rowsOfResource = (
  store: StoreModel,
  projectId: string,
  resourceId: string
): readonly string[] =>
  recordsIn(store, "resourceSets")
    .filter((row) => {
      if (row.projectId !== projectId || typeof row._id !== "string") return false;
      const held = row.boundTo;
      return (
        held !== null &&
        typeof held === "object" &&
        (held as Record<string, unknown>).kind === "resource" &&
        (held as Record<string, unknown>).resourceId === resourceId
      );
    })
    .map((row) => row._id as string);

/** The bound rows an owner holds, newest last, so a rewrite can reuse the first. */
export const rowsBoundTo = (
  store: StoreModel,
  projectId: string,
  owner: ScopeOwner
): readonly string[] =>
  recordsIn(store, "resourceSets")
    .filter(
      (row) =>
        row.projectId === projectId &&
        typeof row._id === "string" &&
        sameOwner(row.boundTo, owner)
    )
    .map((row) => row._id as string);

export const removeRowsBoundTo = (
  store: StoreModel,
  projectId: string,
  owner: ScopeOwner
): number => {
  const held = rowsBoundTo(store, projectId, owner);
  for (const setId of held) store.remove(`resourceSets.${setId}`);
  return held.length;
};

/** Every set term in a rule that the project does not hold. */
export const unknownSetsIn = (
  store: StoreModel,
  projectId: string,
  scope: { include: readonly { select: string }[]; exclude: readonly { select: string }[] }
): readonly string[] => {
  const held = new Set(
    recordsIn(store, "resourceSets")
      .filter((row) => row.projectId === projectId && typeof row._id === "string")
      .map((row) => row._id as string)
  );
  const missing: string[] = [];
  for (const term of [...scope.include, ...scope.exclude]) {
    const setId = (term as { setId?: unknown }).setId;
    if (term.select !== "set" || typeof setId !== "string") continue;
    if (!held.has(setId) && !missing.includes(setId)) missing.push(setId);
  }
  return missing;
};

type Written = { readonly term: TemplatedResourceSet; readonly setId?: string };

/**
 * The rule as a templated set, writing or rewriting the owner's row when the
 * rule cannot be said inline, and clearing the row when it can.
 */
export const normalizeScope = (
  store: StoreModel,
  projectId: string,
  actor: Actor,
  owner: ScopeOwner,
  rule: ResourceSet | TemplatedResourceSet | undefined,
  at: number
): Written | undefined => {
  if (rule === undefined) {
    removeRowsBoundTo(store, projectId, owner);
    return undefined;
  }

  const held = rowsBoundTo(store, projectId, owner);

  if (!needsRow(rule)) {
    for (const setId of held) store.remove(`resourceSets.${setId}`);
    return { term: rule as TemplatedResourceSet };
  }

  const [first, ...extra] = held;
  for (const setId of extra) store.remove(`resourceSets.${setId}`);

  if (first !== undefined) {
    const row = recordsIn(store, "resourceSets").find((candidate) => candidate._id === first);
    const revision = typeof row?.revision === "number" ? row.revision : 1;
    store.update(`resourceSets.${first}.set`, rule);
    store.update(`resourceSets.${first}.revision`, revision + 1);
    store.update(`resourceSets.${first}.updatedAt`, at);
    return {
      term: { include: [{ select: "set", setId: asId<"resourceSets">(first) }], exclude: [] },
      setId: first
    };
  }

  const setId = store.create("resourceSets", {
    projectId: asId<"projects">(projectId),
    boundTo: owner,
    set: rule as ResourceSet,
    createdBy: actor,
    revision: 1,
    updatedAt: at
  });
  return {
    term: { include: [{ select: "set", setId: asId<"resourceSets">(setId) }], exclude: [] },
    setId
  };
};

/**
 * A stored default read back as the rule somebody built.
 *
 * A term naming a bound row is expanded, because that row is this variable's
 * value rather than a set anyone chose. A term naming one of the project's own
 * sets is left alone, because choosing it was the point.
 */
export const expandedScope = (
  store: StoreModel,
  projectId: string,
  scope: TemplatedResourceSet | undefined
): TemplatedResourceSet | undefined => {
  if (scope === undefined) return undefined;
  if (scope.exclude.length > 0 || scope.include.length !== 1) return scope;
  const term = scope.include[0];
  if (term.select !== "set" || named(store, projectId).has(term.setId)) return scope;
  const row = recordsIn(store, "resourceSets").find(
    (candidate) => candidate._id === term.setId && candidate.projectId === projectId
  );
  const rule = row?.set;
  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) return scope;
  const held = rule as { include?: unknown; exclude?: unknown };
  if (!Array.isArray(held.include) || !Array.isArray(held.exclude)) return scope;
  return held as unknown as TemplatedResourceSet;
};

/** What a rule says, for a refusal that has to name it. */
export const scopeWords = (scope: TemplatedResourceSet | ResourceSet): string => ruleWords(scope);

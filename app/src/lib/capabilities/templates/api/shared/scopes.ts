import type { StoreUnitOfWork } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import { needsRow, ruleWords } from "$representation/data/behavior/core/scope-draft";
import { resourceSetReferenceIssue } from "$representation/data/behavior/core/resource-set";
import {
  admittedResourceSetClaim,
  admittedReusableResourceSets
} from "$representation/data/behavior/core/resource-set-rows";
import type { Actor } from "$representation/data/types/core/actor";
import type {
  ResourceSet,
  TemplatedResourceSet
} from "$representation/data/types/core/resource-set";
import type { TemplateVersionScope } from "$representation/data/types/templates/template";

import {
  removeRowsBoundTo,
  rowsBoundTo,
  sameScopeOwner,
  type ScopeOwner
} from "$capabilities/templates/api/shared/scope-rows";
import { recordsIn } from "$capabilities/templates/api/shared/store";

/**
 * A chosen rule becomes a term, and a row only when it has to.
 *
 * Four surfaces choose a scope: a hole's default from either editor's panel or
 * from the library inspector, and an answer given while placing a template.
 * All four send the rule they built and none of them writes anything, because
 * the normalisation is the same every time and a client-side write would put a
 * second round trip in front of a save that can then half-fail.
 *
 * **A rule that excludes anything, or names particular resources, is stored.**
 * Resolving a template substitutes a hole term for what fills it, and a hole
 * term may sit on either side of a prompt's scope. One term for one term works
 * on both sides; one term for a difference does not. So the difference lives
 * inside a row and what points at it is a single `set` term. Everything else is
 * said inline, which is the common case.
 */

/** Classifies a caller's set references as reusable, missing, or private implementation storage. */
export const setReferencesIn = (
  store: StoreUnitOfWork,
  projectId: string,
  scope: { include: readonly { select: string }[]; exclude: readonly { select: string }[] }
): { readonly missing: readonly string[]; readonly private: readonly string[] } => {
  const rows = recordsIn(store, "resourceSets");
  const reusable = admittedReusableResourceSets(rows, projectId);
  const localClaims = new Set(
    rows.flatMap((row) =>
      row.projectId === projectId && typeof row._id === "string" ? [row._id] : []
    )
  );
  const missing: string[] = [];
  const privateSets: string[] = [];
  for (const term of [...scope.include, ...scope.exclude]) {
    const setId = (term as { setId?: unknown }).setId;
    if (term.select !== "set" || typeof setId !== "string") continue;
    if (reusable.has(setId)) continue;
    if (localClaims.has(setId)) {
      if (!privateSets.includes(setId)) privateSets.push(setId);
    } else if (!missing.includes(setId)) {
      missing.push(setId);
    }
  }
  if (missing.length === 0 && privateSets.length === 0) {
    const setTerms = (terms: readonly { select: string }[]): ResourceSet["include"] =>
      terms.flatMap((term) => {
        const setId = (term as { setId?: unknown }).setId;
        return term.select === "set" && typeof setId === "string"
          ? [{ select: "set", setId: asId<"resourceSets">(setId) }]
          : [];
      });
    const references: ResourceSet = {
      include: setTerms(scope.include),
      exclude: setTerms(scope.exclude)
    };
    const named = new Map([...reusable].map(([id, row]) => [id, row.set]));
    const issue = resourceSetReferenceIssue(references, named);
    if (issue !== undefined) {
      if (localClaims.has(issue.setId)) privateSets.push(issue.setId);
      else missing.push(issue.setId);
    }
  }
  return { missing, private: privateSets };
};

type Written = { readonly term: TemplatedResourceSet; readonly setId?: string };

export type PrivateHoleDefault =
  | { readonly kind: "ordinary" }
  | { readonly kind: "private"; readonly rule: ResourceSet }
  | { readonly kind: "invalid"; readonly setId: string };

/** Classify a private set reference without treating another owner's row as portable. */
const privateDefaultOf = (
  store: StoreUnitOfWork,
  projectId: string,
  owner: ScopeOwner,
  scope: TemplatedResourceSet | undefined
): PrivateHoleDefault => {
  if (scope === undefined) return { kind: "ordinary" };
  const terms = [...scope.include, ...scope.exclude].filter(
    (term): term is Extract<(typeof scope.include)[number], { select: "set" }> =>
      term.select === "set"
  );
  const rows = recordsIn(store, "resourceSets");
  const reusable = admittedReusableResourceSets(rows, projectId);
  for (const term of terms) {
    if (reusable.has(term.setId)) {
      const references = setReferencesIn(store, projectId, {
        include: [term],
        exclude: []
      });
      const invalid = references.missing[0] ?? references.private[0];
      if (invalid !== undefined) return { kind: "invalid", setId: invalid };
      continue;
    }
    const row = admittedResourceSetClaim(rows, term.setId);
    if (row === undefined || row.projectId !== projectId || row.name !== undefined) {
      return { kind: "invalid", setId: term.setId };
    }
    const isOnlyTerm =
      scope.exclude.length === 0 &&
      scope.include.length === 1 &&
      scope.include[0].select === "set";
    if (!isOnlyTerm || !sameScopeOwner(row.boundTo, owner)) {
      return { kind: "invalid", setId: term.setId };
    }
    const references = setReferencesIn(store, projectId, row.set);
    const invalid = references.missing[0] ?? references.private[0];
    return invalid === undefined
      ? { kind: "private", rule: row.set }
      : { kind: "invalid", setId: invalid };
  }
  return { kind: "ordinary" };
};

/** Classify one live template hole's stored default against that exact hole. */
export const privateHoleDefaultOf = (
  store: StoreUnitOfWork,
  projectId: string,
  owner: Extract<ScopeOwner, { kind: "hole" }>,
  scope: TemplatedResourceSet | undefined
): PrivateHoleDefault => privateDefaultOf(store, projectId, owner, scope);

/**
 * The rule as a templated set, writing or rewriting the owner's row when the
 * rule cannot be said inline, and clearing the row when it can.
 */
export const normalizeScope = (
  store: StoreUnitOfWork,
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
    if (row === undefined) throw new Error(`template scope row ${first} disappeared`);
    if (!Number.isSafeInteger(row.revision) || Number(row.revision) < 1) {
      throw new Error(`template scope row ${first} has no current revision`);
    }
    const revision = Number(row.revision);
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
 * A stored default read back as the rule its exact owner built.
 *
 * A term naming a bound row is expanded, because that row is the owner's value
 * rather than a set anyone chose. A term naming one of the project's own
 * sets is left alone, because choosing it was the point. A missing row or a
 * private row owned by anything else is invalid rather than data this boundary
 * may disclose or silently copy.
 */
export const expandedScope = (
  store: StoreUnitOfWork,
  projectId: string,
  owner: ScopeOwner,
  scope: TemplatedResourceSet | undefined
): TemplatedResourceSet | undefined => {
  const held = privateDefaultOf(store, projectId, owner, scope);
  if (held.kind === "invalid") {
    throw new Error(
      `template scope owner cannot use private or missing set ${held.setId}`
    );
  }
  return held.kind === "private"
    ? (structuredClone(held.rule) as unknown as TemplatedResourceSet)
    : scope;
};

/**
 * A live hole's private row made independent for immutable history.
 *
 * Named project sets remain references because naming that reusable set was the
 * authored choice. A row owned by this exact hole is implementation storage for
 * a rule the template itself cannot carry, so a version owns a clone of the
 * concrete rule instead of the mutable row id.
 */
export const versionScopeOf = (
  store: StoreUnitOfWork,
  projectId: string,
  owner: Extract<ScopeOwner, { kind: "hole" }>,
  scope: TemplatedResourceSet | undefined
): TemplateVersionScope | undefined => {
  if (scope === undefined) return undefined;
  const held = privateDefaultOf(store, projectId, owner, scope);
  if (held.kind === "invalid") {
    throw new Error(`template scope owner cannot use private or missing set ${held.setId}`);
  }
  return structuredClone(held.kind === "private" ? held.rule : scope) as TemplateVersionScope;
};

/** What a rule says, for a refusal that has to name it. */
export const scopeWords = (scope: TemplatedResourceSet | ResourceSet): string => ruleWords(scope);

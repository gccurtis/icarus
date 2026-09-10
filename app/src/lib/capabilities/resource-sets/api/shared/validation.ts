import {
  admitResourceRef,
  isResourceSelectorKind
} from "$representation/data/behavior/core/resource";
import {
  hasExactFields,
  isStoredJson,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { Id } from "$representation/data/types/core/id";
import type { BoundTo, ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";

type Fields = Record<string, unknown>;

const MAX_TERMS_PER_SIDE = 100;
const MAX_KINDS_PER_TERM = 100;
const MAX_REFS_PER_TERM = 1_000;
const MAX_KIND_LENGTH = 160;

export const fieldsOf = (value: unknown, subject: string): Fields => {
  const fields = storedFields(value);
  if (fields === undefined || !isStoredJson(value)) {
    throw new Error(`resource-sets/${subject}: an exact current data object is required`);
  }
  return fields;
};

export const has = (fields: Fields, field: string): boolean =>
  Object.hasOwn(fields, field);

export const only = (fields: Fields, allowed: readonly string[], subject: string): void => {
  if (hasExactFields(fields, [], allowed)) return;
  const extra = Reflect.ownKeys(fields).filter(
    (field) => typeof field !== "string" || !allowed.includes(field)
  );
  if (extra.length > 0) {
    throw new Error(
      `resource-sets/${subject}: unknown ${extra.length === 1 ? "field" : "fields"} ${extra.map(String).join(", ")}`
    );
  }
  throw new Error(`resource-sets/${subject}: only exact current data fields are accepted`);
};

const exact = (value: unknown, required: readonly string[]): Fields | undefined => {
  const fields = storedFields(value);
  return fields !== undefined && hasExactFields(fields, required) ? fields : undefined;
};

const canonicalText = (value: unknown, maximum: number): value is string =>
  typeof value === "string" &&
  value === value.trim() &&
  value.length > 0 &&
  value.length <= maximum;

export const setIdOf = (value: unknown, subject: string): Id<"resourceSets"> => {
  if (!isStoredRowId(value, "resourceSets")) {
    throw new Error(`resource-sets/${subject}: setId is one canonical resourceSets row id`);
  }
  return value;
};

export const revisionOf = (value: unknown, subject: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`resource-sets/${subject}: baseRevision is a safe positive revision number`);
  }
  return value;
};

export const nameOf = (value: unknown, subject: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`resource-sets/${subject}: name is required`);
  }
  const name = value.trim();
  if (name.length > 160) throw new Error(`resource-sets/${subject}: name is at most 160 characters`);
  return name;
};

/**
 * What owns a bound row.
 *
 * A row carries a name or an owner and never both: naming is the whole
 * difference between a project's own set and a value something else holds.
 */
export const boundToOf = (value: unknown, subject: string): BoundTo => {
  const owner = storedFields(value);
  if (owner === undefined) {
    throw new Error(`resource-sets/${subject}: boundTo is an exact current data object`);
  }
  if (owner.kind === "hole") {
    if (
      !hasExactFields(owner, ["kind", "templateId", "hole"]) ||
      !isStoredRowId(owner.templateId, "templates") ||
      !canonicalText(owner.hole, MAX_KIND_LENGTH)
    ) {
      throw new Error(`resource-sets/${subject}: a hole owner names a template and a hole`);
    }
    return {
      kind: "hole",
      templateId: owner.templateId,
      hole: owner.hole
    };
  }
  if (owner.kind === "resource") {
    if (
      !hasExactFields(owner, ["kind", "ref", "hole"]) ||
      !canonicalText(owner.hole, MAX_KIND_LENGTH)
    ) {
      throw new Error(`resource-sets/${subject}: a resource owner names one resource and a hole`);
    }
    return {
      kind: "resource",
      ref: admitResourceRef(owner.ref, `resource-sets/${subject}.ref`),
      hole: owner.hole
    };
  }
  throw new Error(`resource-sets/${subject}: an owner is a hole or a resource`);
};

export const descriptionOf = (value: unknown, subject: string): string => {
  if (typeof value !== "string") throw new Error(`resource-sets/${subject}: description is text`);
  const description = value.trim();
  if (description.length > 4_000) {
    throw new Error(`resource-sets/${subject}: description is at most 4000 characters`);
  }
  return description;
};

const termOf = (value: unknown, subject: string): SetTerm => {
  const term = storedFields(value);
  if (term === undefined) throw new Error(`resource-sets/${subject}: a term is an exact current data object`);
  if (term.select === "project") {
    if (!hasExactFields(term, ["select"])) throw new Error(`resource-sets/${subject}: a project term carries nothing else`);
    return { select: "project" };
  }
  if (term.select === "kinds") {
    if (
      !hasExactFields(term, ["select", "kinds"]) ||
      !Array.isArray(term.kinds) ||
      term.kinds.length === 0 ||
      term.kinds.length > MAX_KINDS_PER_TERM ||
      !term.kinds.every(isResourceSelectorKind) ||
      new Set(term.kinds.map((kind) => (kind as string).toLocaleLowerCase())).size !== term.kinds.length
    ) {
      throw new Error(`resource-sets/${subject}: a kinds term lists distinct resource kinds`);
    }
    return { select: "kinds", kinds: [...term.kinds] };
  }
  if (term.select === "resources") {
    if (
      !hasExactFields(term, ["select", "refs"]) ||
      !Array.isArray(term.refs) ||
      term.refs.length > MAX_REFS_PER_TERM ||
      !term.refs.every((ref) => {
        try {
          admitResourceRef(ref);
          return true;
        } catch {
          return false;
        }
      })
    ) {
      throw new Error(`resource-sets/${subject}: a resources term lists resource references`);
    }
    return {
      select: "resources",
      refs: term.refs.map((ref) => admitResourceRef(ref, `resource-sets/${subject}: ref`))
    };
  }
  if (term.select === "set") {
    if (!hasExactFields(term, ["select", "setId"])) throw new Error(`resource-sets/${subject}: a set term names one set`);
    return { select: "set", setId: setIdOf(term.setId, subject) };
  }
  throw new Error(`resource-sets/${subject}: a term selects project, kinds, resources, or set`);
};

export const resourceSetOf = (value: unknown, subject: string): ResourceSet => {
  const set = exact(value, ["include", "exclude"]);
  if (
    set === undefined ||
    !Array.isArray(set.include) ||
    !Array.isArray(set.exclude) ||
    set.include.length > MAX_TERMS_PER_SIDE ||
    set.exclude.length > MAX_TERMS_PER_SIDE
  ) {
    throw new Error(`resource-sets/${subject}: a set is an include list and an exclude list`);
  }
  return {
    include: set.include.map((term) => termOf(term, subject)),
    exclude: set.exclude.map((term) => termOf(term, subject))
  };
};

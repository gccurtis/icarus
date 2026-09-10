import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";
import {
  admitResourceRef,
  isResourceSelectorKind
} from "$representation/data/behavior/core/resource";
import {
  hasExactFields,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";

const MAX_TERMS_PER_SIDE = 100;
const MAX_KINDS_PER_TERM = 100;
const MAX_REFS_PER_TERM = 1_000;

export const inputRecord = (value: unknown, message: string): Record<string, unknown> => {
  const fields = storedFields(value);
  if (fields === undefined) throw new Error(message);
  return fields;
};

export const onlyFields = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  subject: string
): void => {
  if (hasExactFields(value, [], allowed)) return;
  const unknown = Reflect.ownKeys(value).find(
    (field): field is string => typeof field === "string" && !allowed.includes(field)
  );
  if (unknown !== undefined) throw new Error(`${subject} has unknown field '${unknown}'`);
  throw new Error(`${subject} must contain only exact current data fields`);
};

export const nonblank = (value: unknown, message: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
};

export const derivedOutputId = (value: unknown): Id<"derivedOutputs"> => {
  if (!isStoredRowId(value, "derivedOutputs")) {
    throw new Error("derived output id must be one current derivedOutputs row id");
  }
  return value as Id<"derivedOutputs">;
};

const resourceSetId = (value: unknown): Id<"resourceSets"> => {
  if (!isStoredRowId(value, "resourceSets")) {
    throw new Error("derived output setId must be one current resourceSets row id");
  }
  return value as Id<"resourceSets">;
};

export const resourceRef = (value: unknown): ResourceRef => {
  try {
    return admitResourceRef(value, "derived output resource ref");
  } catch {
    throw new Error("derived output resource ref must have an exact current kind and matching row id");
  }
};

const term = (value: unknown): SetTerm => {
  const candidate = inputRecord(value, "derived output scope terms must be objects");
  if (candidate.select === "project") {
    onlyFields(candidate, ["select"], "derived output project term");
    return { select: "project" };
  }
  if (candidate.select === "kinds") {
    onlyFields(candidate, ["select", "kinds"], "derived output kinds term");
    if (
      !Array.isArray(candidate.kinds) ||
      candidate.kinds.length === 0 ||
      candidate.kinds.length > MAX_KINDS_PER_TERM ||
      candidate.kinds.some((kind) => !isResourceSelectorKind(kind)) ||
      new Set(candidate.kinds).size !== candidate.kinds.length
    ) {
      throw new Error("derived output kinds must be distinct current resource selectors");
    }
    return { select: "kinds", kinds: [...candidate.kinds] };
  }
  if (candidate.select === "resources") {
    onlyFields(candidate, ["select", "refs"], "derived output resources term");
    if (!Array.isArray(candidate.refs) || candidate.refs.length > MAX_REFS_PER_TERM) {
      throw new Error("derived output resources must be a bounded array");
    }
    return { select: "resources", refs: candidate.refs.map(resourceRef) };
  }
  if (candidate.select === "set") {
    onlyFields(candidate, ["select", "setId"], "derived output set term");
    return {
      select: "set",
      setId: resourceSetId(candidate.setId)
    };
  }
  throw new Error("derived output scope has an unknown term");
};

export const resourceSet = (value: unknown): ResourceSet => {
  const candidate = inputRecord(value, "derived output scope must be an object");
  onlyFields(candidate, ["include", "exclude"], "derived output scope");
  if (
    !Array.isArray(candidate.include) ||
    !Array.isArray(candidate.exclude) ||
    candidate.include.length > MAX_TERMS_PER_SIDE ||
    candidate.exclude.length > MAX_TERMS_PER_SIDE
  ) {
    throw new Error("derived output scope requires bounded include and exclude arrays");
  }
  return { include: candidate.include.map(term), exclude: candidate.exclude.map(term) };
};

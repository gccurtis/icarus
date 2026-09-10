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
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";

const MAX_TERMS_PER_SIDE = 100;
const MAX_KINDS_PER_TERM = 100;
const MAX_REFS_PER_TERM = 1_000;

export const queryRecord = (value: unknown, message: string): Record<string, unknown> => {
  const fields = storedFields(value);
  if (fields === undefined || !isStoredJson(value)) throw new Error(message);
  return fields;
};

export const onlyQueryFields = (
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

const setIdOf = (value: unknown, subject: string): Id<"resourceSets"> => {
  if (!isStoredRowId(value, "resourceSets")) {
    throw new Error(`${subject} setId must be one current resourceSets row id`);
  }
  return value as Id<"resourceSets">;
};

const termOf = (value: unknown, subject: string): SetTerm => {
  const held = queryRecord(value, `${subject} terms must be objects`);
  if (held.select === "project") {
    onlyQueryFields(held, ["select"], `${subject} project term`);
    return { select: "project" };
  }
  if (held.select === "kinds") {
    onlyQueryFields(held, ["select", "kinds"], `${subject} kinds term`);
    if (
      !Array.isArray(held.kinds) ||
      held.kinds.length === 0 ||
      held.kinds.length > MAX_KINDS_PER_TERM ||
      held.kinds.some((kind) => !isResourceSelectorKind(kind)) ||
      new Set(held.kinds).size !== held.kinds.length
    ) throw new Error(`${subject} kinds must be distinct current resource selectors`);
    return { select: "kinds", kinds: [...held.kinds] };
  }
  if (held.select === "resources") {
    onlyQueryFields(held, ["select", "refs"], `${subject} resources term`);
    if (!Array.isArray(held.refs) || held.refs.length > MAX_REFS_PER_TERM) {
      throw new Error(`${subject} resources must be a bounded array`);
    }
    return {
      select: "resources",
      refs: held.refs.map((ref) => admitResourceRef(ref, `${subject} resource ref`))
    };
  }
  if (held.select === "set") {
    onlyQueryFields(held, ["select", "setId"], `${subject} set term`);
    return { select: "set", setId: setIdOf(held.setId, subject) };
  }
  throw new Error(`${subject} has an unknown term`);
};

export const queryResourceSet = (value: unknown, subject: string): ResourceSet => {
  const held = queryRecord(value, `${subject} must be an object`);
  onlyQueryFields(held, ["include", "exclude"], subject);
  if (
    !Array.isArray(held.include) ||
    !Array.isArray(held.exclude) ||
    held.include.length > MAX_TERMS_PER_SIDE ||
    held.exclude.length > MAX_TERMS_PER_SIDE
  ) throw new Error(`${subject} requires bounded include and exclude arrays`);
  return {
    include: held.include.map((term) => termOf(term, subject)),
    exclude: held.exclude.map((term) => termOf(term, subject))
  };
};

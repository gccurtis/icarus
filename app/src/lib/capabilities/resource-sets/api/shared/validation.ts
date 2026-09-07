import { asId } from "$representation/data/behavior/core/id";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";

type Fields = Record<string, unknown>;

const MAX_TERMS_PER_SIDE = 100;
const MAX_KINDS_PER_TERM = 100;
const MAX_REFS_PER_TERM = 1_000;
const MAX_KIND_LENGTH = 160;
const MAX_IDENTIFIER_LENGTH = 500;

export const fieldsOf = (value: unknown, subject: string): Fields => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`resource-sets/${subject}: an object is required`);
  }
  return value as Fields;
};

export const has = (fields: Fields, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(fields, field);

export const only = (fields: Fields, allowed: readonly string[], subject: string): void => {
  const extra = Object.keys(fields).filter((field) => !allowed.includes(field));
  if (extra.length > 0) {
    throw new Error(
      `resource-sets/${subject}: unknown ${extra.length === 1 ? "field" : "fields"} ${extra.join(", ")}`
    );
  }
};

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const canonicalText = (value: unknown, maximum: number): value is string =>
  typeof value === "string" &&
  value === value.trim() &&
  value.length > 0 &&
  value.length <= maximum;

export const setIdOf = (value: unknown, subject: string): string => {
  if (typeof value !== "string" || !/^resourceSets:[^.:\s]+$/.test(value)) {
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

export const descriptionOf = (value: unknown, subject: string): string => {
  if (typeof value !== "string") throw new Error(`resource-sets/${subject}: description is text`);
  const description = value.trim();
  if (description.length > 4_000) {
    throw new Error(`resource-sets/${subject}: description is at most 4000 characters`);
  }
  return description;
};

const termOf = (value: unknown, subject: string): SetTerm => {
  if (!isRecord(value)) throw new Error(`resource-sets/${subject}: a term is an object`);
  if (value.select === "project") {
    if (Object.keys(value).length !== 1) throw new Error(`resource-sets/${subject}: a project term carries nothing else`);
    return { select: "project" };
  }
  if (value.select === "kinds") {
    if (
      Object.keys(value).length !== 2 ||
      !Array.isArray(value.kinds) ||
      value.kinds.length === 0 ||
      value.kinds.length > MAX_KINDS_PER_TERM ||
      !value.kinds.every((kind) => canonicalText(kind, MAX_KIND_LENGTH)) ||
      new Set(value.kinds.map((kind) => (kind as string).toLocaleLowerCase())).size !== value.kinds.length
    ) {
      throw new Error(`resource-sets/${subject}: a kinds term lists distinct resource kinds`);
    }
    return { select: "kinds", kinds: [...(value.kinds as string[])] };
  }
  if (value.select === "resources") {
    if (
      Object.keys(value).length !== 2 ||
      !Array.isArray(value.refs) ||
      value.refs.length > MAX_REFS_PER_TERM ||
      !value.refs.every(
        (ref) =>
          isRecord(ref) &&
          Object.keys(ref).length === 2 &&
          canonicalText(ref.kind, MAX_KIND_LENGTH) &&
          canonicalText(ref.id, MAX_IDENTIFIER_LENGTH)
      )
    ) {
      throw new Error(`resource-sets/${subject}: a resources term lists resource references`);
    }
    return {
      select: "resources",
      refs: (value.refs as { kind: string; id: string }[]).map((ref) => ({ kind: ref.kind, id: ref.id }))
    };
  }
  if (value.select === "set") {
    if (Object.keys(value).length !== 2) throw new Error(`resource-sets/${subject}: a set term names one set`);
    return { select: "set", setId: asId<"resourceSets">(setIdOf(value.setId, subject)) };
  }
  throw new Error(`resource-sets/${subject}: a term selects project, kinds, resources, or set`);
};

export const resourceSetOf = (value: unknown, subject: string): ResourceSet => {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    !Array.isArray(value.include) ||
    !Array.isArray(value.exclude) ||
    value.include.length > MAX_TERMS_PER_SIDE ||
    value.exclude.length > MAX_TERMS_PER_SIDE
  ) {
    throw new Error(`resource-sets/${subject}: a set is an include list and an exclude list`);
  }
  return {
    include: value.include.map((term) => termOf(term, subject)),
    exclude: value.exclude.map((term) => termOf(term, subject))
  };
};

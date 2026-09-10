import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";
import type { TemplateHole } from "$representation/data/types/templates/template";
import type { TemplateAnswers } from "$capabilities/templates/types/templates";

type Fields = Record<string, unknown>;

const MAX_TEMPLATE_HOLES = 100;
const MAX_TEMPLATE_TERMS_PER_SIDE = 100;
const MAX_TEMPLATE_KINDS_PER_TERM = 100;
export const TEMPLATE_HOLE_NAME_LIMIT = 160;
const MAX_HOLE_LABEL_LENGTH = 500;
export const TEMPLATE_HOLE_DESCRIPTION_LIMIT = 4_000;
const MAX_RESOURCE_KIND_LENGTH = 160;
const MAX_IDENTIFIER_LENGTH = 500;
const MAX_BLOCK_TEXT_LENGTH = 100_000;

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const hasOnlyKeys = (value: Fields, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));
const validText = (value: unknown, maximum: number, allowEmpty = false): value is string =>
  typeof value === "string" && value.length <= maximum && (allowEmpty || value.length > 0);
const validCanonicalText = (value: unknown, maximum: number): value is string =>
  validText(value, maximum) && value === value.trim();
const validIdentifier = (value: unknown): value is string =>
  validCanonicalText(value, MAX_IDENTIFIER_LENGTH);

const assertStoredValue = (value: unknown, subject: string): void => {
  const seen = new WeakSet<object>();
  const walk = (step: unknown): void => {
    if (step === undefined) throw new Error(`templates/${subject}: undefined is not stored`);
    if (typeof step === "function" || typeof step === "symbol" || typeof step === "bigint") {
      throw new Error(`templates/${subject}: ${typeof step} is not stored`);
    }
    if (step === null || typeof step !== "object") return;
    if (seen.has(step)) {
      throw new Error(`templates/${subject}: a stored value cannot contain a cycle`);
    }
    seen.add(step);
    for (const nested of Object.values(step)) walk(nested);
  };
  walk(value);
};

const validTerm = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value.select === "project") {
    return hasOnlyKeys(value, ["select"]) && Object.keys(value).length === 1;
  }
  if (value.select === "hole") {
    return (
      hasOnlyKeys(value, ["select", "name"]) &&
      Object.keys(value).length === 2 &&
      validCanonicalText(value.name, TEMPLATE_HOLE_NAME_LIMIT)
    );
  }
  if (value.select === "set") {
    return (
      hasOnlyKeys(value, ["select", "setId"]) &&
      Object.keys(value).length === 2 &&
      typeof value.setId === "string" &&
      /^resourceSets:[^.:\s]+$/.test(value.setId)
    );
  }
  if (
    value.select !== "kinds" ||
    !hasOnlyKeys(value, ["select", "kinds"]) ||
    Object.keys(value).length !== 2 ||
    !Array.isArray(value.kinds) ||
    value.kinds.length === 0 ||
    value.kinds.length > MAX_TEMPLATE_KINDS_PER_TERM ||
    !value.kinds.every((kind) => validCanonicalText(kind, MAX_RESOURCE_KIND_LENGTH))
  ) {
    return false;
  }
  return new Set(value.kinds.map((kind) => kind.toLocaleLowerCase())).size === value.kinds.length;
};

const validSetTerm = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value.select === "project") return Object.keys(value).length === 1;
  if (value.select === "kinds") return validTerm(value);
  if (value.select === "set") {
    return (
      hasOnlyKeys(value, ["select", "setId"]) &&
      typeof value.setId === "string" &&
      /^resourceSets:[^.:\s]+$/.test(value.setId)
    );
  }
  return (
    value.select === "resources" &&
    hasOnlyKeys(value, ["select", "refs"]) &&
    Array.isArray(value.refs) &&
    value.refs.length <= 1_000 &&
    value.refs.every(
      (ref) =>
        isRecord(ref) &&
        hasOnlyKeys(ref, ["kind", "id"]) &&
        validCanonicalText(ref.kind, MAX_RESOURCE_KIND_LENGTH) &&
        validIdentifier(ref.id)
    )
  );
};

export const resourceSetOf = (value: unknown, subject: string): ResourceSet => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["include", "exclude"]) ||
    !Array.isArray(value.include) ||
    !Array.isArray(value.exclude) ||
    value.include.length > MAX_TEMPLATE_TERMS_PER_SIDE ||
    value.exclude.length > MAX_TEMPLATE_TERMS_PER_SIDE ||
    !value.include.every(validSetTerm) ||
    !value.exclude.every(validSetTerm)
  ) {
    throw new Error(
      `templates/${subject}: a resource set is an include list and an exclude list`
    );
  }
  return {
    include: (value.include as SetTerm[]).map((term) => structuredClone(term)),
    exclude: (value.exclude as SetTerm[]).map((term) => structuredClone(term))
  };
};

export const answersOf = (value: unknown, subject: string): TemplateAnswers => {
  if (!isRecord(value)) {
    throw new Error(`templates/${subject}: answers map hole names to resource sets`);
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_TEMPLATE_HOLES) {
    throw new Error(`templates/${subject}: at most ${MAX_TEMPLATE_HOLES} holes are answered`);
  }
  const answers: Record<string, ResourceSet> = {};
  for (const [name, answer] of entries) {
    if (!validCanonicalText(name, TEMPLATE_HOLE_NAME_LIMIT)) {
      throw new Error(`templates/${subject}: every answered hole has a name`);
    }
    answers[name] = resourceSetOf(answer, subject);
  }
  return answers;
};

export const textsOf = (
  value: unknown,
  subject: string
): Readonly<Record<string, string>> => {
  if (!isRecord(value)) throw new Error(`templates/${subject}: texts map hole names to words`);
  const entries = Object.entries(value);
  if (entries.length > MAX_TEMPLATE_HOLES) {
    throw new Error(`templates/${subject}: at most ${MAX_TEMPLATE_HOLES} holes are answered`);
  }
  const texts: Record<string, string> = {};
  for (const [name, words] of entries) {
    if (!validCanonicalText(name, TEMPLATE_HOLE_NAME_LIMIT)) {
      throw new Error(`templates/${subject}: every answered hole has a name`);
    }
    if (!validText(words, MAX_BLOCK_TEXT_LENGTH, true)) {
      throw new Error(`templates/${subject}: a text answer is words`);
    }
    texts[name] = words as string;
  }
  return texts;
};

export const validTemplatedResourceSet = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["include", "exclude"]) &&
  Object.keys(value).length === 2 &&
  Array.isArray(value.include) &&
  value.include.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.include.every(validTerm) &&
  Array.isArray(value.exclude) &&
  value.exclude.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.exclude.every(validTerm);

const validChosenSet = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["include", "exclude"]) &&
  Object.keys(value).length === 2 &&
  Array.isArray(value.include) &&
  value.include.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.include.every((term) => validTerm(term) || validSetTerm(term)) &&
  Array.isArray(value.exclude) &&
  value.exclude.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.exclude.every((term) => validTerm(term) || validSetTerm(term));

export const holesOf = (
  value: unknown,
  subject: string,
  chosen = false
): readonly TemplateHole[] => {
  if (!Array.isArray(value)) throw new Error(`templates/${subject}: holes is a list`);
  if (value.length > MAX_TEMPLATE_HOLES) {
    throw new Error(`templates/${subject}: a template has at most ${MAX_TEMPLATE_HOLES} holes`);
  }
  const seen = new Set<string>();
  const declared = new Set<string>();
  for (const hole of value) {
    if (
      !isRecord(hole) ||
      !hasOnlyKeys(hole, ["name", "label", "description", "kind", "default", "text"])
    ) {
      throw new Error(`templates/${subject}: a hole has only represented fields`);
    }
    if (hole.kind !== undefined && hole.kind !== "scope" && hole.kind !== "text") {
      throw new Error(`templates/${subject}: a hole is answered with a scope or with text`);
    }
    if (hole.kind === "text" && hole.default !== undefined) {
      throw new Error(`templates/${subject}: a text hole has no default scope`);
    }
    if (
      hole.text !== undefined &&
      (hole.kind !== "text" || !validText(hole.text, MAX_BLOCK_TEXT_LENGTH, true))
    ) {
      throw new Error(`templates/${subject}: a hole's default words are text`);
    }
    if (!validCanonicalText(hole.name, TEMPLATE_HOLE_NAME_LIMIT)) {
      throw new Error(`templates/${subject}: every hole has a name`);
    }
    if (!validCanonicalText(hole.label, MAX_HOLE_LABEL_LENGTH)) {
      throw new Error(`templates/${subject}: every hole has a label`);
    }
    if (
      hole.description !== undefined &&
      (typeof hole.description !== "string" ||
        hole.description.length > TEMPLATE_HOLE_DESCRIPTION_LIMIT ||
        hole.description !== hole.description.trim())
    ) {
      throw new Error(`templates/${subject}: a hole description is text`);
    }
    if (
      hole.default !== undefined &&
      !(chosen ? validChosenSet(hole.default) : validTemplatedResourceSet(hole.default))
    ) {
      throw new Error(`templates/${subject}: a hole default is a templated resource set`);
    }
    const key = hole.name.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`templates/${subject}: hole names are unique`);
    seen.add(key);
    declared.add(hole.name);
  }
  for (const hole of value as Fields[]) {
    if (!isRecord(hole.default)) continue;
    const terms = [
      ...((hole.default.include as unknown[]) ?? []),
      ...((hole.default.exclude as unknown[]) ?? [])
    ];
    for (const term of terms) {
      if (isRecord(term) && term.select === "hole" && !declared.has(term.name as string)) {
        throw new Error(`templates/${subject}: a hole default names a declared hole`);
      }
    }
  }
  assertStoredValue(value, subject);
  return value as readonly TemplateHole[];
};

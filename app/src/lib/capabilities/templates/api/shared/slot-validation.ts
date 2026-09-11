import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";
import {
  isResourceRef,
  isResourceSelectorKind
} from "$representation/data/behavior/core/resource";
import type {
  TemplateSlot,
  TemplateVersionSlot
} from "$representation/data/types/templates/template";
import type { TemplateAnswers } from "$capabilities/templates/types/templates";
import {
  hasExactFields,
  isStoredJson,
  storedFields
} from "$representation/data/behavior/core/stored";

type Fields = Record<string, unknown>;

const MAX_TEMPLATE_SLOTS = 100;
const MAX_TEMPLATE_TERMS_PER_SIDE = 100;
const MAX_TEMPLATE_KINDS_PER_TERM = 100;
export const TEMPLATE_SLOT_NAME_LIMIT = 160;
const MAX_SLOT_LABEL_LENGTH = 500;
export const TEMPLATE_SLOT_DESCRIPTION_LIMIT = 4_000;
const MAX_BLOCK_TEXT_LENGTH = 100_000;

const isRecord = (value: unknown): value is Fields =>
  storedFields(value) !== undefined;
const hasOnlyKeys = (value: Fields, allowed: readonly string[]): boolean =>
  hasExactFields(value, [], allowed);
const validText = (value: unknown, maximum: number, allowEmpty = false): value is string =>
  typeof value === "string" && value.length <= maximum && (allowEmpty || value.length > 0);
const validCanonicalText = (value: unknown, maximum: number): value is string =>
  validText(value, maximum) && value === value.trim();
const assertStoredValue = (value: unknown, subject: string): void => {
  if (!isStoredJson(value)) {
    throw new Error(`templates/${subject}: value must be exact current JSON data`);
  }
};

const validTerm = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value.select === "project") {
    return hasOnlyKeys(value, ["select"]) && Object.keys(value).length === 1;
  }
  if (value.select === "slot") {
    return (
      hasOnlyKeys(value, ["select", "name"]) &&
      Object.keys(value).length === 2 &&
      validCanonicalText(value.name, TEMPLATE_SLOT_NAME_LIMIT)
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
    !value.kinds.every(isResourceSelectorKind)
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
    value.refs.every(isResourceRef)
  );
};

export const resourceSetOf = (value: unknown, subject: string): ResourceSet => {
  assertStoredValue(value, subject);
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
  assertStoredValue(value, subject);
  if (!isRecord(value)) {
    throw new Error(`templates/${subject}: answers map slot names to resource sets`);
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_TEMPLATE_SLOTS) {
    throw new Error(`templates/${subject}: at most ${MAX_TEMPLATE_SLOTS} slots are answered`);
  }
  const answers: Record<string, ResourceSet> = {};
  for (const [name, answer] of entries) {
    if (!validCanonicalText(name, TEMPLATE_SLOT_NAME_LIMIT)) {
      throw new Error(`templates/${subject}: every answered slot has a name`);
    }
    answers[name] = resourceSetOf(answer, subject);
  }
  return answers;
};

export const textsOf = (
  value: unknown,
  subject: string
): Readonly<Record<string, string>> => {
  assertStoredValue(value, subject);
  if (!isRecord(value)) throw new Error(`templates/${subject}: texts map slot names to words`);
  const entries = Object.entries(value);
  if (entries.length > MAX_TEMPLATE_SLOTS) {
    throw new Error(`templates/${subject}: at most ${MAX_TEMPLATE_SLOTS} slots are answered`);
  }
  const texts: Record<string, string> = {};
  for (const [name, words] of entries) {
    if (!validCanonicalText(name, TEMPLATE_SLOT_NAME_LIMIT)) {
      throw new Error(`templates/${subject}: every answered slot has a name`);
    }
    if (!validText(words, MAX_BLOCK_TEXT_LENGTH, true)) {
      throw new Error(`templates/${subject}: a text answer is words`);
    }
    texts[name] = words as string;
  }
  return texts;
};

export const validTemplatedResourceSet = (value: unknown): boolean =>
  isStoredJson(value) &&
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
  isStoredJson(value) &&
  isRecord(value) &&
  hasOnlyKeys(value, ["include", "exclude"]) &&
  Object.keys(value).length === 2 &&
  Array.isArray(value.include) &&
  value.include.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.include.every((term) => validTerm(term) || validSetTerm(term)) &&
  Array.isArray(value.exclude) &&
  value.exclude.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.exclude.every((term) => validTerm(term) || validSetTerm(term));

const checkedSlots = (
  value: unknown,
  subject: string,
  chosen = false
): readonly Fields[] => {
  assertStoredValue(value, subject);
  if (!Array.isArray(value)) throw new Error(`templates/${subject}: slots is a list`);
  if (value.length > MAX_TEMPLATE_SLOTS) {
    throw new Error(`templates/${subject}: a template has at most ${MAX_TEMPLATE_SLOTS} slots`);
  }
  const seen = new Set<string>();
  const declared = new Set<string>();
  for (const slot of value) {
    if (
      !isRecord(slot) ||
      !hasOnlyKeys(slot, ["name", "label", "description", "kind", "default", "text"])
    ) {
      throw new Error(`templates/${subject}: a slot has only represented fields`);
    }
    if (slot.kind !== "scope" && slot.kind !== "text") {
      throw new Error(`templates/${subject}: a slot is answered with a scope or with text`);
    }
    if (slot.kind === "text" && slot.default !== undefined) {
      throw new Error(`templates/${subject}: a text slot has no default scope`);
    }
    if (
      slot.text !== undefined &&
      (slot.kind !== "text" || !validText(slot.text, MAX_BLOCK_TEXT_LENGTH, true))
    ) {
      throw new Error(`templates/${subject}: a slot's default words are text`);
    }
    if (!validCanonicalText(slot.name, TEMPLATE_SLOT_NAME_LIMIT)) {
      throw new Error(`templates/${subject}: every slot has a name`);
    }
    if (!validCanonicalText(slot.label, MAX_SLOT_LABEL_LENGTH)) {
      throw new Error(`templates/${subject}: every slot has a label`);
    }
    if (
      slot.description !== undefined &&
      (typeof slot.description !== "string" ||
        slot.description.length > TEMPLATE_SLOT_DESCRIPTION_LIMIT ||
        slot.description !== slot.description.trim())
    ) {
      throw new Error(`templates/${subject}: a slot description is text`);
    }
    if (
      slot.default !== undefined &&
      !(chosen ? validChosenSet(slot.default) : validTemplatedResourceSet(slot.default))
    ) {
      throw new Error(`templates/${subject}: a slot default is a templated resource set`);
    }
    const key = slot.name.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`templates/${subject}: slot names are unique`);
    seen.add(key);
    declared.add(slot.name);
  }
  for (const slot of value as Fields[]) {
    if (!isRecord(slot.default)) continue;
    const terms = [
      ...(slot.default.include as unknown[]),
      ...(slot.default.exclude as unknown[])
    ];
    for (const term of terms) {
      if (isRecord(term) && term.select === "slot" && !declared.has(term.name as string)) {
        throw new Error(`templates/${subject}: a slot default names a declared slot`);
      }
    }
  }
  return value as readonly Fields[];
};

/** A live template stores only terms its templated scope can own inline. */
export const slotsOf = (
  value: unknown,
  subject: string,
  chosen = false
): readonly TemplateSlot[] =>
  checkedSlots(value, subject, chosen) as readonly TemplateSlot[];

/** A history row additionally owns concrete resource selections. */
export const versionSlotsOf = (
  value: unknown,
  subject: string
): readonly TemplateVersionSlot[] =>
  checkedSlots(value, subject, true) as readonly TemplateVersionSlot[];

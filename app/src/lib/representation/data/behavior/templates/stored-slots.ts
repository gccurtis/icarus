import { currentResourceRef } from "$representation/data/behavior/content/admission";
import { isResourceSelectorKind } from "$representation/data/behavior/core/resource";
import {
  hasExactFields,
  isStoredRowId,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import type {
  TemplateSlot,
  TemplateVersionSlot
} from "$representation/data/types/templates/template";

type SlotKind = "live" | "version";

const canonical = (value: unknown, maximum = 160): value is string =>
  isStoredText(value, maximum) && value.length > 0 && value === value.trim();

const scopeTerm = (value: unknown, kind: SlotKind): boolean => {
  const term = storedFields(value);
  if (term === undefined) return false;
  if (term.select === "project") return hasExactFields(term, ["select"]);
  if (term.select === "kinds") {
    return hasExactFields(term, ["select", "kinds"]) &&
      Array.isArray(term.kinds) &&
      term.kinds.length > 0 &&
      term.kinds.length <= 100 &&
      term.kinds.every(isResourceSelectorKind) &&
      new Set(term.kinds).size === term.kinds.length;
  }
  if (term.select === "set") {
    return hasExactFields(term, ["select", "setId"]) &&
      isStoredRowId(term.setId, "resourceSets");
  }
  if (term.select === "slot") {
    return hasExactFields(term, ["select", "name"]) && canonical(term.name);
  }
  return kind === "version" &&
    term.select === "resources" &&
    hasExactFields(term, ["select", "refs"]) &&
    Array.isArray(term.refs) &&
    term.refs.length <= 1_000 &&
    term.refs.every(currentResourceRef);
};

const scope = (value: unknown, kind: SlotKind): boolean => {
  const held = storedFields(value);
  return held !== undefined &&
    hasExactFields(held, ["include", "exclude"]) &&
    Array.isArray(held.include) && held.include.length <= 100 && held.include.every((term) => scopeTerm(term, kind)) &&
    Array.isArray(held.exclude) && held.exclude.length <= 100 && held.exclude.every((term) => scopeTerm(term, kind));
};

const slot = (value: unknown, kind: SlotKind): boolean => {
  const held = storedFields(value);
  if (
    held === undefined ||
    !hasExactFields(held, ["name", "label", "kind"], ["description", "default", "text"]) ||
    !canonical(held.name) ||
    !canonical(held.label, 500) ||
    (held.description !== undefined && (
      !isStoredText(held.description, 4_000) || held.description !== held.description.trim()
    ))
  ) return false;
  if (held.kind === "text") {
    return held.default === undefined &&
      (held.text === undefined || isStoredText(held.text));
  }
  return held.kind === "scope" && held.text === undefined &&
    (held.default === undefined || scope(held.default, kind));
};

const slots = (value: unknown, kind: SlotKind): boolean => {
  if (!Array.isArray(value) || value.length > 100 || !value.every((entry) => slot(entry, kind))) {
    return false;
  }
  const held = value as Array<{ name: string; default?: { include: unknown[]; exclude: unknown[] } }>;
  const names = held.map((entry) => entry.name);
  if (new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length) return false;
  const declared = new Set(names);
  return held.every((entry) => {
    if (entry.default === undefined) return true;
    const terms = [...entry.default.include, ...entry.default.exclude];
    return terms.every((term) => {
      const fields = storedFields(term);
      return fields?.select !== "slot" || (
        typeof fields.name === "string" && declared.has(fields.name)
      );
    });
  });
};

export const isStoredTemplateSlots = (value: unknown): value is TemplateSlot[] =>
  slots(value, "live");

export const isStoredTemplateVersionSlots = (value: unknown): value is TemplateVersionSlot[] =>
  slots(value, "version");

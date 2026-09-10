import { exact, recordOf, text } from "$representation/data/behavior/content/admission-values";
import { isStoredRowId } from "$representation/data/behavior/core/stored";
import {
  currentAgentRow,
  currentResourceSet,
  nonemptyText,
  storedTools
} from "$representation/data/behavior/agents/stored/shared";
import type { TableRow } from "$representation/store/tables";

const definition = (value: unknown): boolean => {
  const held = recordOf(value);
  return held !== undefined &&
    exact(held, ["focus", "background", "approach", "outputPreferences", "verification"]) &&
    text(held.focus) && text(held.background) && text(held.approach) &&
    text(held.outputPreferences) && text(held.verification);
};

const cast = (value: unknown): boolean => {
  const held = recordOf(value);
  const level = (candidate: unknown) =>
    candidate === "low" || candidate === "medium" || candidate === "high";
  return held !== undefined && exact(held, ["label", "strength", "speed"]) &&
    nonemptyText(held.label) && level(held.strength) && level(held.speed);
};

const avatar = (value: unknown): boolean => {
  const held = recordOf(value);
  if (held === undefined) return false;
  if (held.kind === "emoji") return exact(held, ["kind", "emoji"]) && nonemptyText(held.emoji);
  return held.kind === "image" && exact(held, ["kind", "storageId"]) &&
    isStoredRowId(held.storageId, "_storage");
};

const PERSONA_FIELDS = ["name", "definition", "tools"] as const;

export const isStoredPersona = (value: unknown): value is TableRow<"personas"> => {
  if (!currentAgentRow(
    value,
    "personas",
    PERSONA_FIELDS,
    ["description", "scope", "cast", "avatar"]
  )) return false;
  return nonemptyText(value.name) &&
    (value.description === undefined || text(value.description)) &&
    definition(value.definition) &&
    (value.scope === undefined || currentResourceSet(value.scope)) &&
    (value.cast === undefined || cast(value.cast)) &&
    storedTools(value.tools) &&
    (value.avatar === undefined || avatar(value.avatar));
};

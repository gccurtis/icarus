import {
  TRIGGER_RESOURCE_KINDS,
  isRepeat,
  isTriggerKind,
  isWeekday
} from "$representation/data/behavior/agents/triggers";
import {
  currentAgentRow,
  currentResourceSet,
  nonemptyText,
  storedTools
} from "$representation/data/behavior/agents/stored/shared";
import { isResourceRef, isResourceSelectorKind } from "$representation/data/behavior/core/resource";
import { exact, identifier, recordOf, text } from "$representation/data/behavior/content/admission-values";
import { isStoredRowId, isStoredTime } from "$representation/data/behavior/core/stored";
import type { ResourceSelectorKind } from "$representation/data/types/core/resource";
import type { TableRow } from "$representation/store/tables";

const selectorKinds = (value: unknown): boolean => {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isResourceSelectorKind)) {
    return false;
  }
  const order = new Map<ResourceSelectorKind, number>(
    TRIGGER_RESOURCE_KINDS.map((kind, index) => [kind.id, index])
  );
  return value.every((kind) => order.has(kind)) && new Set(value).size === value.length &&
    value.every((kind, index) => index === 0 || order.get(kind)! > order.get(value[index - 1])!);
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const trigger = (value: unknown): boolean => {
  const held = recordOf(value);
  if (held === undefined || !isTriggerKind(held.kind)) return false;
  if (held.kind === "manual") return exact(held, ["kind"]);
  if (held.kind === "schedule") {
    const base = typeof held.at === "string" && TIME.test(held.at) &&
      identifier(held.timezone) && isRepeat(held.repeats);
    if (!base) return false;
    return held.repeats === "weekly"
      ? exact(held, ["kind", "at", "repeats", "weekday", "timezone"]) &&
        isWeekday(held.weekday)
      : exact(held, ["kind", "at", "repeats", "timezone"]);
  }
  if (held.kind === "resource-edited") {
    return exact(held, ["kind", "kinds"], ["ref"]) && selectorKinds(held.kinds) &&
      (!Object.hasOwn(held, "ref") || isResourceRef(held.ref));
  }
  return exact(held, ["kind", "kinds"]) && selectorKinds(held.kinds);
};

const AUTOMATION_FIELDS = [
  "name", "personaId", "instruction", "trigger", "tools", "enabled", "firedCount"
] as const;

export const isStoredAutomation = (value: unknown): value is TableRow<"automations"> => {
  if (!currentAgentRow(
    value,
    "automations",
    AUTOMATION_FIELDS,
    ["scope", "lastFiredAt"]
  )) return false;
  return nonemptyText(value.name) && isStoredRowId(value.personaId, "personas") &&
    text(value.instruction) && trigger(value.trigger) &&
    (value.scope === undefined || currentResourceSet(value.scope)) && storedTools(value.tools) &&
    typeof value.enabled === "boolean" &&
    Number.isSafeInteger(value.firedCount) && (value.firedCount as number) >= 0 &&
    (value.lastFiredAt === undefined || isStoredTime(value.lastFiredAt));
};

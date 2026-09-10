import type { PlanStep } from "$representation/data/types/agents/agent-task";
import type {
  AutomationTrigger,
  ScheduleRepeat,
  Weekday
} from "$representation/data/types/agents/automation";
import type { Cast, PersonaDefinition } from "$representation/data/types/agents/persona";
import type { ToolId } from "$representation/data/types/agents/tool";
import type { Id } from "$representation/data/types/core/id";
import type { TableName } from "$model/server/store/index.server";
import type {
  ResourceRef,
  ResourceSelectorKind
} from "$representation/data/types/core/resource";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";
import {
  admitResourceRef,
  isResourceSelectorKind
} from "$representation/data/behavior/core/resource";
import { isToolId, orderedTools } from "$representation/data/behavior/agents/tools";
import {
  TRIGGER_RESOURCE_KINDS,
  isRepeat,
  isTriggerKind,
  isWeekday
} from "$representation/data/behavior/agents/triggers";
import { isStoredRowId } from "$representation/data/behavior/core/stored";

import type { PersonaSectionName } from "$capabilities/agents/types/agents";

import {
  fieldsOf,
  has,
  only,
  type Fields
} from "$capabilities/agents/api/shared/validation-fields";

export { fieldsOf, has, only } from "$capabilities/agents/api/shared/validation-fields";

const fail = (subject: string, message: string): never => {
  throw new Error(`agents/${subject}: ${message}`);
};

export const idOf = <Table extends TableName>(
  value: unknown,
  table: Table,
  subject: string,
  field: string
): Id<Table> => {
  if (!isStoredRowId(value, table)) {
    fail(subject, `${field} is one current ${table} id`);
  }
  return value as Id<Table>;
};

export const revisionOf = (value: unknown, subject: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    fail(subject, "baseRevision is a positive integer");
  }
  return value as number;
};

export const textOf = (value: unknown, subject: string, field: string, max: number): string => {
  if (typeof value !== "string") fail(subject, `${field} is text`);
  const text = (value as string).trim();
  if (text.length === 0) fail(subject, `${field} is required`);
  if (text.length > max) fail(subject, `${field} is at most ${max} characters`);
  return text;
};

export const optionalTextOf = (
  value: unknown,
  subject: string,
  field: string,
  max: number
): string | undefined => {
  if (typeof value !== "string") fail(subject, `${field} is text`);
  const text = (value as string).trim();
  if (text.length > max) fail(subject, `${field} is at most ${max} characters`);
  return text.length === 0 ? undefined : text;
};

export const nameOf = (value: unknown, subject: string): string => textOf(value, subject, "name", 160);

export const instructionOf = (value: unknown, subject: string): string =>
  textOf(value, subject, "instruction", 20_000);

export const booleanOf = (value: unknown, subject: string, field: string): boolean => {
  if (typeof value !== "boolean") fail(subject, `${field} is true or false`);
  return value as boolean;
};

export const toolsOf = (value: unknown, subject: string): readonly ToolId[] => {
  if (!Array.isArray(value)) fail(subject, "tools is a list of tool ids");
  const list = value as unknown[];
  for (const entry of list) {
    if (!isToolId(entry)) fail(subject, `${String(entry)} is not a tool`);
  }
  const ordered = orderedTools(list as string[]);
  if (
    ordered.length !== list.length ||
    ordered.some((entry, index) => entry !== list[index])
  ) fail(subject, "tools contains unique ids in catalogue order");
  return ordered;
};

export const resourceRefOf = (value: unknown, subject: string): ResourceRef => {
  try {
    return admitResourceRef(value, `agents/${subject}: ref`);
  } catch {
    return fail(subject, "ref is one exact current resource reference");
  }
};

const kindsOf = (value: unknown, subject: string): ResourceSelectorKind[] => {
  if (!Array.isArray(value) || value.length === 0) fail(subject, "kinds names at least one kind");
  const values = value as unknown[];
  if (!values.every(isResourceSelectorKind)) fail(subject, "kinds contains only current resource selectors");
  if (new Set(values).size !== values.length) fail(subject, "kinds contains no duplicate selector");
  const kinds = values as ResourceSelectorKind[];
  const order = new Map<ResourceSelectorKind, number>(
    TRIGGER_RESOURCE_KINDS.map((kind, index) => [kind.id, index])
  );
  if (kinds.some((kind) => !order.has(kind))) fail(subject, "kinds contains only trigger resource families");
  if (kinds.some((kind, index) => index > 0 && order.get(kind)! <= order.get(kinds[index - 1])!)) {
    fail(subject, "kinds follows catalogue order");
  }
  return [...kinds];
};

const termOf = (value: unknown, subject: string): SetTerm => {
  const fields = fieldsOf(value, subject);
  if (fields.select === "project") {
    only(fields, ["select"], subject);
    return { select: "project" };
  }
  if (fields.select === "kinds") {
    only(fields, ["select", "kinds"], subject);
    return { select: "kinds", kinds: kindsOf(fields.kinds, subject) };
  }
  if (fields.select === "resources") {
    only(fields, ["select", "refs"], subject);
    if (!Array.isArray(fields.refs)) fail(subject, "refs is a list");
    return {
      select: "resources",
      refs: (fields.refs as unknown[]).map((entry) => resourceRefOf(entry, subject))
    };
  }
  if (fields.select === "set") {
    only(fields, ["select", "setId"], subject);
    return { select: "set", setId: idOf(fields.setId, "resourceSets", subject, "setId") };
  }
  return fail(subject, "a term selects project, kinds, resources or set");
};

export const resourceSetOf = (value: unknown, subject: string): ResourceSet => {
  const fields = fieldsOf(value, subject);
  only(fields, ["include", "exclude"], subject);
  if (!Array.isArray(fields.include) || !Array.isArray(fields.exclude)) {
    fail(subject, "a set has include and exclude lists");
  }
  const include = (fields.include as unknown[]).map((entry) => termOf(entry, subject));
  if (include.length === 0) fail(subject, "a set includes something");
  return {
    include,
    exclude: (fields.exclude as unknown[]).map((entry) => termOf(entry, subject))
  };
};

const LEVELS = ["low", "medium", "high"] as const;

export const castOf = (value: unknown, subject: string): Cast => {
  const fields = fieldsOf(value, subject);
  only(fields, ["label", "strength", "speed"], subject);
  const level = (candidate: unknown, field: string): Cast["strength"] => {
    if (!(LEVELS as readonly unknown[]).includes(candidate)) {
      fail(subject, `${field} is low, medium or high`);
    }
    return candidate as Cast["strength"];
  };
  const label = textOf(fields.label, subject, "cast label", 80);
  return {
    label,
    strength: level(fields.strength, "strength"),
    speed: level(fields.speed, "speed")
  };
};

const SECTIONS: readonly PersonaSectionName[] = [
  "focus",
  "background",
  "approach",
  "outputPreferences",
  "verification"
];

export const sectionOf = (
  value: unknown,
  subject: string
): { readonly name: PersonaSectionName; readonly text: string } => {
  const fields = fieldsOf(value, subject);
  only(fields, ["name", "text"], subject);
  if (!(SECTIONS as readonly unknown[]).includes(fields.name)) {
    fail(subject, `a section is one of ${SECTIONS.join(", ")}`);
  }
  if (typeof fields.text !== "string") fail(subject, "section text is text");
  const text = (fields.text as string).trim();
  if (text.length > 20_000) fail(subject, "section text is at most 20,000 characters");
  return { name: fields.name as PersonaSectionName, text };
};

export const emptyDefinition = (): PersonaDefinition => ({
  focus: "",
  background: "",
  approach: "",
  outputPreferences: "",
  verification: ""
});

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const triggerOf = (value: unknown, subject: string): AutomationTrigger => {
  const fields = fieldsOf(value, subject);
  if (!isTriggerKind(fields.kind)) fail(subject, "trigger.kind is manual, schedule, resource-edited or resource-created");
  if (fields.kind === "manual") {
    only(fields, ["kind"], subject);
    return { kind: "manual" };
  }
  if (fields.kind === "schedule") {
    if (typeof fields.at !== "string" || !TIME.test(fields.at)) fail(subject, "at is HH:MM");
    if (!isRepeat(fields.repeats)) return fail(subject, "repeats is daily, weekdays or weekly");
    const at = fields.at as string;
    const repeats = fields.repeats as ScheduleRepeat;
    const timezone = textOf(fields.timezone, subject, "timezone", 80);
    const weekday = fields.weekday;
    if (repeats === "weekly") {
      only(fields, ["kind", "at", "repeats", "weekday", "timezone"], subject);
      if (!isWeekday(weekday)) return fail(subject, "a weekly schedule names its weekday");
      return { kind: "schedule", at, repeats: "weekly", weekday: weekday as Weekday, timezone };
    }
    only(fields, ["kind", "at", "repeats", "timezone"], subject);
    return { kind: "schedule", at, repeats, timezone };
  }
  if (fields.kind === "resource-edited") {
    only(fields, ["kind", "kinds", "ref"], subject);
    const kinds = kindsOf(fields.kinds, subject);
    return has(fields, "ref")
      ? { kind: "resource-edited", kinds, ref: resourceRefOf(fields.ref, subject) }
      : { kind: "resource-edited", kinds };
  }
  only(fields, ["kind", "kinds"], subject);
  return { kind: "resource-created", kinds: kindsOf(fields.kinds, subject) };
};

export const entryIdOf = (value: unknown, subject: string, field = "entry id"): string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    fail(subject, `${field} is a short identifier`);
  }
  return value as string;
};

export const planOf = (value: unknown, subject: string): readonly PlanStep[] => {
  if (!Array.isArray(value)) fail(subject, "plan is a list");
  const plan = (value as unknown[]).map((entry): PlanStep => {
    const fields = fieldsOf(entry, subject);
    only(fields, ["id", "title", "state", "note"], subject);
    if (fields.state !== "pending" && fields.state !== "active" && fields.state !== "done") {
      fail(subject, "a step is pending, active or done");
    }
    const note = has(fields, "note") ? optionalTextOf(fields.note, subject, "a step note", 2000) : undefined;
    return {
      id: entryIdOf(fields.id, subject),
      title: textOf(fields.title, subject, "a step title", 200),
      state: fields.state as PlanStep["state"],
      ...(note === undefined ? {} : { note })
    };
  });
  if (new Set(plan.map((step) => step.id)).size !== plan.length) {
    fail(subject, "plan step ids are unique");
  }
  const rank = (state: PlanStep["state"]): number => state === "done" ? 0 : state === "active" ? 1 : 2;
  if (
    plan.filter((step) => step.state === "active").length > 1 ||
    plan.some((step, index) => index > 0 && rank(step.state) < rank(plan[index - 1].state))
  ) fail(subject, "plan states proceed from done through active to pending");
  return plan;
};

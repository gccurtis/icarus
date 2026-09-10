import type {
  AutomationTrigger,
  AutomationTriggerKind,
  ScheduleRepeat,
  Weekday
} from "$representation/data/types/agents/automation";
import type { TaskOrigin } from "$representation/data/types/agents/agent-task";
import type { ResourceSelectorKind } from "$representation/data/types/core/resource";

export const TRIGGER_KINDS: readonly AutomationTriggerKind[] = [
  "manual",
  "schedule",
  "resource-edited",
  "resource-created"
];

export const TRIGGER_LABEL: Record<AutomationTriggerKind, string> = {
  manual: "Manual",
  schedule: "Scheduled",
  "resource-edited": "On edit",
  "resource-created": "On create"
};

export const ORIGIN_LABEL: Record<AutomationTriggerKind | "person", string> = {
  person: "Once",
  ...TRIGGER_LABEL
};

export const originKindOf = (origin: TaskOrigin): AutomationTriggerKind | "person" =>
  origin.kind === "person" ? "person" : origin.trigger;

export const REPEATS: readonly ScheduleRepeat[] = ["daily", "weekdays", "weekly"];

export const WEEKDAYS: readonly Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

export const isTriggerKind = (value: unknown): value is AutomationTriggerKind =>
  typeof value === "string" && (TRIGGER_KINDS as readonly string[]).includes(value);

export const isRepeat = (value: unknown): value is ScheduleRepeat =>
  typeof value === "string" && (REPEATS as readonly string[]).includes(value);

export const isWeekday = (value: unknown): value is Weekday =>
  typeof value === "string" && (WEEKDAYS as readonly string[]).includes(value);

export const isRecurring = (trigger: AutomationTrigger): boolean => trigger.kind !== "manual";

export const TRIGGER_RESOURCE_KINDS = [
  { id: "document", label: "Documents" },
  { id: "slides", label: "Slide decks" },
  { id: "spreadsheet", label: "Spreadsheets" },
  { id: "research", label: "Research threads" },
  { id: "finding", label: "Findings" },
  { id: "connection", label: "Connections" },
  { id: "externalFile", label: "External files" }
] as const satisfies readonly { id: ResourceSelectorKind; label: string }[];

const KIND_WORD: Record<string, string> = {
  "document": "a document",
  "slides": "a slide deck",
  "spreadsheet": "a spreadsheet",
  "research": "a research thread",
  "finding": "a finding",
  "connection": "a connection",
  "externalFile": "an external file"
};

const KIND_PLURAL: Record<string, string> = {
  "document": "documents",
  "slides": "slide decks",
  "spreadsheet": "spreadsheets",
  "research": "research threads",
  "finding": "findings",
  "connection": "connections",
  "externalFile": "external files"
};

const kindsPhrase = (kinds: readonly ResourceSelectorKind[]): string => {
  const words = kinds.map((kind) => KIND_WORD[kind] ?? kind);
  if (words.length === 0) return "any resource";
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
};

const pluralPhrase = (kinds: readonly ResourceSelectorKind[]): string => {
  const words = kinds.map((kind) => KIND_PLURAL[kind] ?? kind);
  if (words.length === 0) return "resources";
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
};

const city = (timezone: string): string =>
  timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;

const repeatWords = (trigger: Extract<AutomationTrigger, { kind: "schedule" }>): string =>
  trigger.repeats === "daily"
    ? "every day"
    : trigger.repeats === "weekdays"
      ? "on weekdays"
      : `every ${trigger.weekday}`;

export const triggerClause = (trigger: AutomationTrigger, refName?: string): string => {
  if (trigger.kind === "manual") return "someone presses Run";
  if (trigger.kind === "schedule") {
    return `the clock reaches ${trigger.at} in ${city(trigger.timezone)}, ${repeatWords(trigger)}`;
  }
  if (trigger.kind === "resource-edited") {
    return trigger.ref === undefined
      ? `${kindsPhrase(trigger.kinds)} is edited`
      : `${refName ?? "one resource"} is edited`;
  }
  return `${kindsPhrase(trigger.kinds)} is created`;
};

export const triggerSummary = (trigger: AutomationTrigger, refName?: string): string => {
  if (trigger.kind === "manual") return "Runs when pressed";
  if (trigger.kind === "schedule") {
    const repeat =
      trigger.repeats === "daily"
        ? "daily"
        : trigger.repeats === "weekdays"
          ? "weekdays"
          : `${trigger.weekday}s`;
    return `${trigger.at} ${repeat}`;
  }
  if (trigger.kind === "resource-edited") {
    return trigger.ref === undefined
      ? `Edits to ${pluralPhrase(trigger.kinds)}`
      : `Edits to ${refName ?? "one resource"}`;
  }
  return `New ${pluralPhrase(trigger.kinds)}`;
};

export const originSummary = (origin: TaskOrigin, automationName?: string): string => {
  if (origin.kind === "person") return "Created and run once";
  const by = automationName ?? "an automation";
  if (origin.trigger === "manual") return `Run by hand from ${by}`;
  if (origin.trigger === "schedule") return `Fired on schedule by ${by}`;
  if (origin.trigger === "resource-edited") return `Fired by an edit, through ${by}`;
  return `Fired by a new resource, through ${by}`;
};

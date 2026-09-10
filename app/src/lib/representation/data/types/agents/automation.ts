import type { ResourceRef, ResourceSelectorKind } from "$representation/data/types/core/resource";

export type AutomationTriggerKind = "manual" | "schedule" | "resource-edited" | "resource-created";

export type ScheduleRepeat = "daily" | "weekdays" | "weekly";

export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

type ScheduledTrigger =
  | {
      kind: "schedule";
      at: string;
      repeats: "daily" | "weekdays";
      weekday?: never;
      timezone: string;
    }
  | {
      kind: "schedule";
      at: string;
      repeats: "weekly";
      weekday: Weekday;
      timezone: string;
    };

export type AutomationTrigger =
  | { kind: "manual" }
  | ScheduledTrigger
  | { kind: "resource-edited"; kinds: ResourceSelectorKind[]; ref?: ResourceRef }
  | { kind: "resource-created"; kinds: ResourceSelectorKind[] };

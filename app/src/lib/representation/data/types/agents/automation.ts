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

export type AutomationTrigger =
  | { kind: "manual" }
  | {
      kind: "schedule";
      at: string;
      repeats: ScheduleRepeat;
      weekday?: Weekday;
      timezone: string;
    }
  | { kind: "resource-edited"; kinds: ResourceSelectorKind[]; ref?: ResourceRef }
  | { kind: "resource-created"; kinds: ResourceSelectorKind[] };

export { createActivityCapability } from "./application/activityService.js";
export type {
  ActivityCapability,
  ActivityClock,
  ActivityDependencies,
  ActivityOptions,
  ActivityPresenceRuntime
} from "./application/activityService.js";
export * from "./domain/model.js";
export * from "./domain/errors.js";
export { digestActivityTransaction } from "./domain/canonical.js";
export type { ActivityStore } from "./ports/activityStore.js";
export { SQLiteActivityStore } from "./persistence/sqliteActivityStore.js";

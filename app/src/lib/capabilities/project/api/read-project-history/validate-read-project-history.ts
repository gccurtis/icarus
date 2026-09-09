import type { ReadProjectHistoryInput } from "$capabilities/project/types/project";

export const validateReadProjectHistory = (input: unknown): ReadProjectHistoryInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("project/read-project-history: an object is required");
  }
  const asked = input as Record<string, unknown>;
  if (!Object.keys(asked).every((key) => ["search", "since", "before", "limit"].includes(key))) {
    throw new Error("project/read-project-history: only search, since, before, and limit are accepted");
  }
  if (typeof asked.search !== "string" || asked.search.length > 160) {
    throw new Error("project/read-project-history: search is at most 160 characters");
  }
  const time = (value: unknown): value is number | null =>
    value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
  if (!time(asked.since) || !time(asked.before)) {
    throw new Error("project/read-project-history: time bounds are finite timestamps or null");
  }
  if (!Number.isInteger(asked.limit) || (asked.limit as number) < 1 || (asked.limit as number) > 100) {
    throw new Error("project/read-project-history: limit is an integer from 1 to 100");
  }
  return {
    search: asked.search.trim(),
    since: asked.since,
    before: asked.before,
    limit: asked.limit as number
  };
};

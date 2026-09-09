import type { ReadAgentsLibraryResult, TaskItem } from "$capabilities/agents/index.remote";
import type { AgentTaskState } from "$representation/data/types/agents/agent-task";
import type { AutomationTriggerKind } from "$representation/data/types/agents/automation";
import { ORIGIN_LABEL, originKindOf } from "$representation/data/behavior/agents/triggers";

import { elapsed, relativeTime } from "$app-views/categories/agents/procedures/time";

export type OriginKind = AutomationTriggerKind | "person";

export type TaskRow = TaskItem & {
  readonly typeLabel: string;
  readonly originKind: OriginKind;
  readonly started: string;
  readonly took: string;
};

export const STATES: readonly AgentTaskState[] = ["running", "review", "finished"];

export const STATE_LABEL: Record<AgentTaskState, string> = {
  running: "Running",
  review: "Pending review",
  finished: "Finished"
};

export const STATE_TONE: Record<AgentTaskState, "attention" | "intelligence" | "success"> = {
  running: "attention",
  review: "intelligence",
  finished: "success"
};

export const typeLabelOf = (task: TaskItem): string => ORIGIN_LABEL[originKindOf(task.origin)];

export const taskRowOf = (task: TaskItem, now: number): TaskRow => ({
  ...task,
  typeLabel: typeLabelOf(task),
  originKind: originKindOf(task.origin),
  started: relativeTime(task.startedAt, now),
  took: elapsed(task.startedAt, task.finishedAt ?? now)
});

export const taskRowsIn = (
  answer: ReadAgentsLibraryResult | undefined,
  now: number
): readonly TaskRow[] => answer?.tasks.map((task) => taskRowOf(task, now)) ?? [];

export const pendingReviewIn = (rows: readonly TaskRow[]): readonly TaskRow[] =>
  rows
    .filter((row) => row.state === "review")
    .toSorted((left, right) => (right.finishedAt ?? 0) - (left.finishedAt ?? 0));

export const runningIn = (rows: readonly TaskRow[]): readonly TaskRow[] =>
  rows.filter((row) => row.state === "running");

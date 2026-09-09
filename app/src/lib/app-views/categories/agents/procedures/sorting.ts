import { TRIGGER_KINDS } from "$representation/data/behavior/agents/triggers";
import type { AgentTaskState } from "$representation/data/types/agents/agent-task";

import type { OriginKind, TaskRow } from "$app-views/categories/agents/procedures/tasks";

export type SortKey = "started" | "title" | "type" | "state";

/** What a task can have been started by, as the type filter offers them. */
export const ORIGIN_KINDS: readonly OriginKind[] = ["person", ...TRIGGER_KINDS];

export type RowFilter = {
  readonly persona: string;
  readonly query: string;
  readonly kind: OriginKind | "any";
  readonly state: AgentTaskState | "any";
};

export const SORTS: readonly { value: SortKey; label: string }[] = [
  { value: "started", label: "Started" },
  { value: "title", label: "Task" },
  { value: "type", label: "Type" },
  { value: "state", label: "State" }
];

export const DIRECTION: Record<SortKey, { asc: string; desc: string }> = {
  started: { asc: "Newest first", desc: "Oldest first" },
  title: { asc: "A to Z", desc: "Z to A" },
  type: { asc: "A to Z", desc: "Z to A" },
  state: { asc: "Needs you first", desc: "Settled first" }
};

const STATE_ORDER: Record<AgentTaskState, number> = { review: 0, running: 1, finished: 2 };

export const compareRows =
  (sort: SortKey) =>
  (a: TaskRow, b: TaskRow): number => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "type") {
      return a.typeLabel.localeCompare(b.typeLabel) || b.startedAt - a.startedAt;
    }
    if (sort === "state") {
      return STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.startedAt - a.startedAt;
    }
    return b.startedAt - a.startedAt;
  };

export const filterRows = (all: readonly TaskRow[], filter: RowFilter): readonly TaskRow[] => {
  const needle = filter.query.trim().toLocaleLowerCase();
  return all
    .filter((row) => filter.persona === "any" || row.personaId === filter.persona)
    .filter((row) => filter.kind === "any" || row.originKind === filter.kind)
    .filter((row) => filter.state === "any" || row.state === filter.state)
    .filter(
      (row) =>
        needle === "" ||
        row.title.toLocaleLowerCase().includes(needle) ||
        row.personaName.toLocaleLowerCase().includes(needle)
    );
};

export const sortRows = (
  all: readonly TaskRow[],
  sort: SortKey,
  direction: "asc" | "desc"
): readonly TaskRow[] => {
  const compare = compareRows(sort);
  return all.toSorted((a, b) => (direction === "asc" ? compare(a, b) : -compare(a, b)));
};

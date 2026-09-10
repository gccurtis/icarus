import type {
  ResearchTurnCompletedFields,
  StoreModel,
  TableRow
} from "$model/server/store/index.server";

import { turnsIn } from "$capabilities/research-chat/api/shared/store";
import type { ThreadItem, TurnItem } from "$capabilities/research-chat/types/research-chat";

/**
 * A turn no process is running is reported as failed, whatever the row says.
 *
 * The row is corrected the next time somebody asks in that chat. Reading is not
 * the place to write, but it is the place to stop showing a spinner forever.
 */
export const turnItem = (
  row: TableRow<"researchTurns">,
  isActive: (turnId: string) => boolean
): TurnItem => {
  const common = {
    id: row._id,
    threadId: row.researchThreadId,
    prompt: row.prompt,
    mode: row.mode.kind,
    scope: row.scope,
    tools: row.tools,
    stopRequested: row.stopRequestedAt !== undefined,
    askedAt: row.askedAt
  };
  if (row.state === "running") {
    return isActive(row._id)
      ? {
          ...common,
          state: "running",
          blocks: [],
          queries: [],
          sources: [],
          findings: []
        }
      : {
          ...common,
          state: "failed",
          error: "The server restarted while this was running, so it never finished.",
          blocks: [],
          queries: [],
          sources: [],
          findings: []
        };
  }
  if (row.state === "failed" || row.state === "cancelled") {
    return {
      ...common,
      state: row.state,
      error: row.error,
      blocks: [],
      queries: [],
      sources: [],
      findings: []
    };
  }
  const completed = row as TableRow<"researchTurns"> & ResearchTurnCompletedFields;
  return {
    ...common,
    state: completed.state,
    blocks: completed.blocks,
    queries: completed.queries,
    sources: completed.sources,
    findings: completed.findings,
    usage: completed.usage,
    model: completed.model,
    answeredAt: completed.answeredAt
  };
};

export const threadItem = (
  store: StoreModel,
  row: TableRow<"researchThreads">,
  personaName?: (id: string) => string | null
): ThreadItem => {
  const turns = turnsIn(store, row.projectId, row._id);
  const last = turns[turns.length - 1];
  return {
    id: row._id,
    title: row.title,
    mode: row.mode.kind,
    personaId: row.personaId ?? null,
    personaName:
      row.personaId === undefined ? null : (personaName?.(row.personaId) ?? null),
    turnCount: turns.length,
    lastLine: last?.prompt ?? null,
    updatedAt: last?.updatedAt ?? row.updatedAt
  };
};

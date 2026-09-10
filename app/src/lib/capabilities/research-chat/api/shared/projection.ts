import type { StoreModel, TableRow } from "$model/server/store/index.server";

import { turnsIn } from "$capabilities/research-chat/api/shared/store";
import type { ThreadItem, TurnItem } from "$capabilities/research-chat/types/research-chat";

/**
 * A turn no process is running is reported as failed, whatever the row says.
 *
 * The row is corrected the next time somebody asks in that chat. Reading is not
 * the place to write, but it is the place to stop showing a spinner forever.
 */
const stateOf = (
  row: TableRow<"researchTurns">,
  isActive: (turnId: string) => boolean
): TurnItem["state"] =>
  (row.state === "running" || row.state === "queued") && !isActive(row._id)
    ? "failed"
    : row.state;

export const turnItem = (
  row: TableRow<"researchTurns">,
  isActive: (turnId: string) => boolean
): TurnItem => ({
  id: row._id,
  threadId: row.researchThreadId,
  prompt: row.prompt,
  mode: row.mode.kind,
  scope: row.scope,
  tools: row.tools,
  state: stateOf(row, isActive),
  blocks: row.blocks,
  queries: row.queries,
  sources: row.sources,
  findings: row.findings,
  ...(row.usage === undefined ? {} : { usage: row.usage }),
  ...(row.model === undefined ? {} : { model: row.model }),
  ...(row.error === undefined
    ? stateOf(row, isActive) === row.state
      ? {}
      : { error: "The server restarted while this was running, so it never finished." }
    : { error: row.error }),
  stopRequested: row.stopRequestedAt !== undefined,
  askedAt: row.askedAt,
  ...(row.answeredAt === undefined ? {} : { answeredAt: row.answeredAt })
});

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

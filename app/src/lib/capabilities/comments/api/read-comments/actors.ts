import type { StoreModel } from "$model/server/store/index.server";
import { isStoredActor } from "$representation/data/behavior/core/stored";
import {
  isStoredConnector,
  isStoredProjectAgentTask
} from "$representation/data/behavior/project-resources/stored-actors";
import type { CommentActor } from "$capabilities/comments/types/read-comments";
import { rowsIn } from "$capabilities/comments/api/read-comments/store";

const uniqueClaim = (
  store: StoreModel,
  table: "agentTasks" | "connectors",
  id: string
): unknown => {
  return rowsIn(store, table).find((row) => row._id === id);
};

/** Admit a current actor only when its referenced subject belongs to this project. */
export const projectActor = (
  store: StoreModel,
  projectId: string,
  visibleUserIds: ReadonlySet<string>,
  value: unknown
): CommentActor | undefined => {
  if (!isStoredActor(value)) throw new Error("comment actor is not one exact current actor");
  if (value.kind === "system") return { kind: "system" };
  if (value.kind === "user") {
    return visibleUserIds.has(value.userId)
      ? { kind: "user", userId: value.userId }
      : undefined;
  }
  if (value.kind === "agent") {
    const row = uniqueClaim(store, "agentTasks", value.taskId);
    if (row !== undefined && !isStoredProjectAgentTask(row)) {
      throw new Error("the agentTasks table contains a non-current row");
    }
    return row !== undefined && row.projectId === projectId
      ? { kind: "agent" }
      : undefined;
  }
  const row = uniqueClaim(store, "connectors", value.connectorId);
  if (row !== undefined && !isStoredConnector(row)) {
    throw new Error("the connectors table contains a non-current row");
  }
  return row !== undefined && row.projectId === projectId
    ? { kind: "connector" }
    : undefined;
};

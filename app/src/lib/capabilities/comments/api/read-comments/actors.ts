import type { StoreModel } from "$model/server/store/index.server";
import { isStoredActor, storedFields } from "$representation/data/behavior/core/stored";
import {
  isStoredConnector,
  isStoredProjectAgentTask
} from "$representation/data/behavior/project-resources/stored-actors";
import type { CommentActor } from "$capabilities/comments/types/read-comments";

const uniqueClaim = (
  store: StoreModel,
  table: "agentTasks" | "connectors",
  id: string
): unknown => {
  const found = store.read(table);
  if (found?.kind !== "table" || found.table !== table) return undefined;
  const claimed = found.rows.filter((row) => storedFields(row)?._id === id);
  return claimed.length === 1 ? claimed[0] : undefined;
};

/** Admit a current actor only when its referenced subject belongs to this project. */
export const projectActor = (
  store: StoreModel,
  projectId: string,
  visibleUserIds: ReadonlySet<string>,
  value: unknown
): CommentActor | undefined => {
  if (!isStoredActor(value)) return undefined;
  if (value.kind === "system") return { kind: "system" };
  if (value.kind === "user") {
    return visibleUserIds.has(value.userId)
      ? { kind: "user", userId: value.userId }
      : undefined;
  }
  if (value.kind === "agent") {
    const row = uniqueClaim(store, "agentTasks", value.taskId);
    return row !== undefined && isStoredProjectAgentTask(row) && row.projectId === projectId
      ? { kind: "agent" }
      : undefined;
  }
  const row = uniqueClaim(store, "connectors", value.connectorId);
  return row !== undefined && isStoredConnector(row) && row.projectId === projectId
    ? { kind: "connector" }
    : undefined;
};

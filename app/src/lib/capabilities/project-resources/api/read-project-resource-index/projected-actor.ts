import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableName
} from "$model/server/store/index.server";
import {
  isStoredActor,
  storedFields
} from "$representation/data/behavior/core/stored";
import {
  isStoredMembership,
  isStoredUser
} from "$representation/data/behavior/core/stored-project";
import {
  isStoredConnector,
  isStoredProjectAgentTask
} from "$representation/data/behavior/project-resources/stored-actors";

type StoreReads = Pick<StoreUnitOfWork, "read">;

const rowsIn = (store: StoreReads, table: TableName): readonly Record<string, unknown>[] => {
  return readCurrentRows(store, table).flatMap((value) => {
    const row = storedFields(value);
    return row === undefined ? [] : [row];
  });
};

const uniqueClaim = (
  store: StoreReads,
  table: TableName,
  id: string
): Record<string, unknown> | undefined => {
  const rows = rowsIn(store, table).filter((row) => row._id === id);
  return rows.length === 1 ? rows[0] : undefined;
};

/** A current related label, or null when the exact historical subject is unavailable. */
export const projectedActorName = (
  store: StoreReads,
  projectId: string,
  value: unknown
): string | null => {
  if (!isStoredActor(value)) return null;
  if (value.kind === "system") return "Icarus";
  if (value.kind === "user") {
    const allMemberships = rowsIn(store, "memberships");
    const memberships = allMemberships.filter(
      (row) => row.projectId === projectId && row.userId === value.userId
    );
    const user = uniqueClaim(store, "users", value.userId);
    return memberships.length === 1 &&
      allMemberships.filter((row) => row._id === memberships[0]._id).length === 1 &&
      isStoredMembership(memberships[0]) &&
      user !== undefined &&
      isStoredUser(user)
      ? user.displayName
      : null;
  }
  if (value.kind === "connector") {
    const connector = uniqueClaim(store, "connectors", value.connectorId);
    return connector !== undefined &&
      isStoredConnector(connector) &&
      connector.projectId === projectId
      ? connector.name
      : null;
  }
  const task = uniqueClaim(store, "agentTasks", value.taskId);
  return task !== undefined &&
    isStoredProjectAgentTask(task) &&
    task.projectId === projectId
    ? task.title
    : null;
};

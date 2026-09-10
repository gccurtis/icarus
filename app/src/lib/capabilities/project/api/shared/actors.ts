import { isStoredActor } from "$representation/data/behavior/core/stored";
import {
  isStoredMembership,
  isStoredUser
} from "$representation/data/behavior/core/stored-project";
import {
  isStoredConnector,
  isStoredProjectAgentTask
} from "$representation/data/behavior/project-resources/stored-actors";
import type { Scope } from "$runtime/server/scope.server";

import { recordOf, recordsIn, type StoreReads } from "$capabilities/project/api/shared/store";
import type { ProjectPanelActor } from "$capabilities/project/types/project";

const uniqueClaim = (
  store: StoreReads,
  table: Parameters<typeof recordsIn>[1],
  id: string
): Record<string, unknown> | undefined => {
  const claimed = recordsIn(store, table).filter((row) => row._id === id);
  return claimed.length === 1 ? claimed[0] : undefined;
};

const visibleUser = (
  store: StoreReads,
  scope: Scope,
  userId: string
): ProjectPanelActor | null => {
  const allMemberships = recordsIn(store, "memberships");
  const memberships = allMemberships.filter(
    (row) => row.projectId === scope.projectId && row.userId === userId
  );
  const membership = memberships.length === 1 &&
    allMemberships.filter((row) => row._id === memberships[0]._id).length === 1 &&
    isStoredMembership(memberships[0])
    ? memberships[0]
    : undefined;
  const user = uniqueClaim(store, "users", userId);
  if (membership === undefined || user === undefined || !isStoredUser(user)) return null;
  return { kind: "person", id: userId, label: user.displayName };
};

/** Resolve an exact, currently inspectable actor; historical references remain null. */
export const projectActor = (
  store: StoreReads,
  scope: Scope,
  value: unknown
): ProjectPanelActor | null => {
  if (!isStoredActor(value)) return null;
  if (value.kind === "system") return { kind: "system", label: "Icarus" };
  if (value.kind === "user") return visibleUser(store, scope, value.userId);
  if (value.kind === "connector") {
    const row = uniqueClaim(store, "connectors", value.connectorId);
    return row !== undefined && isStoredConnector(row) && row.projectId === scope.projectId
      ? { kind: "connector", id: value.connectorId, label: row.name }
      : null;
  }
  const row = uniqueClaim(store, "agentTasks", value.taskId);
  return row !== undefined && isStoredProjectAgentTask(row) && row.projectId === scope.projectId
    ? { kind: "agent", id: value.taskId, label: row.title }
    : null;
};

/** Broad claimant detection used only to ensure malformed user-owned rows cannot disappear. */
export const claimsProjectUserActor = (value: unknown, userId: string): boolean => {
  const actor = recordOf(value);
  return actor?.kind === "user" && actor.userId === userId;
};

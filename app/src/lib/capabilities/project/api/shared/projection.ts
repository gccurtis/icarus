import type { Scope } from "$runtime/server/scope.server";

import {
  boundedText,
  finiteTime,
  recordOf,
  recordsIn,
  type StoreReads
} from "$capabilities/project/api/shared/store";
import type {
  ProjectActivityEntry,
  ProjectActivityTarget,
  ProjectPanelActor
} from "$capabilities/project/types/project";

const idOf = (value: unknown): string | undefined => boundedText(value, 500);

const targetOf = (value: unknown): ProjectActivityTarget | undefined => {
  const target = recordOf(value);
  const kind = boundedText(target?.kind, 80);
  const id = idOf(target?.id);
  const label = boundedText(target?.label);
  return kind === undefined || id === undefined || label === undefined
    ? undefined
    : { kind, id, label };
};

const userActor = (
  store: StoreReads,
  scope: Scope,
  userId: string
): ProjectPanelActor => {
  const visible = recordsIn(store, "memberships").some(
    (row) => row.projectId === scope.projectId && row.userId === userId
  );
  if (!visible) return { kind: "person", label: "Someone" };

  const user = recordsIn(store, "users").find((row) => row._id === userId);
  const label = boundedText(user?.displayName, 160) ?? "Someone";
  return { kind: "person", id: userId, label };
};

/** Resolve only the actor fields safe and useful to a project panel. */
export const actorOf = (
  store: StoreReads,
  scope: Scope,
  value: unknown
): ProjectPanelActor | null => {
  const actor = recordOf(value);
  if (actor?.kind === "system") return { kind: "system", label: "Icarus" };

  if (actor?.kind === "user") {
    const userId = idOf(actor.userId);
    return userId === undefined ? null : userActor(store, scope, userId);
  }

  if (actor?.kind === "connector") {
    const connectorId = idOf(actor.connectorId);
    if (connectorId === undefined) return null;
    const connector = recordsIn(store, "connectors").find(
      (row) => row._id === connectorId && row.projectId === scope.projectId
    );
    const label = boundedText(connector?.name, 160);
    return label === undefined
      ? { kind: "connector", label: "A connector" }
      : { kind: "connector", id: connectorId, label };
  }

  if (actor?.kind === "agent") {
    const taskId = idOf(actor.taskId);
    if (taskId === undefined) return null;
    const task = recordsIn(store, "agentTasks").find(
      (row) => row._id === taskId && row.projectId === scope.projectId
    );
    const title = boundedText(task?.title, 160);
    return title === undefined
      ? { kind: "agent", label: "An agent" }
      : { kind: "agent", id: taskId, label: title };
  }

  return null;
};

export const isUserActor = (value: unknown, userId: string): boolean => {
  const actor = recordOf(value);
  return actor?.kind === "user" && actor.userId === userId;
};

/** Turn one stored activity row into the immutable, bounded panel record. */
export const activityOf = (
  store: StoreReads,
  scope: Scope,
  value: unknown
): ProjectActivityEntry | undefined => {
  const row = recordOf(value);
  if (row?.projectId !== scope.projectId) return undefined;

  const id = idOf(row._id);
  const at = finiteTime(row._creationTime);
  const verb = boundedText(row.verb, 240);
  const target = targetOf(row.target);
  if (id === undefined || at === undefined || verb === undefined || target === undefined) {
    return undefined;
  }

  const actor = actorOf(store, scope, row.actor);
  const actorLabel = boundedText(row.actorLabel, 160) ?? actor?.label ?? "Someone";
  const context = targetOf(row.context);
  const detail = boundedText(row.detail, 20_000);

  return {
    id,
    at,
    actorLabel,
    actor,
    verb,
    target,
    ...(context === undefined ? {} : { context }),
    ...(detail === undefined ? {} : { detail })
  };
};

export const activityIn = (
  store: StoreReads,
  scope: Scope
): readonly ProjectActivityEntry[] =>
  recordsIn(store, "activity")
    .flatMap((row) => {
      const event = activityOf(store, scope, row);
      return event === undefined ? [] : [event];
    })
    .sort((left, right) => right.at - left.at);

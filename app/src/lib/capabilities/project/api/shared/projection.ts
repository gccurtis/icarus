import type { Scope } from "$runtime/server/scope.server";

import { activityPresentation } from "$capabilities/activity";
import { isStoredActivity } from "$representation/data/behavior/collaboration/stored-activity";
import { isStoredActor } from "$representation/data/behavior/core/stored";

import { projectActor } from "$capabilities/project/api/shared/actors";
import {
  boundedText,
  exact,
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
  if (target === undefined || !exact(target, ["kind", "id", "label"])) return undefined;
  const kind = boundedText(target?.kind, 80);
  const id = idOf(target?.id);
  const label = boundedText(target?.label);
  return kind === undefined || id === undefined || label === undefined
    ? undefined
    : { kind, id, label };
};

/** Resolve only the actor fields safe and useful to a project panel. */
export const actorOf = (
  store: StoreReads,
  scope: Scope,
  value: unknown
): ProjectPanelActor | null => projectActor(store, scope, value);

/** Turn one stored activity row into the immutable, bounded panel record. */
export const activityOf = (
  store: StoreReads,
  scope: Scope,
  value: unknown
): ProjectActivityEntry | undefined => {
  const row = recordOf(value);
  if (
    row === undefined ||
    !exact(
      row,
      ["_id", "_creationTime", "projectId", "actor", "actorLabel", "event"]
    ) ||
    row.projectId !== scope.projectId ||
    !isStoredActivity(row)
  ) return undefined;

  const presentation = activityPresentation(row.event);
  const id = idOf(row._id);
  const at = finiteTime(row._creationTime);
  const actorLabel = boundedText(row.actorLabel, 240);
  const what = boundedText(presentation.what, 240);
  const action = boundedText(presentation.action, 240);
  const target = targetOf(presentation.target);
  const actor = actorOf(store, scope, row.actor);
  const context = presentation.context === undefined ? undefined : targetOf(presentation.context);
  const detail = presentation.detail === undefined
    ? undefined
    : boundedText(presentation.detail, 20_000);
  if (
    id === undefined ||
    at === undefined ||
    actorLabel === undefined ||
    what === undefined ||
    action === undefined ||
    target === undefined ||
    (presentation.context !== undefined && context === undefined) ||
    (presentation.detail !== undefined && detail === undefined)
  ) {
    return undefined;
  }

  return {
    id,
    at,
    actorLabel,
    actor,
    type: presentation.type,
    what,
    action,
    target,
    ...(context === undefined ? {} : { context }),
    ...(detail === undefined ? {} : { detail })
  };
};

export const activityIn = (
  store: StoreReads,
  scope: Scope
): readonly ProjectActivityEntry[] => {
  const rows = recordsIn(store, "activity");
  const idCounts = new Map<unknown, number>();
  for (const row of rows) idCounts.set(row._id, (idCounts.get(row._id) ?? 0) + 1);
  return rows
    .flatMap((row) => {
      const event = activityOf(store, scope, row);
      return event === undefined || idCounts.get(row._id) !== 1 ? [] : [event];
    })
    .sort((left, right) => right.at - left.at);
};

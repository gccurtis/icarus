import { exact, identifier, recordOf, text } from "$representation/data/behavior/content/admission-values";
import { isStoredActor, isStoredRowId, isStoredTime } from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";

const activityTarget = (value: unknown): boolean => {
  const held = recordOf(value);
  return held !== undefined && exact(held, ["kind", "id", "label"]) &&
    identifier(held.kind) && identifier(held.id) && text(held.label);
};

export const isStoredAgentActivity = (value: unknown): value is TableRow<"activity"> => {
  const row = recordOf(value);
  if (row === undefined || !exact(
    row,
    ["_id", "_creationTime", "projectId", "actor", "actorLabel", "verb", "target"],
    ["context", "detail"]
  )) return false;
  return isStoredRowId(row._id, "activity") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredActor(row.actor) &&
    text(row.actorLabel) && text(row.verb) && activityTarget(row.target) &&
    (row.context === undefined || activityTarget(row.context)) &&
    (row.detail === undefined || text(row.detail));
};

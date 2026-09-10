import {
  hasExactFields,
  isStoredJson,
  isStoredNatural,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isStoredWorkspaceOp } from "$representation/data/behavior/workspace/stored-rows";
import type { WorkspaceChangeSetInput } from "$capabilities/workspace/types/submit-workspace-changes";

const refuse = (what: string): never => {
  throw new Error(`workspace/submit-workspace-changes: ${what}`);
};

export const validateSubmitWorkspaceChanges = (input: unknown): WorkspaceChangeSetInput => {
  if (!isStoredJson(input)) return refuse("an input is exact plain JSON data");
  const envelope = storedFields(input);
  if (envelope === undefined) return refuse("an input is exactly one changeSet");
  if (!hasExactFields(envelope, ["changeSet"])) return refuse("an input is exactly one changeSet");
  const changeSet = storedFields(envelope.changeSet);
  if (changeSet === undefined) return refuse("a changeSet has exactly baseRevision and ops");
  if (!hasExactFields(changeSet, ["baseRevision", "ops"])) {
    return refuse("a changeSet has exactly baseRevision and ops");
  }
  const baseRevision = changeSet.baseRevision;
  const ops = changeSet.ops;
  if (!isStoredNatural(baseRevision)) return refuse("baseRevision is a revision number");
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 10_000) {
    return refuse("a change set carries at least one op");
  }
  if (!ops.every(isStoredWorkspaceOp)) {
    return refuse("every op is exactly one current workspace operation");
  }

  return { baseRevision, ops: [...ops] };
};

import { command, query } from "$app/server";

import { readWorkspaceState as readWorkspaceStateProcedure } from "$capabilities/workspace/api/read-workspace-state/read-workspace-state";
import { submitWorkspaceChanges as submitWorkspaceChangesProcedure } from "$capabilities/workspace/api/submit-workspace-changes/submit-workspace-changes";

export const readWorkspaceState = query(readWorkspaceStateProcedure);
export const submitWorkspaceChanges = command("unchecked", submitWorkspaceChangesProcedure);

export type { ReadWorkspaceStateResult } from "$capabilities/workspace/types/read-workspace-state";
export type {
  SubmitWorkspaceChangesInput,
  SubmitWorkspaceChangesResult
} from "$capabilities/workspace/types/submit-workspace-changes";

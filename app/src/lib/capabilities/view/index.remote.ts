import { command, query } from "$app/server";

import { readViewState as readViewStateProcedure } from "$capabilities/view/api/read-view-state/read-view-state";
import { submitViewChanges as submitViewChangesProcedure } from "$capabilities/view/api/submit-view-changes/submit-view-changes";

export const readViewState = query(readViewStateProcedure);
export const submitViewChanges = command("unchecked", submitViewChangesProcedure);

export type { ReadViewStateResult } from "$capabilities/view/types/read-view-state";
export type {
  SubmitViewChangesInput,
  SubmitViewChangesResult
} from "$capabilities/view/types/submit-view-changes";

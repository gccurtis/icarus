import { command, query } from "$app/server";

import { readPresentationBody as readPresentationBodyProcedure } from "$capabilities/presentation/api/read-presentation-body/read-presentation-body";
import { submitPresentationChanges as submitPresentationChangesProcedure } from "$capabilities/presentation/api/submit-presentation-changes/submit-presentation-changes";

export const readPresentationBody = query("unchecked", readPresentationBodyProcedure);
export const submitPresentationChanges = command("unchecked", submitPresentationChangesProcedure);

export type {
  ReadPresentationBodyInput,
  ReadPresentationBodyResult
} from "$capabilities/presentation/types/read-presentation-body";
export type {
  PresentationChangeSetInput,
  SubmitPresentationChangesInput,
  SubmitPresentationChangesResult
} from "$capabilities/presentation/types/submit-presentation-changes";

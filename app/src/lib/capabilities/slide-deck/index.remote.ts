import { command, query } from "$app/server";

import { readSlideDeckBody as readSlideDeckBodyProcedure } from "$capabilities/slide-deck/api/read-slide-deck-body/read-slide-deck-body";
import { submitSlideDeckChanges as submitSlideDeckChangesProcedure } from "$capabilities/slide-deck/api/submit-slide-deck-changes/submit-slide-deck-changes";

export const readSlideDeckBody = query("unchecked", readSlideDeckBodyProcedure);
export const submitSlideDeckChanges = command("unchecked", submitSlideDeckChangesProcedure);

export type {
  ReadSlideDeckBodyInput,
  ReadSlideDeckBodyResult
} from "$capabilities/slide-deck/types/read-slide-deck-body";
export type {
  SlideDeckChangeSetInput,
  SubmitSlideDeckChangesInput,
  SubmitSlideDeckChangesResult
} from "$capabilities/slide-deck/types/submit-slide-deck-changes";

import { query } from "$app/server";

import { readSlideDeckBody as readSlideDeckBodyProcedure } from "$capabilities/slide-deck/api/read-slide-deck-body/read-slide-deck-body";

export const readSlideDeckBody = query("unchecked", readSlideDeckBodyProcedure);

export type {
  ReadSlideDeckBodyInput,
  ReadSlideDeckBodyResult
} from "$capabilities/slide-deck/types/read-slide-deck-body";

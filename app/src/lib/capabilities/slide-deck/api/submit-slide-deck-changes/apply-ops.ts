import { applyOps as applyDeckOps } from "$representation/data/behavior/slide-decks/apply-ops";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";

/**
 * The same applier the editor runs against its working body, so an op that was
 * applied optimistically and one the store accepts cannot disagree.
 */
export const applyOps = (body: SlideDeckBody, ops: readonly SlideDeckOp[]): SlideDeckBody => {
  try {
    return applyDeckOps(body, ops);
  } catch (error) {
    throw new Error(
      `slide-deck/submit-slide-deck-changes ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

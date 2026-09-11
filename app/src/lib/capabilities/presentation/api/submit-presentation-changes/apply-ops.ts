import { applyOps as applyPresentationOps } from "$representation/data/behavior/presentations/apply-ops";
import type { PresentationBody } from "$representation/data/types/presentations/body";
import type { PresentationOp } from "$representation/data/types/presentations/op";

/**
 * The same applier the editor runs against its working body, so an op that was
 * applied optimistically and one the store accepts cannot disagree.
 */
export const applyOps = (body: PresentationBody, ops: readonly PresentationOp[]): PresentationBody => {
  try {
    return applyPresentationOps(body, ops);
  } catch (error) {
    throw new Error(
      `presentation/submit-presentation-changes ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

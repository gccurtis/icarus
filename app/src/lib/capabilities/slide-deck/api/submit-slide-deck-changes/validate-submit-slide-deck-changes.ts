import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type {
  SlideDeckChangeSetInput,
  SubmitSlideDeckChangesInput
} from "$capabilities/slide-deck/types/submit-slide-deck-changes";

const OPS: readonly string[] = ["set", "insert", "remove", "move", "text"];

const asOps = (value: unknown): readonly SlideDeckOp[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("slide-deck/submit-slide-deck-changes: at least one op is required");
  }

  for (const op of value) {
    if (typeof op !== "object" || op === null) {
      throw new Error("slide-deck/submit-slide-deck-changes: an op is an object");
    }

    const { op: kind, path } = op as { op?: unknown; path?: unknown };
    if (typeof kind !== "string" || !OPS.includes(kind)) {
      throw new Error(`slide-deck/submit-slide-deck-changes: '${String(kind)}' is not an op`);
    }
    if (typeof path !== "string" || path.length === 0) {
      throw new Error("slide-deck/submit-slide-deck-changes: an op names a path");
    }
  }

  return value as readonly SlideDeckOp[];
};

/** Refuses anything the procedure could not act on. Throws; it never returns a partial. */
export const validateSubmitSlideDeckChanges = (input: unknown): SubmitSlideDeckChangesInput => {
  if (typeof input !== "object" || input === null) {
    throw new Error("slide-deck/submit-slide-deck-changes: an object is required");
  }

  const { changeSet } = input as { changeSet?: unknown };
  if (typeof changeSet !== "object" || changeSet === null) {
    throw new Error("slide-deck/submit-slide-deck-changes: a changeSet is required");
  }

  const { resourceId, baseRevision, ops, touched } = changeSet as Record<string, unknown>;

  if (typeof resourceId !== "string" || resourceId.length === 0) {
    throw new Error("slide-deck/submit-slide-deck-changes: resourceId is required");
  }
  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) {
    throw new Error("slide-deck/submit-slide-deck-changes: baseRevision is a revision number");
  }
  if (!Array.isArray(touched) || touched.some((path) => typeof path !== "string")) {
    throw new Error("slide-deck/submit-slide-deck-changes: touched is the paths the ops reached");
  }

  const held: SlideDeckChangeSetInput = {
    resourceId,
    baseRevision,
    ops: asOps(ops),
    touched: touched as readonly string[]
  };

  return { changeSet: held };
};

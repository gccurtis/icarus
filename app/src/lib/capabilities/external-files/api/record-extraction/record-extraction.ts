import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireFile } from "$external-files/api/shared/require-file";
import type { ExtractionOutcome } from "$external-files/types/external-file";

/**
 * Keeps what an extractor read out of a file.
 *
 * Stored on the file rather than re-parsed on demand, so the parse happens once
 * and the knowledge lattice depends on a stored field rather than on a parser
 * still being available.
 *
 * **`unsupported` and `error` are recorded, not refused.** They are what the
 * file turned out to be, and a caller asking again gets that answer instead of
 * waiting on a state nothing will ever complete.
 *
 * The entry is the system's: extraction is machine work, and who happened to ask
 * for it is not a fact about the file.
 */
export const recordExtraction = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"externalFiles">,
  outcome: ExtractionOutcome
): Promise<void> => {
  const { name } = await requireFile(ctx, scope, id);
  const now = Date.now();

  await ctx.db.patch(id, {
    extraction: { ...outcome, extractedAt: now },
    updatedAt: now
  });

  await record(ctx, scope, {
    actor: { kind: "system" },
    verb: "extracted",
    target: { type: "externalFile", id, label: name },
    detail: outcome.state
  });
};

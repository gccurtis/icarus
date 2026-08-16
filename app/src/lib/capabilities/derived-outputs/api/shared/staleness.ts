import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import type {
  DerivedInput,
  DerivedState,
  InputRevision
} from "$derived-outputs/types/derived-output";
import { bearers } from "$research-links/api/bearers/bearers";
import { head } from "$revisions/api/shared/head";

/**
 * Where every declared input stands right now.
 *
 * Recorded into `inputsAt` at generation time and taken again to ask whether
 * anything has moved — **one function for both, deliberately**, because two
 * readings of "what revision is this" that could disagree would make staleness a
 * comparison between two different questions.
 *
 * **A row that cannot be read records nothing.** Another project's resource, and
 * one that has been deleted, both drop out — the first because a refusal would
 * confirm that somebody else's material exists, the second because there is no
 * revision to record. A recorded input that later drops out is exactly what
 * `movedSince` reads as movement.
 *
 * A lattice input records nothing because it is a query rather than a set: there
 * is no revision that could be compared, which is what makes a lattice-only
 * output refreshed on request rather than on a change signal.
 */
export const inputRevisions = async (
  ctx: QueryCtx,
  scope: Scope,
  inputs: DerivedInput[]
): Promise<InputRevision[]> => {
  const recorded: InputRevision[] = [];

  for (const input of inputs) {
    if (input.kind === "resource") {
      const revision = await head(ctx, scope, input);
      if (revision !== null) {
        recorded.push({
          kind: "resource",
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          revision
        });
      }
      continue;
    }

    if (input.kind === "finding") {
      const finding = await ctx.db.get(input.findingId);
      if (finding && finding.projectId === scope.projectId) {
        // A finding is durable content whose writeup is revised in place, so it
        // is recorded as the resource it is rather than by identity alone.
        recorded.push({
          kind: "resource",
          resourceType: "finding",
          resourceId: input.findingId,
          revision: finding.revision
        });
      }
      continue;
    }

    if (input.kind === "file") {
      const file = await ctx.db.get(input.fileId);
      // Bytes are immutable and a replacement is a different row, so the id is
      // the revision and there is nothing further to record.
      if (file && file.projectId === scope.projectId) recorded.push(input);
      continue;
    }

    if (input.kind === "question" && input.includeFindings) {
      // What a question contributes is which findings hang off it. That
      // membership is what the generation read, and a finding joining or leaving
      // it is what moves.
      const links = await bearers(
        ctx,
        scope,
        { subjectKind: "question", subjectId: input.questionId },
        "finding"
      );
      for (const link of links) {
        recorded.push({ kind: "finding", findingId: link.bearerId as Id<"findings"> });
      }
    }
  }

  return recorded;
};

/** What an entry is about, so two readings line up by input rather than by position. */
const keyOf = (entry: InputRevision): string =>
  entry.kind === "resource"
    ? `resource:${entry.resourceType}:${entry.resourceId}`
    : entry.kind === "file"
      ? `file:${entry.fileId}`
      : `finding:${entry.findingId}`;

/**
 * Whether anything the content was generated from has moved.
 *
 * **A comparison of revisions, never of times.** An input whose current revision
 * exceeds the recorded one has moved; one touched without producing a revision
 * has not, and a timestamp would call that stale every time somebody opened the
 * document. Membership counts too: an input that has left the set, or joined it
 * since the generation, means the content no longer answers to what is declared.
 */
export const movedSince = (recorded: InputRevision[], current: InputRevision[]): boolean => {
  const before = new Map(recorded.map((entry) => [keyOf(entry), entry]));
  const now = new Map(current.map((entry) => [keyOf(entry), entry]));

  for (const [key, entry] of now) {
    const was = before.get(key);
    if (!was) return true;
    if (entry.kind === "resource" && was.kind === "resource" && entry.revision > was.revision) {
      return true;
    }
  }
  return [...before.keys()].some((key) => !now.has(key));
};

/**
 * The state a reader is shown: the stored lifecycle state, with staleness folded
 * in.
 *
 * **`stale` is computed rather than stored**, because the alternative is every
 * writer of every input knowing which outputs to mark — a fan-out across
 * capabilities, over an index nothing else needs, which is exactly the coupling a
 * declared input set exists to avoid.
 *
 * Only `fresh` folds. An `error` stays an error however far its inputs have
 * moved: what is shown is whatever survived the failed attempt, and calling it
 * stale would claim the last generation succeeded.
 */
export const effectiveState = async (
  ctx: QueryCtx,
  scope: Scope,
  output: { state: DerivedState; inputs: DerivedInput[]; inputsAt: InputRevision[] }
): Promise<DerivedState> => {
  if (output.state !== "fresh") return output.state;
  const current = await inputRevisions(ctx, scope, output.inputs);
  return movedSince(output.inputsAt, current) ? "stale" : "fresh";
};

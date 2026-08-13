/**
 * The revision discipline every method shares: load what exists, refuse to act
 * on a revision the caller did not expect, and commit under a compare-and-swap
 * so only one writer can win a given revision.
 *
 * These procedures are the reason no method directory talks to the store about
 * versions itself. A method that bypassed them could commit a revision that
 * silently overwrote another writer's.
 */
import { RichContentError } from "#rich-content/errors.js";
import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentId } from "#rich-content/types/ids.js";
import type { RawContent } from "#rich-content/types/raw-content.js";
import type { ContentMutationResult } from "#rich-content/types/runtime-results.js";

/** Loads content, or fails with `content-not-found`. */
export const requiredContent = async (
  store: RichContentStore,
  id: RichContentId
): Promise<RawContent> => {
  const content = await store.find(id);
  if (!content) {
    throw new RichContentError("content-not-found", `Rich Content '${id}' was not found`);
  }
  return content;
};

/** Loads content and rejects it unless it sits at the revision the caller expects. */
export const currentContent = async (
  store: RichContentStore,
  id: RichContentId,
  expectedVersion: number
): Promise<RawContent> => {
  const content = await requiredContent(store, id);
  if (content.version !== expectedVersion) {
    throw new RichContentError(
      "stale-version",
      `Expected Rich Content version ${expectedVersion}, received ${content.version}`
    );
  }
  return content;
};

/** Builds the successor revision. The version advances by exactly one. */
export const nextRevision = (
  content: RawContent,
  changes: Partial<Pick<RawContent, "atoms" | "marks">>
): RawContent => ({ ...content, ...changes, version: content.version + 1 });

/** The only shape a mutation reports: identity and committed revision. */
export const resultOf = (content: RawContent): ContentMutationResult => ({
  contentId: content.id,
  version: content.version
});

export const throwCommitConflict = (id: RichContentId): never => {
  throw new RichContentError(
    "stale-version",
    `Rich Content '${id}' changed before the mutation could commit`
  );
};

/** Compare-and-swaps the candidate over `previous`, or fails `stale-version`. */
export const commit = async (
  store: RichContentStore,
  previous: RawContent,
  candidate: RawContent
): Promise<ContentMutationResult> => {
  if (!(await store.compareAndSwap(previous.version, candidate))) {
    throwCommitConflict(candidate.id);
  }
  return resultOf(candidate);
};

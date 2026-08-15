/**
 * The revision discipline every function shares: load what exists, refuse to act
 * on a revision the caller did not expect, and commit under a compare-and-swap
 * so only one writer can win a given revision.
 *
 * **This file is the correctness of the whole capability.** A function that
 * bypassed it could commit a revision that silently overwrote another writer's,
 * and nothing downstream would notice — which is why no function directory talks
 * to the database about versions itself.
 *
 * It also holds what used to be a store class. The four queries live here rather
 * than in `persistence/` because they are one concern — reading a content object
 * at a revision and replacing it only if that revision still holds — and
 * splitting them across a storage layer would put half the invariant in a file
 * that could not state it.
 */
import type { Kysely, Transaction } from "kysely";
import type { Database } from "$model/server/index.server";
import { RichContentError } from "$rich-content/errors";
import {
  currentAtoms,
  storedRawContent,
  type StoredAtom,
  type StoredRawContent
} from "$rich-content/persistence/stored-types";
import type { RichContentId } from "$rich-content/types/ids";
import type { RawContent } from "$rich-content/types/raw-content";
import type { ContentMutationResult } from "$rich-content/types/results";

/**
 * Signals a lost compare-and-swap from inside a transaction.
 *
 * Private, and thrown only to force a rollback: Kysely rolls back when the
 * callback throws, and there is no other way to abandon a transaction partway.
 * It is caught at the boundary of each transaction below and turned back into
 * `false`, so it never escapes this module and no caller has to know it exists.
 */
class CasConflict extends Error {}

const insertValue = (content: RawContent) => ({
  id: content.id,
  revision: content.version,
  raw_content: JSON.stringify(storedRawContent(content))
});

/** Reads one content object, or `undefined`. */
export const loadContent = async (
  database: Kysely<Database>,
  id: RichContentId
): Promise<RawContent | undefined> => {
  const row = await database
    .selectFrom("rich_content")
    .select(["id", "revision", "raw_content"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) return undefined;

  const state = row.raw_content as StoredRawContent;
  return {
    id: row.id,
    version: row.revision,
    // Translated on the way out, so no caller ever sees a `"hard-break"`.
    atoms: currentAtoms(state.atoms as readonly StoredAtom[]),
    marks: state.marks
  };
};

/** Loads content, or fails with `content-not-found`. */
export const requiredContent = async (
  database: Kysely<Database>,
  id: RichContentId
): Promise<RawContent> => {
  const content = await loadContent(database, id);
  if (!content) {
    throw new RichContentError("content-not-found", `Rich Content '${id}' was not found`);
  }
  return content;
};

/** Loads content and rejects it unless it sits at the revision the caller expects. */
export const currentContent = async (
  database: Kysely<Database>,
  id: RichContentId,
  expectedVersion: number
): Promise<RawContent> => {
  const content = await requiredContent(database, id);
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

/** Inserts a new content object. */
export const insertContent = async (
  database: Kysely<Database>,
  content: RawContent
): Promise<void> => {
  await database.insertInto("rich_content").values(insertValue(content)).executeTakeFirstOrThrow();
};

/**
 * Compare-and-swaps the candidate over `previous`, or fails `stale-version`.
 *
 * The assertion is not defensive noise: a candidate whose version did not
 * advance by exactly one would write a revision that a concurrent reader could
 * already be holding, and the `where revision = expected` predicate would still
 * match. It is a bug in the caller, not a condition to report, so it throws a
 * plain `Error` rather than a stated code.
 */
export const compareAndSwap = async (
  database: Kysely<Database>,
  expectedVersion: number,
  content: RawContent
): Promise<boolean> => {
  if (content.version !== expectedVersion + 1) {
    throw new Error("Rich Content CAS must advance the revision by exactly one");
  }
  const result = await database
    .updateTable("rich_content")
    .set({
      revision: content.version,
      raw_content: JSON.stringify(storedRawContent(content)),
      updated_at: new Date()
    })
    .where("id", "=", content.id)
    .where("revision", "=", expectedVersion)
    .executeTakeFirst();
  return result.numUpdatedRows === 1n;
};

/** Compare-and-swaps, or reports the conflict as `stale-version`. */
export const commit = async (
  database: Kysely<Database>,
  previous: RawContent,
  candidate: RawContent
): Promise<ContentMutationResult> => {
  if (!(await compareAndSwap(database, previous.version, candidate))) {
    throwCommitConflict(candidate.id);
  }
  return resultOf(candidate);
};

const deleteAt = async (
  transaction: Transaction<Database>,
  original: { id: RichContentId; expectedVersion: number }
): Promise<void> => {
  const deleted = await transaction
    .deleteFrom("rich_content")
    .where("id", "=", original.id)
    .where("revision", "=", original.expectedVersion)
    .executeTakeFirst();
  // Zero rows means someone else moved it since the caller read it. The
  // predicate is the check; there is no separate read to race against.
  if (deleted.numDeletedRows !== 1n) throw new CasConflict();
};

const rolledBack = async (run: () => Promise<boolean>): Promise<boolean> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof CasConflict) return false;
    throw error;
  }
};

/**
 * `split`'s commit: one object becomes two, atomically.
 *
 * The whole thing is one transaction because the intermediate states are both
 * wrong — the original deleted with no replacements, or two replacements
 * alongside an original that still exists. A reader must see one or the other,
 * never a moment in between.
 */
export const replaceOneWithTwo = async (
  database: Kysely<Database>,
  original: { id: RichContentId; expectedVersion: number },
  left: RawContent,
  right: RawContent
): Promise<boolean> =>
  rolledBack(() =>
    database.transaction().execute(async (transaction) => {
      await deleteAt(transaction, original);
      await transaction
        .insertInto("rich_content")
        .values([insertValue(left), insertValue(right)])
        .execute();
      return true;
    })
  );

/**
 * `combineAsList`'s commit: many objects become one, atomically.
 *
 * Every original is deleted at the revision the caller expected, so if any one
 * of them moved the whole combine is abandoned. Combining a stale subset would
 * silently drop whatever the other writer had added.
 */
export const replaceManyWithOne = async (
  database: Kysely<Database>,
  originals: readonly { id: RichContentId; expectedVersion: number }[],
  replacement: RawContent
): Promise<boolean> =>
  rolledBack(() =>
    database.transaction().execute(async (transaction) => {
      for (const original of originals) {
        await deleteAt(transaction, original);
      }
      await transaction.insertInto("rich_content").values(insertValue(replacement)).execute();
      return true;
    })
  );

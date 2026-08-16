import { v, type Infer } from "convex/values";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import { FindingsError } from "$findings/errors";
import { resourceTypeValidator } from "$revisions/types/change";
import type { Actor } from "$shared/types/actor";

/**
 * Where something came from, and what it said when it was read.
 *
 * **Each variant carries its own copy.** Pages change and get taken down, files
 * get replaced, and a citation that is only a pointer degrades into an
 * unfalsifiable claim the moment its target moves. `excerpt` and `capturedAt`
 * are what keep a finding checkable years later.
 *
 * A `resource` source names both `resourceType` and `resourceId`, because the
 * pair is the key — two resources of different kinds may carry the same id.
 *
 * `manual` exists so a finding can cite a conversation, a phone call, or prior
 * knowledge rather than forcing it into a fake URL.
 */
export const findingSourceValidator = v.union(
  v.object({
    kind: v.literal("file"),
    fileId: v.id("externalFiles"),
    /** A page, a cell, a timestamp — where in the file. */
    locator: v.optional(v.string()),
    excerpt: v.optional(v.string())
  }),
  v.object({
    kind: v.literal("url"),
    url: v.string(),
    title: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    /** Required: an excerpt with no date is a copy of nothing in particular. */
    capturedAt: v.number()
  }),
  v.object({
    kind: v.literal("resource"),
    resourceType: resourceTypeValidator,
    /** `v.string()` because three tables answer to it and a union of id types would make every reader choose. */
    resourceId: v.string(),
    locator: v.optional(v.string())
  }),
  v.object({
    kind: v.literal("message"),
    threadId: v.id("researchThreads"),
    messageId: v.id("messages")
  }),
  v.object({ kind: v.literal("manual"), note: v.string() })
);

export type FindingSource = Infer<typeof findingSourceValidator>;

/**
 * Something established, written down with what establishes it.
 *
 * No question, no hypothesis, and no bearing: all three are research links,
 * because all three relationships are many-to-many. One finding supports one
 * explanation while undercutting another, and a field here could say only one of
 * those at a time.
 */
export type Finding = {
  readonly id: Id<"findings">;
  readonly title: string;
  readonly body: ContentBlock[];
  readonly sources: FindingSource[];
  readonly createdBy: Actor;
  readonly updatedBy: Actor;
  readonly revision: number;
  readonly updatedAt: number;
};

/**
 * A finding as a list, a link, or a search result renders it.
 *
 * `title` is a separate column precisely so this exists: the body is a writeup
 * with tables and images in it, and nothing listing findings should have to ship
 * one to print a line.
 */
export type FindingSummary = Omit<Finding, "body" | "sources"> & {
  /** How much is behind the claim, which is the one thing a list says about evidence. */
  readonly sourceCount: number;
};

/** Everything a finding is authored as. `create` and `revise` take the same shape. */
export type FindingDraft = {
  readonly title: string;
  readonly body: ContentBlock[];
  readonly sources: FindingSource[];
};

/**
 * The stored form of a title: trimmed, and never empty.
 *
 * It is a separate column from the body so lists, links, and search results get
 * it without loading or parsing a writeup — all of which render a blank row for
 * a finding titled with spaces.
 */
export const findingTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new FindingsError("empty-title", "A finding has to state what it established");
  }
  return trimmed;
};

/**
 * The stored form of a citation list: every source points at something, and
 * every copy is left exactly as it was read.
 *
 * **What the author typed is trimmed; what the source said is not.** A note and
 * an address are authored, so normalizing them is tidying. An `excerpt` and a
 * page's `title` are the copy the citation exists for, and normalizing a copy
 * makes it a copy of something nobody saw.
 *
 * `capturedAt` must be a real moment for the same reason: a zero reads as 1970
 * and silently dates the excerpt to a day nothing was read.
 */
export const findingSources = (sources: FindingSource[]): FindingSource[] =>
  sources.map((source) => {
    if (source.kind === "manual") {
      const note = source.note.trim();
      if (note.length === 0) {
        throw new FindingsError("empty-source", "A manual source has to say what it is");
      }
      return { ...source, note };
    }
    if (source.kind === "url") {
      const url = source.url.trim();
      if (url.length === 0) {
        throw new FindingsError("empty-source", "A url source has to have somewhere to go back to");
      }
      if (source.capturedAt <= 0) {
        throw new FindingsError(
          "source-captured-at",
          `A source read at ${source.capturedAt} was read at no time at all`
        );
      }
      return { ...source, url };
    }
    return source;
  });

import {
  admitContentBlocks,
  currentMarkLink,
  textInContentBlocks
} from "$representation/data/behavior/content/admission";
import {
  hasExactFields,
  isStoredActor,
  isStoredIdentifier,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { AnchorWithin } from "$representation/data/types/collaboration/anchor";
import type { CommentTarget } from "$representation/data/types/collaboration/comment";
import type { TableRow } from "$representation/store/tables";

export type StoredCommentTarget = CommentTarget;

export const storedCommentTarget = (value: unknown): StoredCommentTarget | undefined => {
  const target = storedFields(value);
  if (
    target === undefined ||
    !hasExactFields(target, ["kind", "id"]) ||
    !isStoredIdentifier(target.id) ||
    (target.kind !== "document" && target.kind !== "presentation" && target.kind !== "spreadsheet")
  ) return undefined;
  const table = target.kind === "document"
    ? "documents"
    : target.kind === "presentation"
      ? "presentations"
      : "spreadsheets";
  return isStoredRowId(target.id, table)
    ? { kind: target.kind, id: target.id }
    : undefined;
};

const isStoredEnd = (value: unknown): boolean => {
  const end = storedFields(value);
  return end !== undefined &&
    hasExactFields(end, ["atom", "offset"]) &&
    isStoredIdentifier(end.atom) &&
    isStoredNatural(end.offset);
};

export const isStoredAnchorFor = (
  value: unknown,
  target: StoredCommentTarget["kind"]
): value is AnchorWithin => {
  const anchor = storedFields(value);
  if (anchor === undefined) return false;
  if (target === "document" && anchor.kind === "text") {
    return hasExactFields(anchor, ["kind", "spans"]) &&
      Array.isArray(anchor.spans) &&
      anchor.spans.length > 0 &&
      anchor.spans.every((value) => {
        const span = storedFields(value);
        return span !== undefined &&
          hasExactFields(span, ["blockId", "from", "to"]) &&
          isStoredIdentifier(span.blockId) &&
          isStoredEnd(span.from) &&
          isStoredEnd(span.to);
      });
  }
  if (target === "presentation" && anchor.kind === "slide") {
    return hasExactFields(anchor, ["kind", "slideId"]) && isStoredIdentifier(anchor.slideId);
  }
  if (target === "presentation" && anchor.kind === "element") {
    return hasExactFields(anchor, ["kind", "elementId"]) && isStoredIdentifier(anchor.elementId);
  }
  return target === "spreadsheet" &&
    anchor.kind === "cell" &&
    hasExactFields(anchor, ["kind", "rowId", "columnId"]) &&
    isStoredIdentifier(anchor.rowId) &&
    isStoredIdentifier(anchor.columnId);
};

export const isStoredCommentThread = (value: unknown): value is TableRow<"commentThreads"> => {
  const row = storedFields(value);
  if (
    row === undefined ||
    !hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "target", "createdBy", "updatedAt"],
      ["within", "quote", "resolution"]
    ) ||
    !isStoredRowId(row._id, "commentThreads") ||
    !isStoredTime(row._creationTime) ||
    !isStoredRowId(row.projectId, "projects") ||
    !isStoredActor(row.createdBy) ||
    !isStoredTime(row.updatedAt) ||
    (row.quote !== undefined && !isStoredText(row.quote))
  ) return false;
  const target = storedCommentTarget(row.target);
  if (target === undefined || (row.within !== undefined && !isStoredAnchorFor(row.within, target.kind))) {
    return false;
  }
  if (row.resolution === undefined) return true;
  const resolution = storedFields(row.resolution);
  return resolution !== undefined &&
    hasExactFields(resolution, ["by", "at"]) &&
    isStoredRowId(resolution.by, "users") &&
    isStoredTime(resolution.at);
};

export const isStoredComment = (value: unknown): value is TableRow<"comments"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "threadId", "blocks", "mentions", "author"],
      ["editedAt"]
    ) &&
    isStoredRowId(row._id, "comments") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.threadId, "commentThreads") &&
    admitContentBlocks(row.blocks) !== undefined &&
    Array.isArray(row.mentions) &&
    row.mentions.every(currentMarkLink) &&
    isStoredActor(row.author) &&
    (row.editedAt === undefined || isStoredTime(row.editedAt));
};

export const storedCommentText = (value: TableRow<"comments">): string =>
  textInContentBlocks(value.blocks);

import type { StoreModel } from "$model/server/store/index.server";
import {
  isStoredComment,
  isStoredCommentThread,
  storedCommentText
} from "$representation/data/behavior/collaboration/stored-comments";
import { storedFields } from "$representation/data/behavior/core/stored";
import { isStoredEditableResource } from "$representation/data/behavior/project-resources/stored";
import { projectActor } from "$capabilities/comments/api/read-comments/actors";
import type {
  CommentRemarkRecord,
  CommentTarget,
  CommentThreadRecord
} from "$capabilities/comments/types/read-comments";

const tableFor = (
  target: CommentTarget
): "documents" | "slideDecks" | "spreadsheets" =>
  target.kind === "document"
    ? "documents"
    : target.kind === "slides"
      ? "slideDecks"
      : "spreadsheets";

const ownsTarget = (
  store: StoreModel,
  projectId: string,
  visibleUserIds: ReadonlySet<string>,
  target: CommentTarget
): boolean => {
  const table = tableFor(target);
  const found = store.read(table);
  if (found?.kind !== "table" || found.table !== table) return false;
  const claimed = found.rows.filter((row) => storedFields(row)?._id === target.id);
  if (claimed.length !== 1 || !isStoredEditableResource(claimed[0], table)) return false;
  const row = claimed[0];
  return row.projectId === projectId &&
    projectActor(store, projectId, visibleUserIds, row.createdBy) !== undefined &&
    projectActor(store, projectId, visibleUserIds, row.updatedBy) !== undefined;
};

export const projectThread = (
  store: StoreModel,
  projectId: string,
  visibleUserIds: ReadonlySet<string>,
  stagedResourceIds: ReadonlySet<string>,
  value: unknown
): CommentThreadRecord | undefined => {
  if (!isStoredCommentThread(value) || value.projectId !== projectId) return undefined;
  const createdBy = projectActor(store, projectId, visibleUserIds, value.createdBy);
  if (
    createdBy === undefined ||
    stagedResourceIds.has(value.target.id) ||
    !ownsTarget(store, projectId, visibleUserIds, value.target) ||
    (value.resolution !== undefined && !visibleUserIds.has(value.resolution.by))
  ) return undefined;
  return {
    _id: value._id,
    _creationTime: value._creationTime,
    target: value.target,
    ...(value.within === undefined ? {} : { within: value.within }),
    ...(value.quote === undefined ? {} : { quote: value.quote }),
    ...(value.resolution === undefined ? {} : { resolution: value.resolution }),
    createdBy,
    updatedAt: value.updatedAt
  };
};

const mentionedUsersOf = (
  store: StoreModel,
  projectId: string,
  visibleUserIds: ReadonlySet<string>,
  mentions: readonly unknown[]
): string[] | undefined => {
  const users: string[] = [];
  for (const mention of mentions) {
    const fields = storedFields(mention);
    if (fields?.kind !== "actor") continue;
    const actor = projectActor(store, projectId, visibleUserIds, fields.actor);
    if (actor === undefined) return undefined;
    if (actor.kind === "user") users.push(actor.userId);
  }
  return users;
};

export const projectRemark = (
  store: StoreModel,
  projectId: string,
  threadIds: ReadonlySet<string>,
  visibleUserIds: ReadonlySet<string>,
  value: unknown
): CommentRemarkRecord | undefined => {
  if (
    !isStoredComment(value) ||
    value.projectId !== projectId ||
    !threadIds.has(value.threadId)
  ) return undefined;
  const author = projectActor(store, projectId, visibleUserIds, value.author);
  const mentionedUserIds = mentionedUsersOf(
    store,
    projectId,
    visibleUserIds,
    value.mentions
  );
  if (author === undefined || mentionedUserIds === undefined) return undefined;
  return {
    _id: value._id,
    _creationTime: value._creationTime,
    threadId: value.threadId,
    text: storedCommentText(value),
    author,
    mentionedUserIds,
    ...(value.editedAt === undefined ? {} : { editedAt: value.editedAt })
  };
};

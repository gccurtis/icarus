export { createCommentsCapability } from "./application/commentService.js";
export type {
  CommentClock,
  CommentDependencies,
  CommentsCapability
} from "./application/commentService.js";
export * from "./domain/model.js";
export * from "./domain/errors.js";
export {
  DEFAULT_COMMENT_LIMITS,
  normalizeSubTarget,
  parseCommentMentions
} from "./domain/validation.js";
export type { CommentLimits } from "./domain/validation.js";
export type { CommentActivityPublisher } from "./ports/activityPublisher.js";
export type {
  CommentListFilter,
  CommentStore,
  CommentWriteCommit
} from "./ports/commentStore.js";
export { SQLiteCommentStore } from "./persistence/sqliteCommentStore.js";
export { decodeCommentCommand } from "./wire/commandSchemas.js";
export { decodeCommentQuery } from "./wire/querySchemas.js";

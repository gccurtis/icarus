import { CommentWireError } from "../domain/errors.js";
import type { CommentQuery, CommentState } from "../domain/model.js";
import { decodeTarget, exactKeys, record, stringField } from "./common.js";

export const decodeCommentQuery = (value: unknown): CommentQuery => {
  const query = record(value, "Comment query");
  const type = stringField(query, "type", "Comment query type");
  switch (type) {
    case "comment.get":
      exactKeys(query, ["type", "commentId"], "Comment get query");
      return {
        type,
        commentId: stringField(query, "commentId", "Comment ID")
      };
    case "comment.listByTarget": {
      exactKeys(query, ["type", "target", "state", "cursor", "limit"], "Comment target-list query");
      const state = query.state;
      if (state !== undefined && state !== "open" && state !== "resolved") {
        throw new CommentWireError("Comment state must be 'open' or 'resolved'");
      }
      if (query.cursor !== undefined && typeof query.cursor !== "string") {
        throw new CommentWireError("Comment cursor must be a string");
      }
      if (query.limit !== undefined && typeof query.limit !== "number") {
        throw new CommentWireError("Comment limit must be a number");
      }
      const target = decodeTarget(query.target, false);
      return {
        type,
        target: {
          resourceKind: target.resourceKind,
          resourceId: target.resourceId
        },
        ...(state !== undefined ? { state: state as CommentState } : {}),
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        ...(query.limit !== undefined ? { limit: query.limit } : {})
      };
    }
    default:
      throw new CommentWireError(`Unsupported Comment query '${type}'`);
  }
};

import { CommentWireError } from "../domain/errors.js";
import type { CommentCommand } from "../domain/model.js";
import { decodeTarget, exactKeys, record, stringField } from "./common.js";

export const decodeCommentCommand = (value: unknown): CommentCommand => {
  const command = record(value, "Comment command");
  const type = stringField(command, "type", "Comment command type");
  switch (type) {
    case "comment.create":
      exactKeys(command, ["type", "requestId", "body", "target"], "Comment create command");
      return {
        type,
        requestId: stringField(command, "requestId", "Comment requestId"),
        body: stringField(command, "body", "Comment body"),
        target: decodeTarget(command.target, true)
      };
    case "comment.update":
      exactKeys(command, ["type", "requestId", "commentId", "body"], "Comment update command");
      return {
        type,
        requestId: stringField(command, "requestId", "Comment requestId"),
        commentId: stringField(command, "commentId", "Comment ID"),
        body: stringField(command, "body", "Comment body")
      };
    case "comment.resolve":
    case "comment.reopen":
    case "comment.delete":
      exactKeys(command, ["type", "requestId", "commentId"], `Comment ${type} command`);
      return {
        type,
        requestId: stringField(command, "requestId", "Comment requestId"),
        commentId: stringField(command, "commentId", "Comment ID")
      };
    default:
      throw new CommentWireError(`Unsupported Comment command '${type}'`);
  }
};

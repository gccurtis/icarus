import { CommentValidationError } from "./errors.js";
import type {
  CommentAttribution,
  CommentCommand,
  CommentQuery,
  CommentState,
  CommentTarget,
  JsonObject,
  JsonValue
} from "./model.js";

export interface CommentLimits {
  maxBodyBytes: number;
  maxIdentifierBytes: number;
  maxSubTargetBytes: number;
  maxMentions: number;
  maxMentionLength: number;
  defaultPageSize: number;
  maxPageSize: number;
}

export const DEFAULT_COMMENT_LIMITS: CommentLimits = {
  maxBodyBytes: 16 * 1024,
  maxIdentifierBytes: 4_096,
  maxSubTargetBytes: 16 * 1024,
  maxMentions: 64,
  maxMentionLength: 64,
  defaultPageSize: 50,
  maxPageSize: 200
};

const origins = new Set<CommentAttribution["origin"]>([
  "user",
  "agent",
  "automation",
  "system"
]);
const states = new Set<CommentState>(["open", "resolved"]);

const boundedText = (value: string, label: string, maximum: number): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new CommentValidationError(`${label} must be non-empty`);
  }
  if (Buffer.byteLength(normalized, "utf8") > maximum) {
    throw new CommentValidationError(`${label} exceeds its UTF-8 size limit`);
  }
  return normalized;
};

const canonicalJsonValue = (
  value: unknown,
  ancestors: Set<object>
): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CommentValidationError("Comment sub-target cannot contain a non-finite number");
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new CommentValidationError("Comment sub-target must contain JSON values only");
  }
  if (ancestors.has(value)) {
    throw new CommentValidationError("Comment sub-target cannot contain cycles");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => canonicalJsonValue(entry, ancestors));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CommentValidationError("Comment sub-target must be a JSON object");
    }
    const input = value as Record<string, unknown>;
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(input).sort()) {
      result[key] = canonicalJsonValue(input[key], ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
};

export const normalizeSubTarget = (
  value: unknown,
  limits: CommentLimits
): JsonObject => {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new CommentValidationError("Comment sub-target must be a JSON object");
  }
  const canonical = canonicalJsonValue(value, new Set()) as JsonObject;
  if (Buffer.byteLength(JSON.stringify(canonical), "utf8") > limits.maxSubTargetBytes) {
    throw new CommentValidationError("Comment sub-target exceeds its UTF-8 size limit");
  }
  return canonical;
};

export const normalizeCommentTarget = (
  target: CommentTarget,
  limits: CommentLimits
): CommentTarget => ({
  resourceKind: boundedText(target.resourceKind, "Comment target resource kind", limits.maxIdentifierBytes),
  resourceId: boundedText(target.resourceId, "Comment target resource ID", limits.maxIdentifierBytes),
  ...(target.subTarget !== undefined
    ? { subTarget: normalizeSubTarget(target.subTarget, limits) }
    : {})
});

/** Parses standalone ASCII @handles, excluding the @ in an email address. */
export const parseCommentMentions = (
  body: string,
  limits: CommentLimits = DEFAULT_COMMENT_LIMITS
): string[] => {
  const mentions: string[] = [];
  const seen = new Set<string>();
  const expression = /(^|[^A-Za-z0-9._%+\-])@([A-Za-z0-9][A-Za-z0-9._-]*)/g;
  for (const match of body.matchAll(expression)) {
    // A terminal period is prose punctuation, while interior periods remain
    // part of a handle (for example, @ada.lovelace).
    const handle = match[2].replace(/\.+$/, "").toLowerCase();
    if (handle.length > limits.maxMentionLength) {
      throw new CommentValidationError("Comment mention handle exceeds its length limit");
    }
    if (seen.has(handle)) continue;
    seen.add(handle);
    mentions.push(handle);
    if (mentions.length > limits.maxMentions) {
      throw new CommentValidationError("Comment exceeds its distinct mention limit");
    }
  }
  return mentions;
};

export const normalizeCommentAttribution = (
  attribution: CommentAttribution,
  limits: CommentLimits
): CommentAttribution => {
  if (!origins.has(attribution.origin)) {
    throw new CommentValidationError("Comment attribution origin is invalid");
  }
  return {
    actorId: boundedText(attribution.actorId, "Comment actor ID", limits.maxIdentifierBytes),
    origin: attribution.origin
  };
};

export const normalizeCommentCommand = (
  command: CommentCommand,
  limits: CommentLimits
): CommentCommand => {
  const requestId = boundedText(command.requestId, "Comment request ID", limits.maxIdentifierBytes);
  switch (command.type) {
    case "comment.create":
      return {
        type: command.type,
        requestId,
        body: boundedText(command.body, "Comment body", limits.maxBodyBytes),
        target: normalizeCommentTarget(command.target, limits)
      };
    case "comment.update":
      return {
        type: command.type,
        requestId,
        commentId: boundedText(command.commentId, "Comment ID", limits.maxIdentifierBytes),
        body: boundedText(command.body, "Comment body", limits.maxBodyBytes)
      };
    case "comment.resolve":
    case "comment.reopen":
    case "comment.delete":
      return {
        type: command.type,
        requestId,
        commentId: boundedText(command.commentId, "Comment ID", limits.maxIdentifierBytes)
      };
  }
};

export const normalizeCommentQuery = (
  query: CommentQuery,
  limits: CommentLimits
): CommentQuery => {
  if (query.type === "comment.get") {
    return {
      type: query.type,
      commentId: boundedText(query.commentId, "Comment ID", limits.maxIdentifierBytes)
    };
  }
  if (query.state !== undefined && !states.has(query.state)) {
    throw new CommentValidationError("Comment state filter is invalid");
  }
  if (
    query.limit !== undefined &&
    (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > limits.maxPageSize)
  ) {
    throw new CommentValidationError(`Comment page limit must be between 1 and ${limits.maxPageSize}`);
  }
  return {
    type: query.type,
    target: {
      resourceKind: boundedText(query.target.resourceKind, "Comment target resource kind", limits.maxIdentifierBytes),
      resourceId: boundedText(query.target.resourceId, "Comment target resource ID", limits.maxIdentifierBytes)
    },
    ...(query.state !== undefined ? { state: query.state } : {}),
    ...(query.cursor !== undefined
      ? { cursor: boundedText(query.cursor, "Comment cursor", limits.maxIdentifierBytes) }
      : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {})
  };
};

export const assertCommentLimits = (limits: CommentLimits): void => {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new CommentValidationError(`Comment limit '${name}' must be a positive safe integer`);
    }
  }
  if (limits.defaultPageSize > limits.maxPageSize) {
    throw new CommentValidationError("Comment default page size cannot exceed its maximum");
  }
};

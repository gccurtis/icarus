import type {
  AnchorEnd,
  AnchorWithin,
  TextAnchorSpan
} from "$representation/data/types/collaboration/anchor";
import type { CommentTarget } from "$representation/data/types/collaboration/comment";
import type { StartThreadInput } from "$capabilities/comments/types/start-thread";
import {
  hasExactFields,
  isStoredIdentifier,
  isStoredRowId,
  storedFields,
  type StoredFields
} from "$representation/data/behavior/core/stored";

const TARGETS: readonly string[] = ["document", "slides", "spreadsheet"];

const refuse = (reason: string): never => {
  throw new Error(`comments/start-thread: ${reason}`);
};

const isRecord = (value: unknown): value is StoredFields => storedFields(value) !== undefined;

const exact = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean => {
  return hasExactFields(value, required, optional);
};

const identifier = (value: unknown): value is string =>
  isStoredIdentifier(value);

const asTarget = (value: unknown): CommentTarget => {
  if (!isRecord(value) || !exact(value, ["kind", "id"])) return refuse("target is required");
  const { kind, id } = value;
  if (typeof kind !== "string" || !TARGETS.includes(kind)) return refuse("target.kind is not a resource kind");
  if (!identifier(id)) return refuse("target.id is required");
  const table = kind === "document" ? "documents" : kind === "slides" ? "slideDecks" : "spreadsheets";
  if (!isStoredRowId(id, table)) {
    return refuse("target.kind and target.id must name the same current resource table");
  }
  return { kind, id } as CommentTarget;
};

const asEnd = (value: unknown, field: string): AnchorEnd => {
  if (!isRecord(value) || !exact(value, ["atom", "offset"])) return refuse(`${field} is required`);
  const { atom, offset } = value;
  if (!identifier(atom) || !Number.isInteger(offset) || Number(offset) < 0) {
    return refuse(`${field}.atom and ${field}.offset are required`);
  }
  return { atom, offset: Number(offset) };
};

const asSpan = (value: unknown, at: number): TextAnchorSpan => {
  if (!isRecord(value) || !exact(value, ["blockId", "from", "to"])) return refuse(`within.spans[${at}] is required`);
  const held = value;
  if (!identifier(held.blockId)) {
    return refuse(`within.spans[${at}].blockId is required`);
  }
  return {
    blockId: held.blockId,
    from: asEnd(held.from, `within.spans[${at}].from`),
    to: asEnd(held.to, `within.spans[${at}].to`)
  };
};

const asWithin = (value: unknown): AnchorWithin | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return refuse("within must be an anchor");
  const held = value;
  switch (held.kind) {
    case "slide":
      return exact(held, ["kind", "slideId"]) && identifier(held.slideId)
        ? { kind: "slide", slideId: held.slideId }
        : refuse("within.slideId is required");
    case "element":
      return exact(held, ["kind", "elementId"]) && identifier(held.elementId)
        ? { kind: "element", elementId: held.elementId }
        : refuse("within.elementId is required");
    case "cell":
      return exact(held, ["kind", "rowId", "columnId"]) && identifier(held.rowId) && identifier(held.columnId)
        ? { kind: "cell", rowId: held.rowId, columnId: held.columnId }
        : refuse("within.rowId and within.columnId are required");
    case "text":
      return exact(held, ["kind", "spans"]) && Array.isArray(held.spans) && held.spans.length > 0
        ? { kind: "text", spans: held.spans.map(asSpan) }
        : refuse("within.spans is required");
    default:
      return refuse("within.kind is not an anchor kind");
  }
};

export const validateStartThread = (input: unknown): StartThreadInput => {
  if (!isRecord(input) || !exact(input, ["target", "text"], ["within", "quote"])) {
    return refuse("an exact object is required");
  }
  const { target, within, quote, text } = input;
  if (typeof text !== "string" || text.trim().length === 0) return refuse("text is required");
  if (quote !== undefined && typeof quote !== "string") return refuse("quote must be a string");
  const admittedTarget = asTarget(target);
  const admittedWithin = asWithin(within);
  if (
    admittedWithin !== undefined &&
    !(
      (admittedTarget.kind === "document" && admittedWithin.kind === "text") ||
      (admittedTarget.kind === "slides" && (admittedWithin.kind === "slide" || admittedWithin.kind === "element")) ||
      (admittedTarget.kind === "spreadsheet" && admittedWithin.kind === "cell")
    )
  ) return refuse("within.kind does not belong to target.kind");
  return {
    target: admittedTarget,
    within: admittedWithin,
    quote: quote === undefined || quote === "" ? undefined : quote,
    text: text.trim()
  };
};

import type {
  AnchorEnd,
  AnchorWithin,
  TextAnchorSpan
} from "$representation/data/types/collaboration/anchor";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { StartThreadInput } from "$capabilities/comments/types/start-thread";

const TARGETS: readonly string[] = ["document", "slides", "spreadsheet"];

const refuse = (reason: string): never => {
  throw new Error(`comments/start-thread: ${reason}`);
};

const asTarget = (value: unknown): ResourceRef => {
  if (typeof value !== "object" || value === null) return refuse("target is required");
  const { kind, id } = value as { kind?: unknown; id?: unknown };
  if (typeof kind !== "string" || !TARGETS.includes(kind)) return refuse("target.kind is not a resource kind");
  if (typeof id !== "string" || id.length === 0) return refuse("target.id is required");
  return { kind, id } as ResourceRef;
};

const asEnd = (value: unknown, field: string): AnchorEnd => {
  if (typeof value !== "object" || value === null) return refuse(`${field} is required`);
  const { atom, offset } = value as { atom?: unknown; offset?: unknown };
  if (typeof atom !== "string" || atom.length === 0 || !Number.isInteger(offset) || Number(offset) < 0) {
    return refuse(`${field}.atom and ${field}.offset are required`);
  }
  return { atom, offset: Number(offset) };
};

const asSpan = (value: unknown, at: number): TextAnchorSpan => {
  if (typeof value !== "object" || value === null) return refuse(`within.spans[${at}] is required`);
  const held = value as Record<string, unknown>;
  if (typeof held.blockId !== "string" || held.blockId.length === 0) {
    return refuse(`within.spans[${at}].blockId is required`);
  }
  return {
    blockId: held.blockId,
    from: asEnd(held.from, `within.spans[${at}].from`),
    to: asEnd(held.to, `within.spans[${at}].to`)
  };
};

const asWithin = (value: unknown): AnchorWithin | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") return refuse("within must be an anchor");
  const held = value as Record<string, unknown>;
  switch (held.kind) {
    case "slide":
      return typeof held.slideId === "string" ? { kind: "slide", slideId: held.slideId } : refuse("within.slideId is required");
    case "element":
      return typeof held.elementId === "string" ? { kind: "element", elementId: held.elementId } : refuse("within.elementId is required");
    case "cell":
      return typeof held.rowId === "string" && typeof held.columnId === "string"
        ? { kind: "cell", rowId: held.rowId, columnId: held.columnId }
        : refuse("within.rowId and within.columnId are required");
    case "text":
      return Array.isArray(held.spans) && held.spans.length > 0
        ? { kind: "text", spans: held.spans.map(asSpan) }
        : refuse("within.spans is required");
    default:
      return refuse("within.kind is not an anchor kind");
  }
};

export const validateStartThread = (input: unknown): StartThreadInput => {
  if (typeof input !== "object" || input === null) return refuse("an object is required");
  const { target, within, quote, text } = input as { target?: unknown; within?: unknown; quote?: unknown; text?: unknown };
  if (typeof text !== "string" || text.trim().length === 0) return refuse("text is required");
  if (quote !== undefined && typeof quote !== "string") return refuse("quote must be a string");
  return {
    target: asTarget(target),
    within: asWithin(within),
    quote: quote === undefined || quote === "" ? undefined : quote,
    text: text.trim()
  };
};

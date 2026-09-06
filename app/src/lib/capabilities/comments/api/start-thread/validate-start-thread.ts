import type { AnchorWithin } from "$representation/data/types/collaboration/anchor";
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
      return typeof held.blockId === "string" && typeof held.from === "number" && typeof held.to === "number"
        ? { kind: "text", blockId: held.blockId, from: held.from, to: held.to }
        : refuse("within.blockId, within.from and within.to are required");
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

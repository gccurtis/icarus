import type { ResearchScope, ResearchToolId } from "$representation/data/types/investigation/research-turn";
import type { AskInput } from "$capabilities/research-chat/types/research-chat";

const TOOLS: readonly ResearchToolId[] = ["web.search"];

const scopeOf = (value: unknown): ResearchScope => {
  if (value === undefined) return { kind: "project" };
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("a scope is an object");
  }
  const asked = value as Record<string, unknown>;
  if (asked.kind === "project") return { kind: "project" };
  if (asked.kind !== "resource") throw new Error("a scope is the project or one resource");
  const ref = asked.ref;
  if (ref === null || typeof ref !== "object" || Array.isArray(ref)) {
    throw new Error("a resource scope needs a ref");
  }
  const candidate = ref as Record<string, unknown>;
  if (typeof candidate.kind !== "string" || typeof candidate.id !== "string") {
    throw new Error("a ref has a kind and an id");
  }
  return { kind: "resource", ref: { kind: candidate.kind, id: candidate.id } };
};

export const validateAsk = (input: unknown): AskInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("ask takes an object");
  }
  const asked = input as Record<string, unknown>;
  if (typeof asked.threadId !== "string" || asked.threadId.trim() === "") {
    throw new Error("ask needs a threadId");
  }
  if (typeof asked.text !== "string" || asked.text.trim() === "") {
    throw new Error("ask needs something to ask");
  }
  if (asked.text.length > 4_000) throw new Error("a question is at most four thousand characters");
  if (asked.tools !== undefined && !Array.isArray(asked.tools)) {
    throw new Error("tools are a list");
  }
  const chosen: readonly unknown[] = Array.isArray(asked.tools) ? asked.tools : [];
  const tools = TOOLS.filter((tool) => chosen.includes(tool));
  return {
    threadId: asked.threadId,
    text: asked.text.trim(),
    scope: scopeOf(asked.scope),
    tools
  };
};

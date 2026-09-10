import type { ResearchScope, ResearchToolId } from "$representation/data/types/investigation/research-turn";
import { admitResourceRef } from "$representation/data/behavior/core/resource";
import { isStoredRowId } from "$representation/data/behavior/core/stored";
import type { AskInput } from "$capabilities/research-chat/types/research-chat";

const TOOLS: readonly ResearchToolId[] = ["web.search"];

const only = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  subject: string
): void => {
  const unknown = Object.keys(value).find((field) => !allowed.includes(field));
  if (unknown !== undefined) throw new Error(`${subject} has unknown field '${unknown}'`);
};

const scopeOf = (value: unknown): ResearchScope => {
  if (value === undefined) return { kind: "project" };
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("a scope is an object");
  }
  const asked = value as Record<string, unknown>;
  if (asked.kind === "project") {
    only(asked, ["kind"], "a project scope");
    return { kind: "project" };
  }
  if (asked.kind !== "resource") throw new Error("a scope is the project or one resource");
  only(asked, ["kind", "ref"], "a resource scope");
  try {
    return { kind: "resource", ref: admitResourceRef(asked.ref, "research scope ref") };
  } catch {
    throw new Error("a resource scope needs one exact current ref");
  }
};

export const validateAsk = (input: unknown): AskInput => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("ask takes an object");
  }
  const asked = input as Record<string, unknown>;
  only(asked, ["threadId", "text", "scope", "tools"], "ask input");
  if (!isStoredRowId(asked.threadId, "researchThreads")) {
    throw new Error("ask needs one current researchThreads row id");
  }
  if (typeof asked.text !== "string" || asked.text.trim() === "") {
    throw new Error("ask needs something to ask");
  }
  if (asked.text.length > 4_000) throw new Error("a question is at most four thousand characters");
  if (
    asked.tools !== undefined &&
    (!Array.isArray(asked.tools) ||
      asked.tools.some((tool) => !TOOLS.includes(tool as ResearchToolId)) ||
      new Set(asked.tools).size !== asked.tools.length)
  ) {
    throw new Error("tools are distinct current research tool ids");
  }
  const tools = (asked.tools ?? []) as ResearchToolId[];
  return {
    threadId: asked.threadId,
    text: asked.text.trim(),
    scope: scopeOf(asked.scope),
    tools
  };
};

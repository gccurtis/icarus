import type { ResearchScope, ResearchToolId } from "$representation/data/types/investigation/research-turn";
import { admitResourceRef } from "$representation/data/behavior/core/resource";
import {
  currentRowId,
  exactCommandInput
} from "$capabilities/research-chat/api/shared/validation";
import type { AskInput } from "$capabilities/research-chat/types/research-chat";

const TOOLS: readonly ResearchToolId[] = ["web.search"];

const scopeOf = (value: unknown): ResearchScope => {
  const discriminated = exactCommandInput(value, ["kind"], ["ref"], "a research scope");
  const asked = discriminated;
  if (asked.kind === "project") {
    exactCommandInput(value, ["kind"], [], "a project scope");
    return { kind: "project" };
  }
  if (asked.kind !== "resource") throw new Error("a scope is the project or one resource");
  exactCommandInput(value, ["kind", "ref"], [], "a resource scope");
  try {
    return { kind: "resource", ref: admitResourceRef(asked.ref, "research scope ref") };
  } catch {
    throw new Error("a resource scope needs one exact current ref");
  }
};

export const validateAsk = (input: unknown): AskInput => {
  const asked = exactCommandInput(
    input,
    ["threadId", "text"],
    ["scope", "tools"],
    "ask"
  );
  const threadId = currentRowId(asked.threadId, "researchThreads", "ask");
  if (typeof asked.text !== "string" || asked.text.trim() === "") {
    throw new Error("ask needs something to ask");
  }
  if (asked.text.length > 4_000) throw new Error("a question is at most four thousand characters");
  if (
    Object.hasOwn(asked, "tools") &&
    (!Array.isArray(asked.tools) ||
      asked.tools.some((tool) => !TOOLS.includes(tool as ResearchToolId)) ||
      new Set(asked.tools).size !== asked.tools.length)
  ) {
    throw new Error("tools are distinct current research tool ids");
  }
  const tools = (Object.hasOwn(asked, "tools") ? asked.tools : []) as ResearchToolId[];
  return {
    threadId,
    text: asked.text.trim(),
    scope: Object.hasOwn(asked, "scope") ? scopeOf(asked.scope) : { kind: "project" },
    tools
  };
};

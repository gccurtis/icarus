import type { ServerModel } from "$runtime/server/start.server";
import type { IntelligenceTool } from "$model/server/intelligence/index.server";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { MaterialSourceSnapshot } from "$representation/data/types/semantic/material";
import type { ToolId } from "$representation/data/types/agents/tool";
import type { Id } from "$representation/data/types/core/id";
import type {
  ResearchScope,
  ResearchSource
} from "$representation/data/types/investigation/research-turn";

/**
 * What every tool in a turn is built from.
 *
 * The session's own closure — which refs are reachable, which source ids have
 * been issued, what each resource is called — reaches the tools as a context
 * rather than by being in scope, so the tools can be read one family at a time.
 */
export type ToolContext = {
  readonly input: SessionInput;
  readonly materials: Map<string, MaterialSourceSnapshot>;
  inScope(ref: ResourceRef): boolean;
  issue(key: string, draft: Omit<ResearchSource, "id" | "uses">): string;
  nameOf(ref: ResourceRef): string;
  /** What each call handed back, for the turn's log. */
  readonly returned: number[];
};

export type ToolSession = {
  readonly tools: readonly IntelligenceTool[];
  readonly queries: readonly string[];
  /** What the tools actually handed back, per call, for the turn's log. */
  readonly returned: number[];
  sourceOf(id: string): ResearchSource | undefined;
  issued(): readonly ResearchSource[];
};

export type SessionInput = {
  readonly model: ServerModel;
  readonly projectId: Id<"projects">;
  readonly scope: ResearchScope;
  readonly topK: number;
  /**
   * The persona's grants, translated into tools.
   *
   * A grant is a family: retrieve opens both discovery lanes, resource.read
   * opens reading and navigating. A chat with no persona is granted both,
   * because a chat that cannot read the project is not a chat about it.
   */
  readonly grants: readonly ToolId[];
  /**
   * What the persona may read at all, when it holds a scope.
   *
   * Narrower than the turn's own choice and never widened by it: a scoped
   * persona that could search the whole project by opening a chat would make
   * its scope decorative.
   */
  readonly bound?: ResourceSet;
  /** Answered by the turn row: has a person asked it to stop and answer now? */
  stopping(): boolean;
};

export const STOPPED = {
  stopped: true,
  message:
    "The person asked you to answer now. Do not search again. Call submit_answer with what you already have."
};

export const RESOURCE_TABLES = [
  ["document", "documents"],
  ["slides", "slideDecks"],
  ["spreadsheet", "spreadsheets"]
] as const;

export const asRecord = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

export const askedQuery = (value: unknown, fallbackTopK: number): { query: string; topK: number } => {
  const asked = asRecord(value, "the input must be an object");
  if (typeof asked.query !== "string" || asked.query.trim() === "") {
    throw new Error("query must be a non-empty string");
  }
  if (asked.query.length > 2_000) throw new Error("query is too long");
  const topK = asked.topK ?? fallbackTopK;
  if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 20) {
    throw new Error("topK must be a whole number from 1 through 20");
  }
  return { query: asked.query.trim(), topK: topK as number };
};

export const chosen = (scope: ResearchScope, ref: ResourceRef): boolean =>
  scope.kind === "project" || (scope.ref.kind === ref.kind && scope.ref.id === ref.id);

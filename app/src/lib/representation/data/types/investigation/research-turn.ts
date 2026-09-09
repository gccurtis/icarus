import type { ResourceRef } from "$representation/data/types/core/resource";

/**
 * What the turn is doing, and how it ended.
 *
 * `insufficient` is not a failure: the run completed and found nothing it could
 * stand behind. A failure is the provider, the queue or the code.
 */
export type ResearchTurnState =
  | "queued"
  | "running"
  | "answered"
  | "insufficient"
  | "failed"
  | "cancelled";

/** What a turn was allowed to read. One choice, made where the question is written. */
export type ResearchScope = { kind: "project" } | { kind: "resource"; ref: ResourceRef };

/** The tools a person turns on. Retrieval and reading are not among them. */
export type ResearchToolId = "web.search";

/**
 * One thing the answer stands on, named as the reader would recognise it.
 *
 * `uses` holds what the answer said it took from this source, one entry per
 * claim, so a source that carried three claims reads as three rather than as a
 * bare reference.
 */
export type ResearchSource = {
  id: string;
  ref: ResourceRef;
  title: string;
  locator?: string;
  excerpt: string;
  uses: string[];
};

/** A claim the turn is prepared to defend, and the sources under it. */
export type ResearchFinding = {
  id: string;
  text: string;
  sourceIds: string[];
};

export type ResearchTurnUsage = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
};

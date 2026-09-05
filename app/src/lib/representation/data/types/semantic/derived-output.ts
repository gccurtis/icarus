import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { SemanticSpan } from "$representation/data/types/semantic/overlay";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";

/** One attempt-local evidence identifier the model selected, plus its stated role. */
export type SemanticEvidenceSelection = {
  evidenceId: string;
  use: string;
};

/** Stored by value so an answer remains grounded after active rows are replaced. */
export type SemanticCitation = {
  selections: SemanticEvidenceSelection[];
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  overlayGeneration: number;
};

export type DerivedState = "idle" | "generating" | "fresh" | "stale" | "error";

/** The stored Derived Output value; refresh replaces its evidence and response atomically. */
export type DerivedOutputFields = {
  projectId: Id<"projects">;
  prompt: string;
  scope?: ResourceSet;
  queries: string[];
  evidence: SemanticCitation[];
  lastResponse?: ContentBlock;
  lastRevision?: number;
  lastGeneration?: number;
  state: DerivedState;
  error?: string;
  refreshedAt?: number;
  createdBy: Actor;
  updatedAt: number;
};

export type DerivedOutput = Row<"derivedOutputs"> & DerivedOutputFields;

import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { SemanticSpan } from "$representation/data/types/semantic/overlay";
import type {
  SemanticLocatorSpan,
  SemanticSourceSnapshot
} from "$representation/data/types/semantic/source";
import type {
  MaterialFacetKind,
  MaterialNativeSelection,
  MaterialSourceSnapshot
} from "$representation/data/types/semantic/material";
import type { ResourceRef } from "$representation/data/types/core/resource";

/** One attempt-local evidence identifier the model selected, plus its stated role. */
export type SemanticEvidenceSelection = {
  evidenceId: string;
  use: string;
};

/** Stored by value so an answer remains grounded after active rows are replaced. */
export type SemanticTextCitation = {
  selections: SemanticEvidenceSelection[];
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  /** Copied by value so editor provenance survives active-source replacement. */
  locators?: SemanticLocatorSpan[];
  /** Copied partition guard so citations selected across calls cannot cross it. */
  partition?: string;
  overlayGeneration: number;
};

export type MaterialDescriptorCitation = {
  evidenceKind: "descriptor";
  distance: 2;
  selections: SemanticEvidenceSelection[];
  material: MaterialSourceSnapshot;
  facet: MaterialFacetKind;
  text: string;
  inputHash: string;
  model?: string;
  promptVersion?: string;
  overlayGeneration: number;
};

export type MaterialNativeCitation = {
  evidenceKind: "structured" | "visual" | "code";
  distance: 0 | 1;
  selections: SemanticEvidenceSelection[];
  material: MaterialSourceSnapshot;
  selection: MaterialNativeSelection;
  /** Bounded values copied by value; visual evidence stores immutable hash/crop metadata. */
  value: unknown;
  overlayGeneration: number;
};

export type SemanticCitation =
  | SemanticTextCitation
  | MaterialDescriptorCitation
  | MaterialNativeCitation;

export type DerivedOutputSelection = {
  ref: ResourceRef;
  from: number;
  to: number;
};

export type DerivedState = "idle" | "generating" | "fresh" | "stale" | "error";

export type DerivedOutputRefreshJobState = "queued" | "running" | "failed";

export type DerivedVariableDefinition = {
  name: string;
  prompt: string;
  origin?: ResourceRef;
};

/** A text format rendered by application code after every variable is grounded. */
export type DerivedTemplateDefinition = {
  variables: DerivedVariableDefinition[];
  output: string;
  exampleResponse?: string;
};

export type DerivedVariableResolution = {
  name: string;
  value: string;
  evidence: SemanticEvidenceSelection[];
};

/** The stored Derived Output value; refresh replaces its evidence and response atomically. */
export type DerivedOutputFields = {
  projectId: Id<"projects">;
  prompt: string;
  /** Resource containing the Prompt Block. Navigation context, never evidence. */
  origin?: ResourceRef;
  template?: DerivedTemplateDefinition;
  scope?: ResourceSet;
  queries: string[];
  evidence: SemanticCitation[];
  lastVariables?: DerivedVariableResolution[];
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

/**
 * One durable, coalesced refresh intent per Derived Output.
 *
 * `requestedVersion` advances when another browser signals refresh while a
 * worker is running. The worker performs one cheap follow-up pull after its
 * current attempt, so a source edit which landed mid-generation is not lost.
 */
export type DerivedOutputRefreshJobFields = {
  projectId: Id<"projects">;
  derivedOutputId: Id<"derivedOutputs">;
  selection?: DerivedOutputSelection;
  state: DerivedOutputRefreshJobState;
  requestedVersion: number;
  attempts: number;
  error?: string;
  queuedAt: number;
  startedAt?: number;
  updatedAt: number;
};

export type DerivedOutputRefreshJob = Row<"derivedOutputRefreshJobs"> &
  DerivedOutputRefreshJobFields;

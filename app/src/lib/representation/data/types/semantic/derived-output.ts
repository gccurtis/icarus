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
  evidenceKind: "text";
  selections: SemanticEvidenceSelection[];
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  /** Copied by value so editor provenance survives active-source replacement. */
  locators?: SemanticLocatorSpan[];
  /** Copied partition guard so citations selected across calls cannot cross it. */
  partition?: string;
  overlayGeneration: number;
};

type MaterialDescriptorCitationBase = {
  evidenceKind: "descriptor";
  distance: 2;
  selections: SemanticEvidenceSelection[];
  material: MaterialSourceSnapshot;
  text: string;
  inputHash: string;
  overlayGeneration: number;
};

/** Generated language has model provenance; deterministic/authored facets do not. */
export type MaterialDescriptorCitation = MaterialDescriptorCitationBase & (
  | {
      facet: "generated";
      model: string;
      promptVersion: string;
    }
  | {
      facet: Exclude<MaterialFacetKind, "generated">;
      model?: never;
      promptVersion?: never;
    }
);

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

/** State of the last readable value; refresh operation state belongs to its job. */
export type DerivedState = "idle" | "fresh" | "stale" | "error";

export type DerivedOutputRefreshJobState = "queued" | "running" | "failed";

export type DerivedVariableDefinition = {
  name: string;
  prompt: string;
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
type DerivedOutputBaseFields = {
  projectId: Id<"projects">;
  prompt: string;
  /** Advances only when a user-controlled generation input changes. */
  definitionRevision: number;
  /** Resource containing the Prompt Block. Navigation context, never evidence. */
  origin?: ResourceRef;
  template?: DerivedTemplateDefinition;
  scope?: ResourceSet;
  createdBy: Actor;
  updatedAt: number;
};

type DerivedOutputWithoutValue = {
  valueSource: "none";
  queries: [];
  evidence: [];
  lastVariables?: never;
  lastResponse?: never;
  lastRevision?: never;
  lastGeneration?: never;
  refreshedAt?: never;
};

type DerivedOutputWithAuthoredValue = {
  valueSource: "authored";
  queries: [];
  evidence: [];
  lastVariables?: never;
  lastResponse: ContentBlock;
  lastRevision: number;
  lastGeneration?: never;
  refreshedAt?: never;
};

type DerivedOutputWithGeneratedValue = {
  valueSource: "generated";
  queries: string[];
  evidence: SemanticCitation[];
  lastVariables?: DerivedVariableResolution[];
  lastResponse: ContentBlock;
  lastRevision: number;
  lastGeneration: number;
  refreshedAt: number;
};

type DerivedOutputValue =
  | DerivedOutputWithoutValue
  | DerivedOutputWithAuthoredValue
  | DerivedOutputWithGeneratedValue;

export type DerivedOutputFields = DerivedOutputBaseFields & (
  | (DerivedOutputWithoutValue & { state: "idle"; error?: never })
  | (DerivedOutputValue & {
      state: "stale";
      error?: never;
    })
  | (DerivedOutputWithGeneratedValue & { state: "fresh"; error?: never })
  | (DerivedOutputValue & {
      state: "error";
      error: string;
    })
);

export type DerivedOutput = Row<"derivedOutputs"> & DerivedOutputFields;

/**
 * One durable, coalesced refresh intent per Derived Output.
 *
 * `requestedVersion` advances only when the requested definition or selection
 * changes while a worker is running. Repeated signals for the same input join
 * the existing work without manufacturing a follow-up pass.
 */
type DerivedOutputRefreshJobBaseFields = {
  projectId: Id<"projects">;
  derivedOutputId: Id<"derivedOutputs">;
  selection?: DerivedOutputSelection;
  requestKey: string;
  requestedVersion: number;
  attempts: number;
  queuedAt: number;
  updatedAt: number;
};

export type DerivedOutputRefreshJobFields = DerivedOutputRefreshJobBaseFields & (
  | { state: "queued"; error?: never; startedAt?: never }
  | { state: "running"; error?: never; startedAt: number }
  | { state: "failed"; error: string; startedAt: number }
);

export type DerivedOutputRefreshJob = Row<"derivedOutputRefreshJobs"> &
  DerivedOutputRefreshJobFields;

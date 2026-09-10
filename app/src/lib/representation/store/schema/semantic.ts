import type { CurrentRowPolicies } from "$representation/store/schema/types";

export const SEMANTIC_ROW_POLICIES = {
  derivedOutputs: {
    projectId: "required", prompt: "required", definitionRevision: "required", origin: "optional",
    template: "optional", scope: "optional", queries: "required", evidence: "required",
    lastVariables: "optional", lastResponse: "optional", lastRevision: "optional",
    lastGeneration: "optional", state: "required", error: "optional", refreshedAt: "optional",
    createdBy: "required", updatedAt: "required"
  },
  derivedOutputRefreshJobs: {
    projectId: "required", derivedOutputId: "required", selection: "optional", state: "required",
    requestKey: "required", requestedVersion: "required", attempts: "required", error: "optional",
    queuedAt: "required", startedAt: "optional", updatedAt: "required"
  },
  semanticOverlays: {
    projectId: "required", generation: "required", embedding: "required", updatedAt: "required"
  },
  semanticSources: {
    projectId: "required", ref: "required", revision: "required", contentHash: "optional",
    encoding: "required", locators: "optional", hardBoundaries: "optional", updatedAt: "required"
  },
  semanticSyncJobs: {
    projectId: "required", ref: "required", requestedRevision: "required", force: "optional",
    state: "required", attempts: "required", error: "optional", queuedAt: "required",
    startedAt: "optional", updatedAt: "required", claimId: "optional", leaseExpiresAt: "optional"
  },
  semanticObjects: {
    projectId: "required", vector: "required", lane: "required", semanticSourceId: "optional",
    span: "optional", semanticMaterialId: "optional", facetText: "optional", inputHash: "optional",
    facet: "optional", scopeRefs: "optional"
  },
  semanticObjectHistory: {
    projectId: "required", retiredGeneration: "required", object: "required", retiredAt: "required"
  },
  semanticIndexes: {
    projectId: "required", semanticOverlayId: "required", method: "required", lane: "required",
    rootNodeIds: "required", configuration: "required", updatedAt: "required"
  },
  semanticIndexNodes: {
    projectId: "required", indexId: "required", parentNodeId: "optional",
    centroidVector: "required", children: "required"
  },
  semanticMaterials: {
    projectId: "required", identityKey: "required", kind: "required", name: "required",
    source: "required", profile: "required", profileHash: "required", contextHash: "required",
    revisionKey: "required", userDescription: "optional", descriptor: "optional", state: "required",
    error: "optional", updatedAt: "required"
  },
  semanticMaterialPlacements: {
    projectId: "required", semanticMaterialId: "required", ref: "required", revision: "required",
    locator: "required", context: "required", contextHash: "required", updatedAt: "required"
  },
  semanticMaterialJobs: {
    projectId: "required", ref: "required", requestedRevision: "required", force: "optional",
    state: "required", attempts: "required", error: "optional", queuedAt: "required",
    startedAt: "optional", claimId: "optional", leaseExpiresAt: "optional", updatedAt: "required"
  },
  semanticMaterialHistory: {
    projectId: "required", retiredGeneration: "required", material: "required", retiredAt: "required"
  }
} satisfies Pick<
  CurrentRowPolicies,
  | "derivedOutputs"
  | "derivedOutputRefreshJobs"
  | "semanticOverlays"
  | "semanticSources"
  | "semanticSyncJobs"
  | "semanticObjects"
  | "semanticObjectHistory"
  | "semanticIndexes"
  | "semanticIndexNodes"
  | "semanticMaterials"
  | "semanticMaterialPlacements"
  | "semanticMaterialJobs"
  | "semanticMaterialHistory"
>;

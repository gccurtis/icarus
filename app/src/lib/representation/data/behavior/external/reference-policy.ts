import type { TableName } from "$representation/store/tables";

export type ExternalReferencePolicy =
  | "live-traversal"
  | "leader-only"
  | "historical-by-value"
  | "derived-cache"
  | "identity-free"
  | "subject"
  | "transient-navigation";

/**
 * Exhaustive table audit for External deletion safety. A newly admitted table
 * is a compile error until its resource-reference semantics are classified.
 */
export const EXTERNAL_REFERENCE_POLICY = {
  activity: "historical-by-value",
  agentTasks: "live-traversal",
  automations: "live-traversal",
  comments: "live-traversal",
  commentThreads: "live-traversal",
  connectors: "identity-free",
  dataBackReferences: "identity-free",
  derivedOutputRefreshJobs: "live-traversal",
  derivedOutputs: "live-traversal",
  documentChangeSets: "historical-by-value",
  documents: "identity-free",
  documentSnapshots: "leader-only",
  externalFiles: "subject",
  findings: "live-traversal",
  formulas: "live-traversal",
  hypotheses: "live-traversal",
  memberships: "identity-free",
  personas: "live-traversal",
  projects: "identity-free",
  questions: "live-traversal",
  researchThreads: "identity-free",
  researchTurns: "live-traversal",
  resourceSets: "live-traversal",
  semanticIndexes: "derived-cache",
  semanticIndexNodes: "derived-cache",
  semanticMaterialHistory: "historical-by-value",
  semanticMaterialJobs: "derived-cache",
  semanticMaterialPlacements: "derived-cache",
  semanticMaterials: "derived-cache",
  semanticObjectHistory: "historical-by-value",
  semanticObjects: "derived-cache",
  semanticOverlays: "derived-cache",
  semanticSources: "derived-cache",
  semanticSyncJobs: "derived-cache",
  sheetCells: "live-traversal",
  slideDeckChangeSets: "historical-by-value",
  slideDecks: "identity-free",
  slideDeckSnapshots: "leader-only",
  spreadsheetChangeSets: "historical-by-value",
  spreadsheets: "identity-free",
  spreadsheetSnapshots: "identity-free",
  templates: "live-traversal",
  templateStages: "identity-free",
  templateVersions: "historical-by-value",
  threadParts: "live-traversal",
  threads: "identity-free",
  users: "identity-free",
  variables: "live-traversal",
  workspaceRevisions: "transient-navigation",
  workspaceSnapshots: "transient-navigation"
} as const satisfies Record<TableName, ExternalReferencePolicy>;

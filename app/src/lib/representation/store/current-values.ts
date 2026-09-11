import {
  isStoredAgentActivity,
  isStoredAgentTask,
  isStoredAutomation,
  isStoredPersona
} from "$representation/data/behavior/agents/stored-rows";
import {
  isStoredThread,
  isStoredThreadPart
} from "$representation/data/behavior/agents/stored-thread";
import {
  isStoredComment,
  isStoredCommentThread
} from "$representation/data/behavior/collaboration/stored-comments";
import { isStoredVariable } from "$representation/data/behavior/content/stored-variable";
import { isStoredResourceSetRow } from "$representation/data/behavior/core/resource-set-rows";
import {
  isStoredMembership,
  isStoredProject,
  isStoredUser
} from "$representation/data/behavior/core/stored-project";
import {
  isStoredDocument,
  isStoredDocumentChangeSet,
  isStoredDocumentSnapshot
} from "$representation/data/behavior/documents/stored-rows";
import { isStoredConnector } from "$representation/data/behavior/external/stored-connector";
import { isStoredExternalFile } from "$representation/data/behavior/external/stored-row";
import {
  isStoredHypothesis,
  isStoredQuestion
} from "$representation/data/behavior/investigation/stored-inquiry";
import {
  isStoredResearchThread,
  isStoredResearchTurn
} from "$representation/data/behavior/investigation/stored-rows";
import { isStoredFinding } from "$representation/data/behavior/project-resources/stored";
import {
  isStoredDerivedOutput,
  isStoredDerivedOutputRefreshJob
} from "$representation/data/behavior/semantic/stored-derived-output";
import {
  isStoredSemanticIndex,
  isStoredSemanticIndexNode
} from "$representation/data/behavior/semantic/stored-index";
import {
  isStoredSemanticMaterial,
  isStoredSemanticMaterialHistory,
  isStoredSemanticMaterialPlacement
} from "$representation/data/behavior/semantic/stored-materials";
import {
  isStoredSemanticObject,
  isStoredSemanticObjectHistory
} from "$representation/data/behavior/semantic/stored-objects";
import {
  isStoredSemanticMaterialJob,
  isStoredSemanticOverlay,
  isStoredSemanticSource,
  isStoredSemanticSyncJob
} from "$representation/data/behavior/semantic/stored-state";
import {
  isStoredPresentation,
  isStoredPresentationChangeSet,
  isStoredPresentationSnapshot
} from "$representation/data/behavior/presentations/stored-rows";
import { isStoredSheetCell } from "$representation/data/behavior/spreadsheets/stored-cell";
import {
  isStoredDataBackReference,
  isStoredFormula
} from "$representation/data/behavior/spreadsheets/stored-formula";
import {
  isStoredSpreadsheet,
  isStoredSpreadsheetChangeSet,
  isStoredSpreadsheetSnapshotRow
} from "$representation/data/behavior/spreadsheets/stored-rows";
import {
  isStoredTemplate,
  isStoredTemplateVersion
} from "$representation/data/behavior/templates/stored-rows";
import { isStoredTemplateStage } from "$representation/data/behavior/templates/stored-stage";
import {
  isStoredWorkspaceRevision,
  isStoredWorkspaceSnapshot
} from "$representation/data/behavior/workspace/stored-rows";
import type { TableName } from "$representation/store/tables";

type CurrentRowValueValidator = (value: unknown) => boolean;

/** Every Store table has one representation-owned, recursive current-row predicate. */
export const CURRENT_ROW_VALUE_VALIDATORS = {
  activity: isStoredAgentActivity,
  agentTasks: isStoredAgentTask,
  automations: isStoredAutomation,
  comments: isStoredComment,
  commentThreads: isStoredCommentThread,
  connectors: isStoredConnector,
  dataBackReferences: isStoredDataBackReference,
  derivedOutputRefreshJobs: isStoredDerivedOutputRefreshJob,
  derivedOutputs: isStoredDerivedOutput,
  documentChangeSets: isStoredDocumentChangeSet,
  documents: isStoredDocument,
  documentSnapshots: isStoredDocumentSnapshot,
  externalFiles: isStoredExternalFile,
  findings: isStoredFinding,
  formulas: isStoredFormula,
  hypotheses: isStoredHypothesis,
  memberships: isStoredMembership,
  personas: isStoredPersona,
  projects: isStoredProject,
  questions: isStoredQuestion,
  researchThreads: isStoredResearchThread,
  researchTurns: isStoredResearchTurn,
  resourceSets: isStoredResourceSetRow,
  semanticIndexes: isStoredSemanticIndex,
  semanticIndexNodes: isStoredSemanticIndexNode,
  semanticMaterialHistory: isStoredSemanticMaterialHistory,
  semanticMaterialJobs: isStoredSemanticMaterialJob,
  semanticMaterialPlacements: isStoredSemanticMaterialPlacement,
  semanticMaterials: isStoredSemanticMaterial,
  semanticObjectHistory: isStoredSemanticObjectHistory,
  semanticObjects: isStoredSemanticObject,
  semanticOverlays: isStoredSemanticOverlay,
  semanticSources: isStoredSemanticSource,
  semanticSyncJobs: isStoredSemanticSyncJob,
  sheetCells: isStoredSheetCell,
  presentationChangeSets: isStoredPresentationChangeSet,
  presentations: isStoredPresentation,
  presentationSnapshots: isStoredPresentationSnapshot,
  spreadsheetChangeSets: isStoredSpreadsheetChangeSet,
  spreadsheets: isStoredSpreadsheet,
  spreadsheetSnapshots: isStoredSpreadsheetSnapshotRow,
  templates: isStoredTemplate,
  templateStages: isStoredTemplateStage,
  templateVersions: isStoredTemplateVersion,
  threadParts: isStoredThreadPart,
  threads: isStoredThread,
  users: isStoredUser,
  variables: isStoredVariable,
  workspaceRevisions: isStoredWorkspaceRevision,
  workspaceSnapshots: isStoredWorkspaceSnapshot
} satisfies Record<TableName, CurrentRowValueValidator>;

/** Applies the recursive current-value contract for the named table. */
export const hasCurrentRowValues = (table: TableName, value: unknown): boolean =>
  CURRENT_ROW_VALUE_VALIDATORS[table](value);

import type { Row } from "$representation/data/types/core/id";
import type {
  AgentTaskFields,
  AutomationFields,
  PersonaFields,
  ThreadFields,
  ThreadPartFields
} from "$representation/store/tables/agents";
import type {
  ActivityFields,
  CommentFields,
  CommentThreadFields
} from "$representation/store/tables/collaboration";
import type {
  DataBackReferenceFields,
  FormulaFields,
  VariableFields
} from "$representation/store/tables/data";
import type {
  DocumentChangeSetFields,
  DocumentFields,
  DocumentSnapshotFields,
  SheetCellFields,
  PresentationChangeSetFields,
  PresentationFields,
  PresentationSnapshotFields,
  SpreadsheetChangeSetFields,
  SpreadsheetFields,
  SpreadsheetSnapshotFields
} from "$representation/store/tables/editors";
import type {
  ConnectorFields,
  ExternalFileFields,
  MembershipFields,
  ProjectFields,
  UserFields
} from "$representation/store/tables/foundations";
import type {
  FindingFields,
  HypothesisFields,
  QuestionFields,
  ResearchThreadFields,
  ResearchTurnFields
} from "$representation/store/tables/investigation";
import type { TableName } from "$representation/store/tables/names";
import type {
  DerivedOutputFields,
  DerivedOutputRefreshJobFields,
  SemanticIndexFields,
  SemanticIndexNodeFields,
  SemanticMaterialFields,
  SemanticMaterialHistoryFields,
  SemanticMaterialJobFields,
  SemanticMaterialPlacementFields,
  SemanticObjectFields,
  SemanticObjectHistoryFields,
  SemanticOverlayFields,
  SemanticSourceFields,
  SemanticSyncJobFields
} from "$representation/store/tables/semantic";
import type {
  ResourceSetFields,
  TemplateFields,
  TemplateStageFields,
  TemplateVersionFields
} from "$representation/store/tables/templates";
import type {
  WorkspaceRevisionFields,
  WorkspaceSnapshotFields
} from "$representation/store/tables/workspace";

export type TableFields = {
  activity: ActivityFields;
  agentTasks: AgentTaskFields;
  automations: AutomationFields;
  comments: CommentFields;
  commentThreads: CommentThreadFields;
  connectors: ConnectorFields;
  dataBackReferences: DataBackReferenceFields;
  derivedOutputRefreshJobs: DerivedOutputRefreshJobFields;
  derivedOutputs: DerivedOutputFields;
  documentChangeSets: DocumentChangeSetFields;
  documents: DocumentFields;
  documentSnapshots: DocumentSnapshotFields;
  externalFiles: ExternalFileFields;
  findings: FindingFields;
  formulas: FormulaFields;
  hypotheses: HypothesisFields;
  memberships: MembershipFields;
  personas: PersonaFields;
  projects: ProjectFields;
  questions: QuestionFields;
  researchThreads: ResearchThreadFields;
  researchTurns: ResearchTurnFields;
  resourceSets: ResourceSetFields;
  semanticIndexes: SemanticIndexFields;
  semanticIndexNodes: SemanticIndexNodeFields;
  semanticMaterialHistory: SemanticMaterialHistoryFields;
  semanticMaterialJobs: SemanticMaterialJobFields;
  semanticMaterialPlacements: SemanticMaterialPlacementFields;
  semanticMaterials: SemanticMaterialFields;
  semanticObjectHistory: SemanticObjectHistoryFields;
  semanticObjects: SemanticObjectFields;
  semanticOverlays: SemanticOverlayFields;
  semanticSources: SemanticSourceFields;
  semanticSyncJobs: SemanticSyncJobFields;
  sheetCells: SheetCellFields;
  presentationChangeSets: PresentationChangeSetFields;
  presentations: PresentationFields;
  presentationSnapshots: PresentationSnapshotFields;
  spreadsheetChangeSets: SpreadsheetChangeSetFields;
  spreadsheets: SpreadsheetFields;
  spreadsheetSnapshots: SpreadsheetSnapshotFields;
  templates: TemplateFields;
  templateStages: TemplateStageFields;
  templateVersions: TemplateVersionFields;
  threadParts: ThreadPartFields;
  threads: ThreadFields;
  users: UserFields;
  variables: VariableFields;
  workspaceRevisions: WorkspaceRevisionFields;
  workspaceSnapshots: WorkspaceSnapshotFields;
};

export type TableRow<T extends TableName> = Row<T> & TableFields[T];

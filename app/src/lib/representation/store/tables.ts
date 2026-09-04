import type { AgentTaskStatus, TaskPrompt } from "$representation/data/types/agents/agent-task";
import type { Message } from "$representation/data/types/agents/message";
import type { Cast, PersonaAvatar, PersonaDefinition } from "$representation/data/types/agents/persona";
import type { BranchPoint, ThreadKind } from "$representation/data/types/agents/thread";
import type { ActivityTarget } from "$representation/data/types/collaboration/activity";
import type { AnchorWithin, Resolution } from "$representation/data/types/collaboration/anchor";
import type { BlockFormat } from "$representation/data/types/content/block-format";
import type { ContentBlock, Mark, MarkLink } from "$representation/data/types/content/content-block";
import type { CellRef } from "$representation/data/types/content/formula-value";
import type { VariableValue } from "$representation/data/types/content/variable-value";
import type { MembershipRole } from "$representation/data/types/core/access";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { BackReferenceTargetKind } from "$representation/data/types/data/back-reference";
import type { FormulaUse } from "$representation/data/types/data/formula-use";
import type {
  ConnectorConfiguration,
  ConnectorCredential,
} from "$representation/data/types/external/connector";
import type { ExternalFileOrigin } from "$representation/data/types/external/file";
import type { FindingSource } from "$representation/data/types/investigation/finding";
import type {
  HypothesisAssessment,
  HypothesisEvidence
} from "$representation/data/types/investigation/hypothesis";
import type { QuestionStatus, RelatedItem } from "$representation/data/types/investigation/question";
import type { ResearchMode } from "$representation/data/types/investigation/research-thread";
import type { DerivedState, SemanticCitation } from "$representation/data/types/semantic/derived-output";
import type {
  RecursiveIndexConfiguration,
  SemanticIndexChildren
} from "$representation/data/types/semantic/index";
import type {
  EmbeddingSpace,
  SemanticObjectSnapshot,
  SemanticSpan
} from "$representation/data/types/semantic/overlay";
import type { SemanticEncoding } from "$representation/data/types/semantic/source";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type {
  DocumentChangeTier,
  DocumentSnapshotRole
} from "$representation/data/types/documents/snapshot";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type {
  SlideDeckChangeTier,
  SlideDeckSnapshotRole
} from "$representation/data/types/slide-decks/snapshot";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type {
  SpreadsheetChangeTier,
  SpreadsheetSnapshotRole
} from "$representation/data/types/spreadsheets/snapshot";
import type {
  TemplateBody,
  TemplateVariable
} from "$representation/data/types/templates/template";
import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { TabId, TabRecord, TabView } from "$representation/data/types/workspace/tab";

export type UserFields = {
  authSubject: string;
  displayName: string;
  email?: string;
  imageUrl?: string;
  settings: string;
  updatedAt: number;
};
export type User = Row<"users"> & UserFields;

export type ProjectFields = {
  name: string;
  description?: string;
  archivedAt?: number;
  revision: number;
  settings: string;
  updatedAt: number;
};
export type Project = Row<"projects"> & ProjectFields;

export type MembershipFields = {
  userId: Id<"users">;
  projectId: Id<"projects">;
  token: string;
  role: MembershipRole;
};
export type Membership = Row<"memberships"> & MembershipFields;

export type DocumentSnapshotFields = {
  projectId: Id<"projects">;
  resourceId: Id<"documents">;
  revision: number;
  role: DocumentSnapshotRole;
  part: number;
  body: DocumentBody;
  at: number;
};
export type DocumentSnapshot = Row<"documentSnapshots"> & DocumentSnapshotFields;

export type DocumentChangeSetFields = {
  projectId: Id<"projects">;
  resourceId: Id<"documents">;
  revision: number;
  baseRevision: number;
  tier: DocumentChangeTier;
  ops: DocumentOp[];
  touched: string[];
  actor: Actor;
  at: number;
};
export type DocumentChangeSet = Row<"documentChangeSets"> & DocumentChangeSetFields;

export type SlideDeckSnapshotFields = {
  projectId: Id<"projects">;
  resourceId: Id<"slideDecks">;
  revision: number;
  role: SlideDeckSnapshotRole;
  part: number;
  body: SlideDeckBody;
  at: number;
};
export type SlideDeckSnapshot = Row<"slideDeckSnapshots"> & SlideDeckSnapshotFields;

export type SlideDeckChangeSetFields = {
  projectId: Id<"projects">;
  resourceId: Id<"slideDecks">;
  revision: number;
  baseRevision: number;
  tier: SlideDeckChangeTier;
  ops: SlideDeckOp[];
  touched: string[];
  actor: Actor;
  at: number;
};
export type SlideDeckChangeSet = Row<"slideDeckChangeSets"> & SlideDeckChangeSetFields;

export type SpreadsheetSnapshotFields = {
  projectId: Id<"projects">;
  resourceId: Id<"spreadsheets">;
  revision: number;
  role: SpreadsheetSnapshotRole;
  part: number;
  body: SpreadsheetBody;
  at: number;
};
export type SpreadsheetSnapshot = Row<"spreadsheetSnapshots"> & SpreadsheetSnapshotFields;

export type SpreadsheetChangeSetFields = {
  projectId: Id<"projects">;
  resourceId: Id<"spreadsheets">;
  revision: number;
  baseRevision: number;
  tier: SpreadsheetChangeTier;
  ops: SpreadsheetOp[];
  touched: string[];
  actor: Actor;
  at: number;
};
export type SpreadsheetChangeSet = Row<"spreadsheetChangeSets"> & SpreadsheetChangeSetFields;

export type DocumentFields = {
  projectId: Id<"projects">;
  title: string;
  templateId?: Id<"templates">;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
};
export type Document = Row<"documents"> & DocumentFields;

export type SlideDeckFields = {
  projectId: Id<"projects">;
  title: string;
  templateId?: Id<"templates">;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
};
export type SlideDeck = Row<"slideDecks"> & SlideDeckFields;

export type SpreadsheetFields = {
  projectId: Id<"projects">;
  title: string;
  templateId?: Id<"templates">;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
};
export type Spreadsheet = Row<"spreadsheets"> & SpreadsheetFields;

export type SheetCellFields = {
  projectId: Id<"projects">;
  resourceId: Id<"spreadsheets">;
  rowId: string;
  columnId: string;
  rowOrder: number;
  value: VariableValue;
  expression?: string;
  formulaId?: Id<"formulas">;
  marks?: Mark[];
  format?: BlockFormat;
  mergedTo?: CellRef;
  spillTo?: CellRef;
};
export type SheetCell = Row<"sheetCells"> & SheetCellFields;

export type SemanticOverlayFields = {
  projectId: Id<"projects">;
  generation: number;
  embedding: EmbeddingSpace;
  updatedAt: number;
};
export type SemanticOverlay = Row<"semanticOverlays"> & SemanticOverlayFields;

export type SemanticSourceFields = {
  projectId: Id<"projects">;
  ref: ResourceRef;
  revision: number;
  encoding: SemanticEncoding;
  updatedAt: number;
};
export type SemanticSource = Row<"semanticSources"> & SemanticSourceFields;

export type SemanticObjectFields = {
  projectId: Id<"projects">;
  semanticSourceId: Id<"semanticSources">;
  span: SemanticSpan;
  vector: number[];
};
export type SemanticObject = Row<"semanticObjects"> & SemanticObjectFields;

export type SemanticObjectHistoryFields = {
  projectId: Id<"projects">;
  retiredGeneration: number;
  object: SemanticObjectSnapshot;
  retiredAt: number;
};
export type SemanticObjectHistory = Row<"semanticObjectHistory"> & SemanticObjectHistoryFields;

export type SemanticIndexFields = {
  projectId: Id<"projects">;
  semanticOverlayId: Id<"semanticOverlays">;
  method: "recursiveClustering";
  rootNodeIds: Id<"semanticIndexNodes">[];
  configuration: RecursiveIndexConfiguration;
  updatedAt: number;
};
export type SemanticIndex = Row<"semanticIndexes"> & SemanticIndexFields;

export type SemanticIndexNodeFields = {
  projectId: Id<"projects">;
  indexId: Id<"semanticIndexes">;
  parentNodeId?: Id<"semanticIndexNodes">;
  centroidVector: number[];
  children: SemanticIndexChildren;
};
export type SemanticIndexNode = Row<"semanticIndexNodes"> & SemanticIndexNodeFields;

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

export type ThreadFields = {
  projectId: Id<"projects">;
  kind: ThreadKind;
  branchedFrom?: BranchPoint;
};
export type Thread = Row<"threads"> & ThreadFields;

export type ThreadPartFields = {
  projectId: Id<"projects">;
  threadId: Id<"threads">;
  part: number;
  messages: Message[];
};
export type ThreadPart = Row<"threadParts"> & ThreadPartFields;

export type PersonaFields = {
  projectId?: Id<"projects">;
  name: string;
  description?: string;
  definition: PersonaDefinition;
  scope?: ResourceSet;
  cast?: Cast;
  tools: string[];
  avatar?: PersonaAvatar;
  createdBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Persona = Row<"personas"> & PersonaFields;

export type PersonaThreadFields = {
  projectId: Id<"projects">;
  threadId: Id<"threads">;
  personaId: Id<"personas">;
  title: string;
  createdBy: Actor;
  updatedAt: number;
};
export type PersonaThread = Row<"personaThreads"> & PersonaThreadFields;

export type AgentTaskFields = {
  projectId: Id<"projects">;
  threadId: Id<"threads">;
  title: string;
  description?: string;
  personaId?: Id<"personas">;
  prompt: TaskPrompt;
  status: AgentTaskStatus;
  origin: Actor;
  plan?: string;
  data?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  updatedAt: number;
};
export type AgentTask = Row<"agentTasks"> & AgentTaskFields;

export type TemplateFields = {
  userId: Id<"users">;
  name: string;
  description?: string;
  /** Flat library labels. An empty array means the template is untagged. */
  tags: string[];
  body: TemplateBody;
  variables: TemplateVariable[];
  createdBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Template = Row<"templates"> & TemplateFields;

export type TemplateVersionFields = {
  templateId: Id<"templates">;
  revision: number;
  name: string;
  description?: string;
  tags: string[];
  body: TemplateBody;
  variables: TemplateVariable[];
  at: number;
};
export type TemplateVersion = Row<"templateVersions"> & TemplateVersionFields;

export type NamedResourceSetFields = {
  projectId: Id<"projects">;
  name: string;
  description?: string;
  set: ResourceSet;
  createdBy: Actor;
  revision: number;
  updatedAt: number;
};
export type NamedResourceSet = Row<"resourceSets"> & NamedResourceSetFields;

export type ConnectorFields = {
  projectId: Id<"projects">;
  name: string;
  configuration: ConnectorConfiguration;
  credential?: ConnectorCredential;
  refreshIntervalMs?: number;
  createdBy: Actor;
  updatedAt: number;
};
export type Connector = Row<"connectors"> & ConnectorFields;

export type ExternalFileFields = {
  projectId: Id<"projects">;
  name: string;
  mediaType: string;
  storageId: Id<"_storage">;
  hash: string;
  origin: ExternalFileOrigin;
  createdBy: Actor;
  updatedAt: number;
};
export type ExternalFile = Row<"externalFiles"> & ExternalFileFields;

export type FormulaFields = {
  projectId: Id<"projects">;
  representation: string;
  usedBy: FormulaUse[];
  updatedAt: number;
};
export type Formula = Row<"formulas"> & FormulaFields;

export type DataBackReferenceFields = {
  projectId: Id<"projects">;
  formulaId: Id<"formulas">;
  targetKind: BackReferenceTargetKind;
  target: string;
  to?: string;
  updatedAt: number;
};
export type DataBackReference = Row<"dataBackReferences"> & DataBackReferenceFields;

export type VariableFields = {
  projectId: Id<"projects">;
  name: string;
  value: VariableValue;
  createdBy: Actor;
  updatedAt: number;
};
export type Variable = Row<"variables"> & VariableFields;

export type QuestionFields = {
  projectId: Id<"projects">;
  text: string;
  notes: ContentBlock[];
  status: QuestionStatus;
  relatedTo: RelatedItem[];
  researchThreadIds: Id<"researchThreads">[];
  parentId?: Id<"questions">;
  createdBy: Actor;
  updatedBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Question = Row<"questions"> & QuestionFields;

export type HypothesisFields = {
  projectId: Id<"projects">;
  statement: string;
  notes: ContentBlock[];
  assessment: HypothesisAssessment;
  confidence?: number;
  evidence: HypothesisEvidence[];
  relatedTo: Id<"questions">[];
  researchThreadIds: Id<"researchThreads">[];
  createdBy: Actor;
  updatedBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Hypothesis = Row<"hypotheses"> & HypothesisFields;

export type FindingFields = {
  projectId: Id<"projects">;
  title: string;
  body: ContentBlock[];
  sources: FindingSource[];
  evidenceFor: Id<"hypotheses">[];
  relatedTo: Id<"questions">[];
  researchThreadIds: Id<"researchThreads">[];
  createdBy: Actor;
  updatedBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Finding = Row<"findings"> & FindingFields;

export type ResearchThreadFields = {
  projectId: Id<"projects">;
  threadId: Id<"threads">;
  title: string;
  mode: ResearchMode;
  findingIds: Id<"findings">[];
  createdBy: Actor;
  updatedAt: number;
};
export type ResearchThread = Row<"researchThreads"> & ResearchThreadFields;

export type CommentThreadFields = {
  projectId: Id<"projects">;
  target: ResourceRef;
  within?: AnchorWithin;
  quote?: string;
  resolution?: Resolution;
  createdBy: Actor;
  updatedAt: number;
};
export type CommentThread = Row<"commentThreads"> & CommentThreadFields;

export type CommentFields = {
  projectId: Id<"projects">;
  threadId: Id<"commentThreads">;
  blocks: ContentBlock[];
  mentions: MarkLink[];
  author: Actor;
  editedAt?: number;
};
export type Comment = Row<"comments"> & CommentFields;

export type ActivityFields = {
  projectId: Id<"projects">;
  actor: Actor;
  actorLabel: string;
  verb: string;
  target: ActivityTarget;
  context?: ActivityTarget;
  detail?: string;
};
export type Activity = Row<"activity"> & ActivityFields;

export type WorkspaceSnapshotFields = {
  projectId: Id<"projects">;
  userId: Id<"users">;
  revision: number;
  tabs: TabRecord[];
  activeId: TabId;
  views: Record<TabId, TabView>;
  at: number;
};
export type WorkspaceSnapshot = Row<"workspaceSnapshots"> & WorkspaceSnapshotFields;

export type WorkspaceRevisionFields = {
  projectId: Id<"projects">;
  userId: Id<"users">;
  revision: number;
  baseRevision: number;
  ops: WorkspaceOp[];
  at: number;
};
export type WorkspaceRevision = Row<"workspaceRevisions"> & WorkspaceRevisionFields;

export const TABLE_NAMES = [
  "activity",
  "agentTasks",
  "comments",
  "commentThreads",
  "connectors",
  "dataBackReferences",
  "derivedOutputs",
  "documentChangeSets",
  "documents",
  "documentSnapshots",
  "externalFiles",
  "findings",
  "formulas",
  "hypotheses",
  "memberships",
  "personas",
  "personaThreads",
  "projects",
  "questions",
  "researchThreads",
  "resourceSets",
  "semanticIndexes",
  "semanticIndexNodes",
  "semanticObjectHistory",
  "semanticObjects",
  "semanticOverlays",
  "semanticSources",
  "sheetCells",
  "slideDeckChangeSets",
  "slideDecks",
  "slideDeckSnapshots",
  "spreadsheetChangeSets",
  "spreadsheets",
  "spreadsheetSnapshots",
  "templates",
  "templateVersions",
  "threadParts",
  "threads",
  "users",
  "variables",
  "workspaceRevisions",
  "workspaceSnapshots"
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

export type TableFields = {
  activity: ActivityFields;
  agentTasks: AgentTaskFields;
  comments: CommentFields;
  commentThreads: CommentThreadFields;
  connectors: ConnectorFields;
  dataBackReferences: DataBackReferenceFields;
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
  personaThreads: PersonaThreadFields;
  projects: ProjectFields;
  questions: QuestionFields;
  researchThreads: ResearchThreadFields;
  resourceSets: NamedResourceSetFields;
  semanticIndexes: SemanticIndexFields;
  semanticIndexNodes: SemanticIndexNodeFields;
  semanticObjectHistory: SemanticObjectHistoryFields;
  semanticObjects: SemanticObjectFields;
  semanticOverlays: SemanticOverlayFields;
  semanticSources: SemanticSourceFields;
  sheetCells: SheetCellFields;
  slideDeckChangeSets: SlideDeckChangeSetFields;
  slideDecks: SlideDeckFields;
  slideDeckSnapshots: SlideDeckSnapshotFields;
  spreadsheetChangeSets: SpreadsheetChangeSetFields;
  spreadsheets: SpreadsheetFields;
  spreadsheetSnapshots: SpreadsheetSnapshotFields;
  templates: TemplateFields;
  templateVersions: TemplateVersionFields;
  threadParts: ThreadPartFields;
  threads: ThreadFields;
  users: UserFields;
  variables: VariableFields;
  workspaceRevisions: WorkspaceRevisionFields;
  workspaceSnapshots: WorkspaceSnapshotFields;
};

export type TableRow<T extends TableName> = Row<T> & TableFields[T];

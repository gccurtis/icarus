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
  ConnectionStatus,
  ConnectorCredential,
  ConnectorProvider,
  ConnectorStatus
} from "$representation/data/types/external/connector";
import type {
  Dimensions,
  FileOrigin,
  FileSubkind,
  Readability
} from "$representation/data/types/external/file";
import type { FindingSource } from "$representation/data/types/investigation/finding";
import type {
  HypothesisAssessment,
  HypothesisEvidence
} from "$representation/data/types/investigation/hypothesis";
import type { QuestionStatus, RelatedItem } from "$representation/data/types/investigation/question";
import type { ResearchMode } from "$representation/data/types/investigation/research-thread";
import type { DerivedEvidence, DerivedState } from "$representation/data/types/knowledge/derived-output";
import type {
  LatticeBinding,
  LatticeCause,
  LatticeCluster,
  LatticeClusterState,
  LatticeRemoval,
  LatticeWindow
} from "$representation/data/types/knowledge/lattice";
import type { ResourceBody } from "$representation/data/types/resources/resource-body";
import type { AspectRatio } from "$representation/data/types/resources/slide-deck-body";
import type { GeneralResourceType, Op } from "$representation/data/types/revisions/change";
import type { ChangeTier, SnapshotRole } from "$representation/data/types/revisions/snapshot";
import type {
  TemplateBody,
  TemplateKind,
  TemplateVariable
} from "$representation/data/types/templates/template";

// ── access ────────────────────────────────────────────────────────────────

/** A person. Looked up by `authSubject` — an email is a display value that changes. */
export type UserFields = {
  authSubject: string;
  displayName: string;
  email?: string;
  imageUrl?: string;
  /** JSON. A setting value is recursive and its keys are the author's. */
  settings: string;
  updatedAt: number;
};
export type User = Row<"users"> & UserFields;

/** A project. Everything else is scoped to one. `revision` catches a stale form. */
export type ProjectFields = {
  name: string;
  description?: string;
  /** Hides without destroying. Deletion is a real delete. */
  archivedAt?: number;
  revision: number;
  settings: string;
  lattice?: LatticeBinding;
  updatedAt: number;
};
export type Project = Row<"projects"> & ProjectFields;

/**
 * One person's access to one project. A token resolves only within its own
 * user's memberships, so a copied URL finds nothing — the lookup is the
 * authorization. One membership per `(user, project)`; nothing enforces it.
 */
export type MembershipFields = {
  userId: Id<"users">;
  projectId: Id<"projects">;
  token: string;
  role: MembershipRole;
};
export type Membership = Row<"memberships"> & MembershipFields;

// ── revisions ─────────────────────────────────────────────────────────────

/**
 * A materialized body at a revision. `(generalResourceType, resourceId)` is the
 * whole key — two resources of different kinds may carry the same id.
 * `resourceId` is a plain string so the machinery never branches on type.
 */
export type ResourceSnapshotFields = {
  projectId: Id<"projects">;
  generalResourceType: GeneralResourceType;
  resourceId: string;
  revision: number;
  role: SnapshotRole;
  part: number;
  body: ResourceBody;
  at: number;
};
export type ResourceSnapshot = Row<"resourceSnapshots"> & ResourceSnapshotFields;

/**
 * One accepted mutation. `touched` holds the deepest thing each op addresses,
 * never its ancestors — including them would report a collision on every shared
 * container.
 */
export type ChangeSetFields = {
  projectId: Id<"projects">;
  generalResourceType: GeneralResourceType;
  resourceId: string;
  revision: number;
  /** What its author was looking at. */
  baseRevision: number;
  tier: ChangeTier;
  ops: Op[];
  touched: string[];
  actor: Actor;
  at: number;
};
export type ChangeSet = Row<"changeSets"> & ChangeSetFields;

// ── general resources ─────────────────────────────────────────────────────

/**
 * A document's metadata and nothing else — what a list, a tab, and a search
 * result render from. The content is in `resourceSnapshots`.
 *
 * `templateId` is provenance only: a resource is a full copy at creation.
 */
export type DocumentFields = {
  projectId: Id<"projects">;
  title: string;
  templateId?: Id<"templates">;
  createdBy: Actor;
  updatedBy: Actor;
  updatedAt: number;
};
export type Document = Row<"documents"> & DocumentFields;

/** The same row, plus the one field a deck needs before its body is opened. */
export type SlideDeckFields = DocumentFields & { aspectRatio: AspectRatio };
export type SlideDeck = Row<"slideDecks"> & SlideDeckFields;

/** The same row again. Its grid shape is a snapshot; its cells are `sheetCells`. */
export type SpreadsheetFields = DocumentFields;
export type Spreadsheet = Row<"spreadsheets"> & SpreadsheetFields;

/**
 * One populated cell. An empty cell is the absence of a row.
 *
 * `rowOrder` is the row's sort key copied here — the only thing a viewport read
 * can range over. Inserting a row invents a value between its neighbours and
 * touches no cell; only moving a row rewrites this.
 *
 * A cell holds one `VariableValue` rather than a kind beside an optional value,
 * so there is no pair that can disagree about what the cell is. No blocks: a
 * cell is one value, not prose with formula spans in it.
 */
export type SheetCellFields = {
  projectId: Id<"projects">;
  resourceId: Id<"spreadsheets">;
  rowId: string;
  columnId: string;
  rowOrder: number;
  value: VariableValue;
  /** The expression as authored, when the cell computes. */
  expression?: string;
  formulaId?: Id<"formulas">;
  marks?: Mark[];
  /** An override on this cell alone. Regions live in the body. */
  format?: BlockFormat;
  /** Far corners. What lies between them is whatever currently lies between them. */
  mergedTo?: CellRef;
  spillTo?: CellRef;
};
export type SheetCell = Row<"sheetCells"> & SheetCellFields;

// ── knowledge ─────────────────────────────────────────────────────────────

/**
 * A window of one source, or a cluster of the nodes below it — one shape,
 * because there is one id space. A node's content is immutable: identity is the
 * hash of its source and text, or of its sorted members.
 */
export type LatticeNodeFields = {
  projectId: Id<"projects">;
  level: number;
  /** `clusters.length > 0`, stored because it is a read key. */
  clustered: boolean;
  /** Every cluster this node belongs to. Plural, because cliques overlap. */
  clusters: Id<"latticeNodes">[];
  /** The embedding. For a cluster, the mean of its members'. */
  vector: number[];
  window?: LatticeWindow;
  cluster?: LatticeCluster;
  updatedAt: number;
};
export type LatticeNode = Row<"latticeNodes"> & LatticeNodeFields;

/**
 * One pair of nodes and how strongly they relate. No generation or level: a
 * weight is a function of two vectors and a node's content is immutable.
 */
export type LatticeEdgeFields = {
  projectId: Id<"projects">;
  fromId: Id<"latticeNodes">;
  toId: Id<"latticeNodes">;
  weight: number;
};
export type LatticeEdge = Row<"latticeEdges"> & LatticeEdgeFields;

/**
 * What has already been read out of each source. It holds no node ids — the
 * nodes name their source. `revision` is a string because sources revision
 * differently and nothing compares them for order.
 */
export type LatticeSourceFields = {
  projectId: Id<"projects">;
  sourceKind: string;
  sourceId: string;
  revision: string;
  ingestedAt: number;
};
export type LatticeSource = Row<"latticeSources"> & LatticeSourceFields;

/** What one clustering pass did, in enough detail to undo it. */
export type LatticeChangeFields = {
  projectId: Id<"projects">;
  cause: LatticeCause;
  added: Id<"latticeNodes">[];
  /** The previous values of clusters patched in place. */
  changed: LatticeClusterState[];
  removed: LatticeRemoval[];
};
export type LatticeChange = Row<"latticeChanges"> & LatticeChangeFields;

/**
 * Generated content that stays connected to what it was generated from.
 * `response` is one block, because an output fills a position and a position
 * holds one block.
 *
 * Three lists, three jobs: what the prompt asked, what came back, what the
 * answer rests on. None is derivable from the others.
 */
export type DerivedOutputFields = {
  projectId: Id<"projects">;
  /** The whole instruction, and the only copy of it. */
  prompt: string;
  /** Absent means the whole project. */
  scope?: ResourceSet;
  queries: string[];
  retrieved: Id<"latticeNodes">[];
  evidence: DerivedEvidence[];
  response: ContentBlock;
  state: DerivedState;
  error?: string;
  /** `updatedAt` moves for a failed attempt; this does not. */
  refreshedAt?: number;
  createdBy: Actor;
  updatedAt: number;
};
export type DerivedOutput = Row<"derivedOutputs"> & DerivedOutputFields;

// ── conversations ─────────────────────────────────────────────────────────

/**
 * A conversation's identity, and almost nothing else. Three tables own a
 * conversation and none stores one — each carries a `threadId` into here.
 *
 * `branchedFrom` lives here because branching is a property of the conversation
 * rather than of the thing that owns it. Title and recency stay on the owner.
 */
export type ThreadFields = {
  projectId: Id<"projects">;
  kind: ThreadKind;
  branchedFrom?: BranchPoint;
};
export type Thread = Row<"threads"> & ThreadFields;

/**
 * A slice of one conversation; `messages` concatenates in part order. A thread
 * with no messages has no parts. Nothing but messages is here, so a part carries
 * no field that could disagree with the part beside it.
 */
export type ThreadPartFields = {
  projectId: Id<"projects">;
  threadId: Id<"threads">;
  part: number;
  messages: Message[];
};
export type ThreadPart = Row<"threadParts"> & ThreadPartFields;

/**
 * A reusable agent identity. `projectId` is optional, and this is the only table
 * where that is true: a built-in persona belongs to no project.
 *
 * `tools` is names, not grants — absence from the list is the whole restriction.
 */
export type PersonaFields = {
  projectId?: Id<"projects">;
  /** The mention handle and the attribution label. Trimmed, never empty. */
  name: string;
  description?: string;
  definition: PersonaDefinition;
  /** Retrievable material. Never rendered into a prompt. */
  scope?: ResourceSet;
  cast?: Cast;
  tools: string[];
  avatar?: PersonaAvatar;
  createdBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Persona = Row<"personas"> & PersonaFields;

/**
 * A chat with a persona. Separate from a task because a task has a lifecycle and
 * can be an actor other rows attribute work to.
 */
export type PersonaThreadFields = {
  projectId: Id<"projects">;
  threadId: Id<"threads">;
  personaId: Id<"personas">;
  title: string;
  createdBy: Actor;
  updatedAt: number;
};
export type PersonaThread = Row<"personaThreads"> & PersonaThreadFields;

/**
 * One unit of work handed to an agent. The conversation is `threadId`; what is
 * here is the lifecycle.
 *
 * No `result`: a task's output is messages, and one that is the outcome carries
 * a label. `plan` and `data` are JSON strings for now.
 */
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
  /** Whatever else the agent persists across turns. Opaque here. */
  data?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
  updatedAt: number;
};
export type AgentTask = Row<"agentTasks"> & AgentTaskFields;

// ── templates ─────────────────────────────────────────────────────────────

/**
 * A resource you can make more of. Belongs to a person, not a project — it is
 * carried into whichever project wants another like it.
 *
 * The body is on the row: a template is not collaboratively edited and no change
 * set addresses it. `revision` keeps two editors from overwriting each other.
 * `userId` is the owner; `createdBy` is beside it because an agent can make one.
 */
export type TemplateFields = {
  userId: Id<"users">;
  kind: TemplateKind;
  /** Trimmed and never empty — a template is only reached by picking it from a list. */
  name: string;
  description?: string;
  body: TemplateBody;
  variables: TemplateVariable[];
  createdBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Template = Row<"templates"> & TemplateFields;

/**
 * What a template was, one row per edit. A complete restorable state, so undo is
 * a read and a write. `kind` and `userId` are absent because neither can change.
 */
export type TemplateVersionFields = {
  templateId: Id<"templates">;
  /** The revision this state *was*, not the one that replaced it. */
  revision: number;
  name: string;
  description?: string;
  body: TemplateBody;
  variables: TemplateVariable[];
  at: number;
};
export type TemplateVersion = Row<"templateVersions"> & TemplateVersionFields;

// ── resource sets ─────────────────────────────────────────────────────────

/**
 * A named group of resources. Stored as the rule that selects its members, never
 * as the members: a list would mean "the project as it was".
 *
 * The name is required — a cycle refused at resolve time has to name the set
 * that closed the loop.
 */
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

// ── external material ─────────────────────────────────────────────────────

/**
 * An authorized account at a provider, and what it watches there. `selection`
 * and `cursor` are opaque strings — nothing queries inside either.
 */
export type ConnectorFields = {
  projectId: Id<"projects">;
  provider: ConnectorProvider;
  /** Which account at that provider — two SharePoints can coexist. */
  account: string;
  name: string;
  /** JSON: which subtree is watched. */
  selection: string;
  /** The provider's delta token. */
  cursor?: string;
  status: ConnectorStatus;
  lastSyncedAt?: number;
  error?: string;
  /** Absent before authorization completes, and after it is revoked. */
  credential?: ConnectorCredential;
  createdBy: Actor;
  updatedAt: number;
};
export type Connector = Row<"connectors"> & ConnectorFields;

/**
 * One remote file, described but not held — the line against an external file.
 *
 * No `createdBy`: a connection is always created by its connector. A change is a
 * `revision` bump, never a new row, because there are no old bytes to keep.
 * `subkind` only, because every row here is a `connection`.
 */
export type ConnectionFields = {
  projectId: Id<"projects">;
  connectorId: Id<"connectors">;
  /** The provider's own id — what a re-sync matches on. */
  externalId: string;
  /** Where a person opens it. */
  externalUrl?: string;
  /** What a citation shows. */
  name: string;
  subkind: FileSubkind;
  size?: number;
  revision: string;
  status: ConnectionStatus;
  error?: string;
  updatedAt: number;
};
export type Connection = Row<"connections"> & ConnectionFields;

/**
 * A file this project holds. Holding the bytes is what this table means.
 *
 * No revision and no status: bytes are immutable, so a new version is a new row
 * with `supersedes`, and the old one stays readable for every reference already
 * made to it. One row, one blob — an image is reduced on the way in and the
 * reduction is what is kept.
 *
 * The text is not here; the lattice holds it as windows. What is left is whether
 * there were ever words to get.
 */
export type ExternalFileFields = {
  projectId: Id<"projects">;
  /** The one copy: what is stored, and what is served. */
  storageId: Id<"_storage">;
  name: string;
  size: number;
  subkind: FileSubkind;
  origin: FileOrigin;
  /** The file this one replaces. */
  supersedes?: Id<"externalFiles">;
  pageCount?: number;
  dimensions?: Dimensions;
  readable: Readability;
  createdBy: Actor;
  updatedAt: number;
};
export type ExternalFile = Row<"externalFiles"> & ExternalFileFields;

// ── data ──────────────────────────────────────────────────────────────────

/**
 * One expression, scoped to the project rather than to a resource — prose, a
 * slide, and a cell all compute.
 *
 * `representation` holds positions as ids, never addresses: two corner cell ids
 * need no rewriting when a row is inserted between them. Nothing computed is
 * here, and an expression that does not parse never becomes a row.
 */
export type FormulaFields = {
  projectId: Id<"projects">;
  representation: string;
  /** Where this formula is held. A list, because the key is this row's own id. */
  usedBy: FormulaUse[];
  updatedAt: number;
};
export type Formula = Row<"formulas"> & FormulaFields;

/**
 * One thing a formula names, indexed from the thing's end — the question is
 * "where is this cell used", and a formula is only the answer.
 *
 * A row per reference rather than a list on the formula, because the other
 * direction has no key. A range keeps its corners and nothing between them.
 */
export type DataBackReferenceFields = {
  projectId: Id<"projects">;
  formulaId: Id<"formulas">;
  targetKind: BackReferenceTargetKind;
  /** A qualified cell position, a range's first corner, or a variable's name. */
  target: string;
  /** The other corner. Ranges only. */
  to?: string;
  updatedAt: number;
};
export type DataBackReference = Row<"dataBackReferences"> & DataBackReferenceFields;

/**
 * The project's named values. One name, and it is both what is displayed and
 * what is written — a name carries no spaces, so there is no folded form to keep
 * in step, and names are case-sensitive. Unique within a project; nothing
 * enforces it.
 */
export type VariableFields = {
  projectId: Id<"projects">;
  name: string;
  value: VariableValue;
  createdBy: Actor;
  updatedAt: number;
};
export type Variable = Row<"variables"> & VariableFields;

// ── investigation ─────────────────────────────────────────────────────────

/**
 * The unit of inquiry. `text` is plain and `notes` are blocks — the question is
 * one sentence and the label lists render, while the context is genuinely rich.
 *
 * `relatedTo` is material, not answers. `parentId` rather than a child list,
 * because decomposition is the one relationship here that is not many-to-many.
 */
export type QuestionFields = {
  projectId: Id<"projects">;
  text: string;
  notes: ContentBlock[];
  status: QuestionStatus;
  relatedTo: RelatedItem[];
  researchThreadIds: Id<"researchThreads">[];
  /** One parent, absent at the root. */
  parentId?: Id<"questions">;
  createdBy: Actor;
  updatedBy: Actor;
  revision: number;
  updatedAt: number;
};
export type Question = Row<"questions"> & QuestionFields;

/**
 * A proposed answer, stated so evidence can bear on it. `projectId` is stored
 * directly rather than reached through a question, which keeps an unattached
 * hunch inside every project read.
 *
 * `assessment` is stored, never derived from `evidence`: a count of supporting
 * versus refuting findings is not a judgement.
 */
export type HypothesisFields = {
  projectId: Id<"projects">;
  statement: string;
  notes: ContentBlock[];
  assessment: HypothesisAssessment;
  /** 0–1, and only once there is an assessment to attach it to. */
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

/**
 * Something established, written down with what establishes it.
 *
 * `body` is blocks rather than document rows: a finding has no page and is read
 * inline wherever it is cited. `title` is separate so a list gets a line without
 * loading the writeup. Both back-references are bare ids — the bearing lives on
 * the hypothesis.
 */
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

/**
 * The working conversation. No `status` — it is not a unit of work. No
 * `personaId` — this is a conversation with a fixed job rather than a chosen
 * identity.
 *
 * `findingIds` is the thread's side of the finding edge, since `mode` has no
 * finding variant.
 */
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

// ── collaboration ─────────────────────────────────────────────────────────

/**
 * A conversation attached to a place. The thread owns the anchor and the
 * resolved state; comments are the replies. Absent `resolution` is open.
 *
 * Resolved rather than deleted: a review discussion is often the only record of
 * why something is the way it is. `quote` lets a thread read on its own, and
 * makes a drifted range recognizable as drifted.
 */
export type CommentThreadFields = {
  projectId: Id<"projects">;
  target: ResourceRef;
  /** Absent means the whole thing. */
  within?: AnchorWithin;
  quote?: string;
  resolution?: Resolution;
  createdBy: Actor;
  updatedAt: number;
};
export type CommentThread = Row<"commentThreads"> & CommentThreadFields;

/**
 * One remark. `mentions` is the same set flattened out of the marks, so who a
 * remark addresses is one field rather than a walk over every block.
 *
 * `author` is an actor: an agent leaving remarks is an ordinary thing to want.
 * `editedAt` keeps no prior text.
 */
export type CommentFields = {
  projectId: Id<"projects">;
  threadId: Id<"commentThreads">;
  blocks: ContentBlock[];
  mentions: MarkLink[];
  author: Actor;
  editedAt?: number;
};
export type Comment = Row<"comments"> & CommentFields;

/**
 * What happened in a project, in order. Appended and never touched again — an
 * editable log is not evidence of anything.
 *
 * Labels are frozen in: an entry has to read correctly after its subject is
 * deleted, and it makes a hundred entries one read rather than a hundred
 * lookups. `verb` is open, and nothing branches on it. No `at` — the row is
 * written when its event happens.
 */
export type ActivityFields = {
  projectId: Id<"projects">;
  actor: Actor;
  /** The one place a label is stored rather than resolved. */
  actorLabel: string;
  verb: string;
  target: ActivityTarget;
  /** The containing thing, so a feed narrows without knowing every target kind. */
  context?: ActivityTarget;
  /** A sentence about the event. "14 files", "3 rows removed". */
  detail?: string;
};
export type Activity = Row<"activity"> & ActivityFields;

// ── the store ─────────────────────────────────────────────────────────────

/**
 * Every table, as a value. A door that takes a table name needs this to reject
 * one it does not have — a name is a path segment, so an unchecked one is a way
 * to read and write files outside the data directory.
 */
export const TABLE_NAMES = [
  "activity",
  "agentTasks",
  "changeSets",
  "comments",
  "commentThreads",
  "connections",
  "connectors",
  "dataBackReferences",
  "derivedOutputs",
  "documents",
  "externalFiles",
  "findings",
  "formulas",
  "hypotheses",
  "latticeChanges",
  "latticeEdges",
  "latticeNodes",
  "latticeSources",
  "memberships",
  "personas",
  "personaThreads",
  "projects",
  "questions",
  "researchThreads",
  "resourceSets",
  "resourceSnapshots",
  "sheetCells",
  "slideDecks",
  "spreadsheets",
  "templates",
  "templateVersions",
  "threadParts",
  "threads",
  "users",
  "variables"
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

/**
 * What each table's rows hold. Indexing this with a `TableName` is what keeps a
 * store opened by name typed — and a missing entry fails to compile, so the map
 * and the list above cannot drift.
 */
export type TableFields = {
  activity: ActivityFields;
  agentTasks: AgentTaskFields;
  changeSets: ChangeSetFields;
  comments: CommentFields;
  commentThreads: CommentThreadFields;
  connections: ConnectionFields;
  connectors: ConnectorFields;
  dataBackReferences: DataBackReferenceFields;
  derivedOutputs: DerivedOutputFields;
  documents: DocumentFields;
  externalFiles: ExternalFileFields;
  findings: FindingFields;
  formulas: FormulaFields;
  hypotheses: HypothesisFields;
  latticeChanges: LatticeChangeFields;
  latticeEdges: LatticeEdgeFields;
  latticeNodes: LatticeNodeFields;
  latticeSources: LatticeSourceFields;
  memberships: MembershipFields;
  personas: PersonaFields;
  personaThreads: PersonaThreadFields;
  projects: ProjectFields;
  questions: QuestionFields;
  researchThreads: ResearchThreadFields;
  resourceSets: NamedResourceSetFields;
  resourceSnapshots: ResourceSnapshotFields;
  sheetCells: SheetCellFields;
  slideDecks: SlideDeckFields;
  spreadsheets: SpreadsheetFields;
  templates: TemplateFields;
  templateVersions: TemplateVersionFields;
  threadParts: ThreadPartFields;
  threads: ThreadFields;
  users: UserFields;
  variables: VariableFields;
};

/** One table's stored row, by name. */
export type TableRow<T extends TableName> = Row<T> & TableFields[T];

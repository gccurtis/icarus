/** Central type registry for database adapters and serialization boundaries. */

import type {
  AuthoredResource,
  Document,
  GeneralFile,
  SlideDeck,
  Template,
  Workbook,
} from './authored-resources.js';
import type {
  ActivityFact,
  ChangeFeedEvent,
  Comment,
  CommentThread,
  PresenceLease,
  ProjectProfile,
  WorkspaceState,
} from './collaboration.js';
import type {
  AgentTask,
  AgentTaskMessage,
  AgentTaskRequest,
  AgentTaskRun,
  AgentTaskStep,
  AgentToolCall,
  Automation,
  AutomationRun,
  Job,
  Persona,
  TranslationRun,
} from './agent-tasks.js';
import type {
  Analysis,
  AnalysisExecution,
  AnalysisProposal,
  AnalysisResult,
  Finding,
  Hypothesis,
  Question,
  ResearchMessage,
  ResearchProposal,
  ResearchQuery,
  ResearchResult,
  ResearchRun,
  ResearchStep,
  ResearchThread,
  StructuredEntry,
  StructuredRow,
} from './inquiry.js';
import type {
  Context,
  DerivedOutput,
  KnowledgeArtifact,
  KnowledgeLatticeState,
  KnowledgeMembership,
  KnowledgeNode,
  KnowledgeSource,
} from './knowledge.js';
import type { Board, MemoryConsultation, MemoryEntry } from './legacy.js';
import type { RichBlock } from './rich-blocks.js';

export interface PersistedModelMap {
  project: ProjectProfile;
  workspace_state: WorkspaceState;
  activity_fact: ActivityFact;
  comment_thread: CommentThread;
  comment: Comment;
  presence_lease: PresenceLease;
  change_feed_event: ChangeFeedEvent;

  rich_block: RichBlock;
  document: Document;
  slides: SlideDeck;
  spreadsheet: Workbook;
  file: GeneralFile;
  template: Template;

  context: Context;
  knowledge_lattice: KnowledgeLatticeState;
  knowledge_source: KnowledgeSource;
  knowledge_artifact: KnowledgeArtifact;
  knowledge_node: KnowledgeNode;
  knowledge_membership: KnowledgeMembership;
  derived_output: DerivedOutput;

  question: Question;
  hypothesis: Hypothesis;
  finding: Finding;
  research_thread: ResearchThread;
  research_message: ResearchMessage;
  research_run: ResearchRun;
  research_step: ResearchStep;
  research_query: ResearchQuery;
  research_result: ResearchResult;
  research_proposal: ResearchProposal;
  structured_entry: StructuredEntry;
  structured_row: StructuredRow;
  analysis: Analysis;
  analysis_execution: AnalysisExecution;
  analysis_result: AnalysisResult;
  analysis_proposal: AnalysisProposal;

  persona: Persona;
  agent_task: AgentTask;
  agent_task_message: AgentTaskMessage;
  agent_task_run: AgentTaskRun;
  agent_task_step: AgentTaskStep;
  agent_task_request: AgentTaskRequest;
  agent_tool_call: AgentToolCall;
  automation: Automation;
  automation_run: AutomationRun;
  job: Job;
  translation_run: TranslationRun;

  board: Board;
  memory_entry: MemoryEntry;
  memory_consultation: MemoryConsultation;
}

export type PersistedModelKind = keyof PersistedModelMap;
export type PersistedModel<Kind extends PersistedModelKind = PersistedModelKind> =
  PersistedModelMap[Kind];

export type CurrentAuthoredResource = AuthoredResource;

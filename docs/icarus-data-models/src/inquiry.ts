import type {
  ActiveLifecycle,
  AnalysisResultRef,
  ContentSourceRef,
  Diagnostic,
  Digest,
  DomainValue,
  EntityId,
  FailureDetail,
  Frame,
  ISODateTime,
  JsonObject,
  Lifecycle,
  PersistedRecord,
  ProjectId,
  Rank,
  StructuredDataRef,
} from './core.js';
import type { ResolvedContextManifest } from './knowledge.js';
import type { RichBlockRef } from './rich-blocks.js';
import type { ChatMessageContent } from './chat.js';

// ---------------------------------------------------------------------------
// Questions, hypotheses, and findings
// ---------------------------------------------------------------------------

export type QuestionStatus =
  | 'open'
  | 'researching'
  | 'answered'
  | 'monitoring'
  | 'closed';

export interface Question extends PersistedRecord<'question'> {
  question: RichBlockRef<'text'>;
  additionalDetails?: RichBlockRef<'text'>;
  /** Framing statements, not Hypothesis entities. */
  assumptions: RichBlockRef<'text'>[];
  status: QuestionStatus;
  priority: 'low' | 'normal' | 'high' | 'critical';
  currentAnswer?: RichBlockRef<'text'>;
  lifecycle: ActiveLifecycle;
  deletedAt?: ISODateTime;
}

export type HypothesisAssessment =
  | 'proposed'
  | 'testing'
  | 'supported'
  | 'refuted'
  | 'qualified'
  | 'inconclusive';

export interface Hypothesis extends PersistedRecord<'hypothesis'> {
  statement: RichBlockRef<'text'>;
  rationale?: RichBlockRef<'text'>;
  assessment: HypothesisAssessment;
  assessmentNote?: RichBlockRef<'text'>;
  questionIds: EntityId<'question'>[];
  lifecycle: ActiveLifecycle;
  deletedAt?: ISODateTime;
}

export interface FindingSource {
  id: EntityId<'finding_source'>;
  role: 'grounds' | 'derives' | 'method_input';
  ordinal: number;
  reference: ContentSourceRef;
  locator?: JsonObject;
  exactQuote?: string;
  quoteDigest?: Digest;
}

export type FindingTarget =
  | { kind: 'question'; id: EntityId<'question'> }
  | { kind: 'hypothesis'; id: EntityId<'hypothesis'> }
  | { kind: 'analysis'; id: EntityId<'analysis'> }
  | { kind: 'resource'; id: string; resourceKind: 'document' | 'slides' | 'spreadsheet' };

export interface FindingLink {
  id: EntityId<'finding_link'>;
  target: FindingTarget;
  relationship: 'supports' | 'refutes' | 'contextualizes' | 'qualifies';
  payload: JsonObject;
}

export interface Finding extends PersistedRecord<'finding'> {
  statement: RichBlockRef<'text'>;
  supportingBlocks: RichBlockRef[];
  findingKind: 'quotation' | 'observation' | 'calculation' | 'inference';
  confidence?: number;
  reviewState: 'proposed' | 'admitted' | 'rejected' | 'deprecated';
  method?: JsonObject;
  originatingResearchRunId?: EntityId<'research_run'>;
  sources: FindingSource[];
  links: FindingLink[];
  admittedAt?: ISODateTime;
  lifecycle: ActiveLifecycle;
  deletedAt?: ISODateTime;
}

// ---------------------------------------------------------------------------
// Research: the primary project chat surface
// ---------------------------------------------------------------------------

export type ResearchMode = 'discover' | 'question' | 'hypothesis';
export type ResearchChannel = 'web' | 'knowledge' | 'structured_data';

export interface ResearchThread extends PersistedRecord<'research_thread'> {
  title: string;
  defaultMode: ResearchMode;
  defaultChannels: ResearchChannel[];
  defaultContextIds: EntityId<'context'>[];
  /** Enables branching without a separate branch table. */
  activeLeafMessageId?: EntityId<'research_message'>;
  lifecycle: ActiveLifecycle;
  deletedAt?: ISODateTime;
}

export interface ResearchMessage {
  id: EntityId<'research_message'>;
  projectId: ProjectId;
  threadId: EntityId<'research_thread'>;
  sequence: number;
  parentMessageId?: EntityId<'research_message'>;
  role: 'human' | 'assistant' | 'system';
  authorId?: string;
  content: ChatMessageContent;
  runId?: EntityId<'research_run'>;
  derivedOutputId?: EntityId<'derived_output'>;
  createdAt: ISODateTime;
}

export type ResearchRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ResearchRun {
  id: EntityId<'research_run'>;
  projectId: ProjectId;
  threadId: EntityId<'research_thread'>;
  questionId?: EntityId<'question'>;
  hypothesisId?: EntityId<'hypothesis'>;
  mode: ResearchMode;
  status: ResearchRunStatus;
  brief?: JsonObject;
  projectFrame: JsonObject;
  channelManifest: ResearchChannel[];
  contextManifest: ResolvedContextManifest[];
  plan?: JsonObject;
  result?: JsonObject;
  failure?: FailureDetail;
  idempotencyKey: string;
  createdAt: ISODateTime;
  startedAt?: ISODateTime;
  finishedAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ResearchStep {
  id: EntityId<'research_step'>;
  projectId: ProjectId;
  runId: EntityId<'research_run'>;
  sequence: number;
  kind: string;
  purpose: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: JsonObject;
  output?: JsonObject;
  diagnostics: Diagnostic[];
  startedAt?: ISODateTime;
  finishedAt?: ISODateTime;
}

export interface ResearchQuery {
  id: EntityId<'research_query'>;
  projectId: ProjectId;
  runId: EntityId<'research_run'>;
  stepId?: EntityId<'research_step'>;
  channel: ResearchChannel;
  purpose: 'orient' | 'support' | 'challenge' | 'fill_gap';
  queryText: string;
  request: JsonObject;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
}

export type ResearchResultReference =
  | { kind: 'web_source'; url: string; capturedAt: ISODateTime }
  | { kind: 'knowledge_region'; artifactId: EntityId<'knowledge_artifact'>; locator?: JsonObject }
  | { kind: 'structured_entry'; reference: StructuredDataRef }
  | { kind: 'analysis_result'; reference: AnalysisResultRef };

export interface ResearchResult {
  id: EntityId<'research_result'>;
  projectId: ProjectId;
  queryId: EntityId<'research_query'>;
  rank: number;
  reference: ResearchResultReference;
  score?: number;
  capturedAt: ISODateTime;
}

export interface ResearchProposal {
  id: EntityId<'research_proposal'>;
  projectId: ProjectId;
  runId: EntityId<'research_run'>;
  kind: 'question' | 'hypothesis' | 'finding' | 'exploration';
  payload: JsonObject;
  reviewState: 'unreviewed' | 'accepted' | 'rejected' | 'deferred';
  admittedEntity?: {
    kind: 'question' | 'hypothesis' | 'finding';
    id: string;
  };
  createdAt: ISODateTime;
  reviewedAt?: ISODateTime;
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

export type StructuredValueType =
  | { kind: 'string' }
  | { kind: 'number'; unit?: string }
  | { kind: 'boolean' }
  | { kind: 'date' }
  | { kind: 'list'; itemType: StructuredValueType }
  | { kind: 'object'; fields: StructuredField[] };

export interface StructuredField {
  id: EntityId<'structured_field'>;
  name: string;
  valueType: StructuredValueType;
  nullable: boolean;
}

export interface StructuredColumn {
  id: EntityId<'structured_column'>;
  rank: Rank;
  name: string;
  label: string;
  valueType: StructuredValueType;
  nullable: boolean;
  lifecycle: ActiveLifecycle;
  defaultDefinition?: StructuredCellDefinition;
}

export type StructuredCellDefinition =
  | { kind: 'literal'; value: DomainValue | JsonObject | DomainValue[] }
  | { kind: 'formula'; formula: string }
  | { kind: 'reference'; reference: ContentSourceRef; projection?: string };

export interface StructuredEntryBase extends PersistedRecord<'structured_entry'> {
  displayName: string;
  normalizedName: string;
  description?: string;
  contextId?: EntityId<'context'>;
  lifecycle: ActiveLifecycle;
  deletedAt?: ISODateTime;
}

export interface StructuredTable extends StructuredEntryBase {
  entryKind: 'table';
  columns: StructuredColumn[];
}

export interface StructuredVariable extends StructuredEntryBase {
  entryKind: 'variable';
  valueType: StructuredValueType;
  definition: StructuredCellDefinition;
}

export type StructuredEntry = StructuredTable | StructuredVariable;

export interface StructuredRow {
  id: EntityId<'structured_row'>;
  projectId: ProjectId;
  tableId: EntityId<'structured_entry'>;
  changedAtRevision: number;
  lifecycle: ActiveLifecycle;
  rank: Rank;
  cells: Record<string, StructuredCellDefinition>;
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface AnalysisPage {
  id: EntityId<'analysis_page'>;
  rank: Rank;
  title: string;
  cardIds: EntityId<'analysis_card'>[];
}

export interface AnalysisCardBase<Kind extends string> {
  id: EntityId<'analysis_card'>;
  rank: Rank;
  kind: Kind;
  title: string;
  frame: Frame;
}

export interface MetricAnalysisCard extends AnalysisCardBase<'metric'> {
  value: AnalysisBinding;
  comparison?: AnalysisBinding;
  format?: string;
}

export interface TableAnalysisCard extends AnalysisCardBase<'table'> {
  source: AnalysisBinding;
  columns: string[];
  limit?: number;
}

export interface ChartAnalysisCard extends AnalysisCardBase<'chart'> {
  chartType: 'bar' | 'line' | 'scatter';
  source: AnalysisBinding;
  xField: string;
  yFields: string[];
  specification?: JsonObject;
}

export type AnalysisCard = MetricAnalysisCard | TableAnalysisCard | ChartAnalysisCard;

export type AnalysisBinding =
  | { kind: 'structured_data'; reference: StructuredDataRef }
  | { kind: 'formula'; formula: string }
  | { kind: 'plan_output'; nodeId: EntityId<'analysis_plan_node'>; output: string };

export interface SourcePlanNode {
  id: EntityId<'analysis_plan_node'>;
  kind: 'source';
  source: StructuredDataRef;
}

export interface FilterPlanNode {
  id: EntityId<'analysis_plan_node'>;
  kind: 'filter';
  inputNodeId: EntityId<'analysis_plan_node'>;
  predicate: string;
}

export interface AggregatePlanNode {
  id: EntityId<'analysis_plan_node'>;
  kind: 'aggregate';
  inputNodeId: EntityId<'analysis_plan_node'>;
  groupBy: string[];
  measures: Array<{ name: string; formula: string }>;
}

export type AnalysisPlanNode = SourcePlanNode | FilterPlanNode | AggregatePlanNode;

export interface AnalysisScenario {
  id: EntityId<'analysis_scenario'>;
  rank: Rank;
  name: string;
  overrides: Record<string, DomainValue>;
}

export interface CalculatedField {
  id: EntityId<'calculated_field'>;
  name: string;
  formula: string;
  valueType: StructuredValueType;
}

export interface AnalysisDefinition {
  pages: AnalysisPage[];
  cards: AnalysisCard[];
  dataPlan: AnalysisPlanNode[];
  calculatedFields: CalculatedField[];
  scenarios: AnalysisScenario[];
  questionIds: EntityId<'question'>[];
  contextIds: EntityId<'context'>[];
}

export interface Analysis extends PersistedRecord<'analysis'> {
  name: string;
  description?: string;
  lifecycle: Lifecycle;
  deletedAt?: ISODateTime;
  definition: AnalysisDefinition;
}

export type AnalysisExecutionStatus =
  | 'queued'
  | 'running'
  | 'candidate_ready'
  | 'ready'
  | 'failed'
  | 'stale'
  | 'cancelled';

export interface AnalysisInputManifest {
  structuredEntries: Array<{
    id: EntityId<'structured_entry'>;
    revision: number;
    digest: Digest;
  }>;
  contexts: ResolvedContextManifest[];
}

export interface AnalysisExecution {
  id: EntityId<'analysis_execution'>;
  projectId: ProjectId;
  analysisId: EntityId<'analysis'>;
  analysisRevision: number;
  status: AnalysisExecutionStatus;
  selectedPageId?: EntityId<'analysis_page'>;
  selectedCardIds: EntityId<'analysis_card'>[];
  scenarioIds: EntityId<'analysis_scenario'>[];
  inputManifest: AnalysisInputManifest;
  nameResolution: Record<string, string>;
  inputDigest: Digest;
  requestDigest: Digest;
  failure?: FailureDetail;
  idempotencyKey: string;
  createdAt: ISODateTime;
  startedAt?: ISODateTime;
  finishedAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AnalysisResult {
  id: EntityId<'analysis_result'>;
  projectId: ProjectId;
  executionId: EntityId<'analysis_execution'>;
  scenarioId?: EntityId<'analysis_scenario'>;
  outputs: Record<string, DomainValue | JsonObject | DomainValue[]>;
  dependencyManifest: ContentSourceRef[];
  formulaRuntimeReceipt: JsonObject;
  executorReceipt: JsonObject;
  digest: Digest;
  createdAt: ISODateTime;
}

export interface AnalysisOperation {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value?: JsonObject | DomainValue;
}

export interface AnalysisProposal {
  id: EntityId<'analysis_proposal'>;
  projectId: ProjectId;
  analysisId: EntityId<'analysis'>;
  sourceAnalysisRevision: number;
  purpose:
    | 'analysis_design'
    | 'chart_design'
    | 'scenario_design'
    | 'analysis_explanation';
  inputManifest: AnalysisInputManifest;
  contextManifest: ResolvedContextManifest[];
  operations: AnalysisOperation[];
  rationale: string;
  assumptions: string[];
  findingIds: EntityId<'finding'>[];
  providerReceipt: JsonObject;
  state: 'ready' | 'accepted' | 'superseded' | 'rejected';
  digest: Digest;
  createdAt: ISODateTime;
  reviewedAt?: ISODateTime;
}

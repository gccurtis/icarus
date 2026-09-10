import type { ContentBlock } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";
import type { FindingSource } from "$representation/data/types/investigation/finding";
import type {
  HypothesisAssessment,
  HypothesisEvidence
} from "$representation/data/types/investigation/hypothesis";
import type { QuestionStatus, RelatedItem } from "$representation/data/types/investigation/question";
import type { ResearchMode } from "$representation/data/types/investigation/research-thread";
import type {
  ResearchFinding,
  ResearchScope,
  ResearchSource,
  ResearchToolId,
  ResearchTurnUsage
} from "$representation/data/types/investigation/research-turn";

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
  summary?: string;
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
  summary?: string;
  mode: ResearchMode;
  personaId?: Id<"personas">;
  findingIds: Id<"findings">[];
  createdBy: Actor;
  updatedAt: number;
};
export type ResearchThread = Row<"researchThreads"> & ResearchThreadFields;

type ResearchTurnCommonFields = {
  projectId: Id<"projects">;
  researchThreadId: Id<"researchThreads">;
  threadId: Id<"threads">;
  promptMessageId: string;
  prompt: string;
  mode: ResearchMode;
  scope: ResearchScope;
  tools: ResearchToolId[];
  stopRequestedAt?: number;
  askedAt: number;
  updatedAt: number;
};

export type ResearchTurnRunningFields = ResearchTurnCommonFields & {
  state: "running";
  messageId?: never;
  usage?: never;
  model?: never;
  error?: never;
  answeredAt?: never;
  blocks: [];
  queries: [];
  sources: [];
  findings: [];
};

export type ResearchTurnCompletedFields = ResearchTurnCommonFields & {
  state: "answered" | "insufficient";
  messageId: string;
  blocks: ContentBlock[];
  queries: string[];
  sources: ResearchSource[];
  findings: ResearchFinding[];
  usage: ResearchTurnUsage;
  model: string;
  error?: never;
  answeredAt: number;
};

export type ResearchTurnUnsuccessfulFields = ResearchTurnCommonFields & {
  state: "failed" | "cancelled";
  messageId?: never;
  usage?: never;
  model?: never;
  error: string;
  answeredAt?: never;
  blocks: [];
  queries: [];
  sources: [];
  findings: [];
};

export type ResearchTurnFields =
  | ResearchTurnRunningFields
  | ResearchTurnCompletedFields
  | ResearchTurnUnsuccessfulFields;
export type ResearchTurn = Row<"researchTurns"> & ResearchTurnFields;

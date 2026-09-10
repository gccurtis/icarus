import type { CurrentRowPolicies } from "$representation/store/schema/types";

export const AGENT_ROW_POLICIES = {
  personas: {
    projectId: "required", name: "required", description: "optional", definition: "required",
    scope: "optional", cast: "optional", tools: "required", avatar: "optional",
    createdBy: "required", revision: "required", updatedAt: "required"
  },
  agentTasks: {
    projectId: "required", threadId: "required", title: "required", instruction: "required",
    personaId: "required", origin: "required", state: "required", execution: "optional", scope: "optional",
    tools: "required", plan: "required", outputs: "required", questions: "required",
    createdBy: "required", startedAt: "required", finishedAt: "optional",
    reviewedBy: "optional", revision: "required", updatedAt: "required"
  },
  automations: {
    projectId: "required", name: "required", personaId: "required", instruction: "required",
    trigger: "required", scope: "optional", tools: "required", enabled: "required",
    firedCount: "required", lastFiredAt: "optional", createdBy: "required",
    revision: "required", updatedAt: "required"
  },
  questions: {
    projectId: "required", text: "required", notes: "required", status: "required",
    relatedTo: "required", researchThreadIds: "required", parentId: "optional",
    createdBy: "required", updatedBy: "required", revision: "required", updatedAt: "required"
  },
  hypotheses: {
    projectId: "required", statement: "required", notes: "required", assessment: "required",
    confidence: "optional", evidence: "required", relatedTo: "required",
    researchThreadIds: "required", createdBy: "required", updatedBy: "required",
    revision: "required", updatedAt: "required"
  },
  findings: {
    projectId: "required", title: "required", summary: "optional", body: "required",
    sources: "required", evidenceFor: "required", relatedTo: "required",
    researchThreadIds: "required", createdBy: "required", updatedBy: "required",
    revision: "required", updatedAt: "required"
  },
  researchThreads: {
    projectId: "required", threadId: "required", title: "required", summary: "optional",
    mode: "required", personaId: "optional", findingIds: "required", createdBy: "required",
    updatedAt: "required"
  },
  researchTurns: {
    projectId: "required", researchThreadId: "required", threadId: "required",
    promptMessageId: "required", messageId: "optional", prompt: "required", mode: "required",
    scope: "required", tools: "required", state: "required", stopRequestedAt: "optional",
    blocks: "required", queries: "required", sources: "required", findings: "required",
    usage: "optional", model: "optional", error: "optional", askedAt: "required",
    answeredAt: "optional", updatedAt: "required"
  }
} satisfies Pick<
  CurrentRowPolicies,
  | "personas"
  | "agentTasks"
  | "automations"
  | "questions"
  | "hypotheses"
  | "findings"
  | "researchThreads"
  | "researchTurns"
>;

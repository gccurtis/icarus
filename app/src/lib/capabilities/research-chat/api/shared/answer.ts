import type { ServerModel } from "$runtime/server/start.server";
import type { IntelligenceTool, IntelligenceUsage } from "$model/server/intelligence/index.server";
import type { ContentBlock, TextBlock } from "$representation/data/types/content/content-block";
import type { ToolId } from "$representation/data/types/agents/tool";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { Id } from "$representation/data/types/core/id";
import type {
  ResearchFinding,
  ResearchScope,
  ResearchSource,
  ResearchTurnUsage
} from "$representation/data/types/investigation/research-turn";

import {
  DECISION_SCHEMA,
  parseDecision,
  type Decision
} from "$capabilities/research-chat/api/shared/decision";
import { CHAT_SYSTEM_PROMPT } from "$capabilities/research-chat/api/shared/prompts";
import { uniqueId } from "$capabilities/research-chat/api/shared/store";
import { createToolSession } from "$capabilities/research-chat/api/shared/tools";


/** Paragraphs, as blocks. The one shape every richer answer grows out of. */
export const textBlocks = (value: string): TextBlock[] =>
  value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => ({
      id: `b-${uniqueId()}`,
      type: "text",
      variant: "paragraph",
      atoms: [{ id: `a-${uniqueId()}`, kind: "literal", text: paragraph }],
      display: paragraph,
      marks: []
    }));

export type ChatAnswer = {
  readonly status: "answered" | "insufficient";
  readonly blocks: ContentBlock[];
  readonly sources: ResearchSource[];
  readonly findings: ResearchFinding[];
  readonly queries: string[];
  /** Passages handed back per search, what the model said, and what it cited. */
  readonly returned: number[];
  readonly said: "answered" | "insufficient";
  readonly offered: number;
  readonly repaired: boolean;
  readonly usage: ResearchTurnUsage;
  readonly model: string;
};

const usageOf = (usage: IntelligenceUsage): ResearchTurnUsage => ({
  requests: usage.requestCount,
  promptTokens: usage.promptTokens,
  completionTokens: usage.completionTokens,
  totalTokens: usage.totalTokens,
  ...(usage.costUsd === undefined ? {} : { costUsd: usage.costUsd })
});

const addUsage = (left: ResearchTurnUsage, right: ResearchTurnUsage): ResearchTurnUsage => ({
  requests: left.requests + right.requests,
  promptTokens: left.promptTokens + right.promptTokens,
  completionTokens: left.completionTokens + right.completionTokens,
  totalTokens: left.totalTokens + right.totalTokens,
  ...(left.costUsd === undefined && right.costUsd === undefined
    ? {}
    : { costUsd: (left.costUsd ?? 0) + (right.costUsd ?? 0) })
});

const CITE_SYSTEM_PROMPT = [
  "You wrote an answer from passages taken out of one project, and you did not say which passages you used.",
  "",
  "You are given those passages again, each with its sourceId, and the answer you wrote. Return the same answer, unchanged in substance, together with the sourceIds it actually rests on and a short note of what each one contributed.",
  "",
  "Cite only sourceIds from the list. Cite every passage the answer used. If the answer truly used none of them, return status `insufficient`."
].join("\n");

/**
 * One repair pass, with no tools.
 *
 * A model that has just searched, read and written will sometimes return the
 * prose and forget the citation array. Re-running the whole loop to recover
 * that would search again and cost the same as the first attempt; handing the
 * passages and the draft back costs one request and asks the one question that
 * failed.
 */
const citeAgain = async (
  input: AnswerInput,
  draft: Decision,
  offered: readonly ResearchSource[]
): Promise<{ decision: Decision; usage: ResearchTurnUsage }> => {
  const result = await input.model.intelligence.completeWithTools({
    system: CITE_SYSTEM_PROMPT,
    user: [
      `Question: ${input.question}`,
      "",
      "Passages you were given:",
      ...offered.map(
        (source) =>
          `- ${source.id} · ${source.title}${source.locator === undefined ? "" : ` · ${source.locator}`}\n  ${source.excerpt.replace(/\s+/g, " ").slice(0, 600)}`
      ),
      "",
      "The answer you wrote:",
      draft.response
    ].join("\n"),
    tools: [],
    model: input.chatModel,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
    output: {
      name: "research_chat_answer",
      description: "The same answer, with the sources it rests on",
      schema: DECISION_SCHEMA,
      parse: parseDecision
    }
  });
  return { decision: result.value, usage: usageOf(result.usage) };
};

export const INSUFFICIENT_TEXT =
  "Nothing in this project answers that. Try naming the resource you have in mind, or ask something narrower.";

type AnswerInput = {
  readonly model: ServerModel;
  readonly projectId: Id<"projects">;
  readonly scope: ResearchScope;
  readonly question: string;
  readonly history: readonly { readonly asked: string; readonly answered: string }[];
  readonly topK: number;
  readonly maxSources: number;
  readonly chatModel: string;
  /** Appended to the standing rules when the chat is answering as somebody. */
  readonly persona?: string;
  readonly grants: readonly ToolId[];
  /** What the persona may read at all. Never widened by the turn's own scope. */
  readonly bound?: ResourceSet;
  readonly maxToolRounds: number;
  stopping(): boolean;
  readonly signal?: AbortSignal;
};

const userPrompt = (input: AnswerInput): string =>
  [
    ...(input.history.length === 0
      ? []
      : [
          "Earlier in this conversation:",
          ...input.history.map((turn) => `Asked: ${turn.asked}\nAnswered: ${turn.answered}`),
          ""
        ]),
    `Question: ${input.question}`,
    input.scope.kind === "project"
      ? "Scope: the whole project."
      : `Scope: only the resource ${input.scope.ref.kind} ${input.scope.ref.id}.`
  ].join("\n");

/**
 * The answer arrives as a tool call, not as a response format.
 *
 * A provider-enforced JSON schema competes with tool calling: several models
 * answer the schema on the first turn and never search at all. A tool the model
 * calls to deliver its answer keeps one mechanism for everything it does, and
 * every provider that can call tools can do it.
 */
const submitTool = (record: (decision: Decision) => void): IntelligenceTool => ({
  name: "submit_answer",
  description:
    "Deliver the finished answer, the sources it rests on and the findings under it. Call this once, after searching, and then stop.",
  inputSchema: DECISION_SCHEMA,
  execute: async (value) => {
    record(parseDecision(value));
    return { received: true };
  }
});

export const answerQuestion = async (input: AnswerInput): Promise<ChatAnswer> => {
  const session = createToolSession({
    model: input.model,
    projectId: input.projectId,
    scope: input.scope,
    topK: input.topK,
    grants: input.grants,
    ...(input.bound === undefined ? {} : { bound: input.bound }),
    stopping: input.stopping
  });

  let submitted: Decision | undefined;
  const forced = session.tools.find((tool) => tool.name === "retrieve")?.name;
  const result = await input.model.intelligence.completeWithTools({
    system: `${CHAT_SYSTEM_PROMPT}${input.persona ?? ""}`,
    user: userPrompt(input),
    tools: [...session.tools, submitTool((value) => (submitted = value))],
    ...(forced === undefined ? {} : { firstTool: forced }),
    finalTool: "submit_answer",
    maxToolRounds: input.maxToolRounds,
    model: input.chatModel,
    ...(input.signal === undefined ? {} : { signal: input.signal })
  });

  let decision: Decision = submitted ?? {
    status: "insufficient",
    response: "",
    findings: [],
    sources: []
  };
  let usage = usageOf(result.usage);
  const issued = session.issued();
  let repaired = false;
  if (decision.status === "answered" && decision.sources.length === 0 && issued.length > 0) {
    const again = await citeAgain(input, decision, issued);
    repaired = true;
    usage = addUsage(usage, again.usage);
    if (again.decision.sources.length > 0) {
      decision = { ...decision, sources: again.decision.sources, findings: again.decision.findings };
    }
  }

  const used = new Map<string, string[]>();
  for (const entry of decision.sources.slice(0, input.maxSources)) {
    if (session.sourceOf(entry.sourceId) === undefined) continue;
    const held = used.get(entry.sourceId) ?? [];
    if (!held.includes(entry.use)) held.push(entry.use);
    used.set(entry.sourceId, held);
  }
  const sources: ResearchSource[] = [...used].flatMap(([id, uses]) => {
    const source = session.sourceOf(id);
    return source === undefined ? [] : [{ ...source, uses }];
  });

  const answered = decision.status === "answered" && decision.response.trim().length > 0;
  const findings: ResearchFinding[] = answered
    ? decision.findings
        .filter((finding) => finding.text.trim().length > 0)
        .map((finding) => ({
          id: `f-${uniqueId()}`,
          text: finding.text.trim(),
          sourceIds: finding.sourceIds.filter((id) => used.has(id))
        }))
    : [];

  return {
    status: answered ? "answered" : "insufficient",
    blocks: textBlocks(answered ? decision.response : INSUFFICIENT_TEXT),
    sources,
    findings,
    queries: [...session.queries],
    returned: [...session.returned],
    said: submitted?.status ?? "insufficient",
    offered: decision.sources.length,
    repaired,
    usage,
    model: input.chatModel
  };
};

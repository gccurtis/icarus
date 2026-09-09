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

import { createToolSession } from "$capabilities/research-chat/api/shared/tools";
import { uniqueId } from "$capabilities/research-chat/api/shared/store";

export const CHAT_SYSTEM_PROMPT = [
  "You answer questions about one project, using only what that project contains.",
  "",
  "Your tools: `retrieve` searches the written material. `retrieve_materials` finds tables, charts, images and code and describes them. `read_table` reads a table's actual cells and is the only way to get the numbers in one. `read_text` reads a stretch of one resource exactly. `list_resources` names what the project holds.",
  "",
  "A question about specific figures — what each row is, how much, how many — is a question about a table. Find it with `retrieve_materials` and then read it with `read_table`. A description of a table is not its contents, and answering from the description is a wrong answer.",
  "",
  "Use what you find. The passages a search returns are the project's own words, and a passage that bears on the question is an answer even when it does not settle it — say what the project does say, and say plainly what it does not. Partial is useful; silence is not.",
  "",
  "Only answer `insufficient` when the searches genuinely returned nothing about the subject. Before you conclude that, search again with different words, and call `list_resources` to see whether the subject is here under another name.",
  "",
  "Every passage and material you are shown carries a sourceId. Cite only sourceIds you were actually given; inventing one makes the whole answer unusable. Cite every source you used, with a short note of what you took from it. An answer with no sources is discarded.",
  "",
  "Write for someone who knows the domain and has not read the sources. Lead with the answer. Short paragraphs, one idea each, separated by a blank line. Do not describe your own searching, do not restate the question, do not thank anyone, and do not offer to help further.",
  "",
  "A finding is a single claim you are prepared to defend, with the sources under it. Write one for each substantive claim, at most six, each a complete sentence that stands on its own away from the answer.",
  "",
  "Deliver the answer by calling `submit_answer`. Never write it as ordinary text: text you write outside that call is discarded. Search first, then call `submit_answer` once, then stop.",
  "",
  "If a tool answers that the person asked you to stop, do not search again. Call `submit_answer` immediately with whatever you already have, and say in the answer that it is partial."
].join("\n");

/**
 * The persona's definition, appended to the standing rules.
 *
 * Its sections are the prompt, in the order the editor shows them, and an empty
 * section is left out rather than sent as a blank heading.
 */
export const personaPrompt = (persona: {
  readonly name: string;
  readonly description?: string;
  readonly definition: {
    readonly focus: string;
    readonly background: string;
    readonly approach: string;
    readonly outputPreferences: string;
    readonly verification: string;
  };
}): string => {
  const sections: readonly [string, string][] = [
    ["What you are for", persona.definition.focus],
    ["What to assume the reader knows", persona.definition.background],
    ["How to go about it", persona.definition.approach],
    ["What your answers should look like", persona.definition.outputPreferences],
    ["What to check before you say something", persona.definition.verification]
  ];
  const written = sections.filter(([, text]) => text.trim().length > 0);
  return [
    "",
    `You are answering as ${persona.name}.${persona.description === undefined ? "" : ` ${persona.description}`}`,
    ...written.flatMap(([title, text]) => ["", `${title}: ${text.trim()}`]),
    "",
    "Where this conflicts with the rules above, the rules above win: you may not cite what you were not given, and you may not answer from outside the project."
  ].join("\n");
};

type Decision = {
  status: "answered" | "insufficient";
  response: string;
  findings: Array<{ text: string; sourceIds: string[] }>;
  sources: Array<{ sourceId: string; use: string }>;
};

/**
 * Sources first, on purpose.
 *
 * A strict schema is generated in property order, so naming the evidence before
 * writing the prose makes the answer follow the sources rather than the sources
 * be recalled after the fact.
 */
const DECISION_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answered", "insufficient"] },
    sources: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        properties: { sourceId: { type: "string" }, use: { type: "string" } },
        required: ["sourceId", "use"],
        additionalProperties: false
      }
    },
    response: { type: "string" },
    findings: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          sourceIds: { type: "array", maxItems: 12, items: { type: "string" } }
        },
        required: ["text", "sourceIds"],
        additionalProperties: false
      }
    }
  },
  required: ["status", "sources", "response", "findings"],
  additionalProperties: false
} as const;

const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

const text = (value: unknown, message: string): string => {
  if (typeof value !== "string") throw new Error(message);
  return value;
};

const parseDecision = (value: unknown): Decision => {
  const answer = record(value, "the answer must be an object");
  if (answer.status !== "answered" && answer.status !== "insufficient") {
    throw new Error("the answer has an invalid status");
  }
  const findings = Array.isArray(answer.findings) ? answer.findings : [];
  const sources = Array.isArray(answer.sources) ? answer.sources : [];
  return {
    status: answer.status,
    response: text(answer.response, "the answer must carry a response"),
    findings: findings.map((entry) => {
      const finding = record(entry, "a finding must be an object");
      return {
        text: text(finding.text, "a finding must carry text"),
        sourceIds: (Array.isArray(finding.sourceIds) ? finding.sourceIds : []).map(String)
      };
    }),
    sources: sources.map((entry) => {
      const source = record(entry, "a source must be an object");
      return {
        sourceId: text(source.sourceId, "a source must carry a sourceId"),
        use: text(source.use, "a source must say what it was used for")
      };
    })
  };
};

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

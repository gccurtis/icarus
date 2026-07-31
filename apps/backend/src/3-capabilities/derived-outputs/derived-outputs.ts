// DerivedOutputService — prompt-driven answer generation with evidence provenance.
// Pattern follows StructuredDataImpl.

import { randomUUID, createHash } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type { Knowledge } from "#platform/knowledge/knowledge.js";
import type { Region, ContextEntry } from "#platform/knowledge/types.js";
import type { Intelligence } from "#platform/intelligence/intelligence.js";
import type { ToolBinding } from "#platform/intelligence/tools.js";
import { ToolSet } from "#platform/intelligence/tools.js";
import type { Message } from "#platform/intelligence/types.js";
import type { DerivedOutputStore } from "./store.js";
import {
  DerivedOutputNotFoundError,
  StaleDefinitionRevisionError,
  type DerivedOutput,
  type DerivedOutputRevision,
  type DerivedOutputStatus,
  type DerivedEvidence,
  type DerivedEvidenceSpan,
  type DeclareDerivedOutputRequest,
  type UpdateDefinitionRequest,
  type DerivedRefreshResult,
  type RefreshAttempt
} from "./domain/model.js";

// ─── Config ─────────────────────────────────────────────────────────────────

export interface DerivedOutputConfig {
  readonly maxPlanQueries: number;   // default 8
  readonly maxToolRounds: number;    // default 8
}

// ─── Resource Reader Port ───────────────────────────────────────────────────

export interface ResourceReader {
  read(
    resourceId: string,
    resourceKind: string,
    startLine: number,
    endLine: number
  ): Promise<ResourceContent | null>;
}

export interface ResourceContent {
  readonly resourceId: string;
  readonly resourceKind: string;
  readonly revision?: number;
  readonly text: string;
  readonly byteSize: number;
}

// ─── Service Interface ─────────────────────────────────────────────────────

export interface DerivedOutputService {
  declare(request: DeclareDerivedOutputRequest): Promise<DerivedOutput>;
  get(id: string): Promise<DerivedOutput | null>;
  getRevision(
    id: string,
    revision: number
  ): Promise<DerivedOutputRevision | null>;
  updateDefinition(
    id: string,
    request: UpdateDefinitionRequest
  ): Promise<DerivedOutput>;
  refresh(id: string): Promise<DerivedRefreshResult>;
  delete(id: string): Promise<void>;
}

// ─── Prompts (inline, versioned in code) ────────────────────────────────────

const PLANNING_SYSTEM = `You are a retrieval planner. Your job is to produce a set of search queries
that will retrieve the material needed to answer the user's prompt.

The retrieval system searches a knowledge lattice — a hierarchical clustering
of embedded text windows from all admitted project sources. Each source is
chunked into overlapping windows, embedded, and clustered by semantic
similarity. Retrieval finds the windows most similar to your query and returns
verbatim text regions with exact byte offsets.

Write concise, keyword-rich queries. Cover distinct facts or sub-questions
rather than writing near-duplicate queries. A good query is specific enough to
surface the right windows but not so narrow that it misses relevant context.

When a PRIOR OUTPUT is present, use its named entities, dates, measures, and
other specific claims to plan queries that would retrieve the current version
of those facts. The prior output is retrieval context only — it is not factual
authority. You are planning how to check it, not assuming it is correct.

Do not answer the prompt. Do not infer facts. Your sole output is the list of
queries.`;

const SYNTHESIS_SYSTEM = `You answer a user's prompt. You have access to grounding material and tools.
Your answer must be supported entirely by the grounding — never invent a fact
or use outside knowledge.

GROUNDING REGIONS are verbatim text spans retrieved from the project knowledge
lattice. Each region includes its source identity, exact byte offsets, and
text. These are your primary factual input.

You have three tools:
- retrieve(query): Search the knowledge lattice for additional text. The
  lattice contains embedded windows from all admitted sources (documents,
  uploaded files, connected external files, web captures). Returns verbatim
  text regions ranked by relevance with source identity and byte offsets.
  Use this when the initial grounding is missing a fact you need, or when a
  grounding region suggests a follow-up you should verify.
- read(resourceId, resourceKind, startLine, endLine): Read a range of lines
  from a specific resource. Lines are 1-based. Use this when you need the
  full text of a section rather than a retrieval snippet.
- list_evidence(): Return the evidence you have accumulated so far. Use this
  to review what you already have before doing more retrieval or reading.

When a PRIOR OUTPUT is present, it shows the answer from the last refresh.
Your goal is to preserve its structure, headings, order, paragraph shape,
wording, and tone — making the smallest factual change that the grounding
requires. Do not rephrase, reorganise, or expand stable text merely to make it
sound new. Do not mention that anything changed, was previously different, or
was refreshed. If the prior output says "Revenue was $1.2M" and the only new
fact is that it is now $1.3M, your output should be identical except for the
number.

For every resource that meaningfully informed your answer, produce an evidence
item. Rank them from most informative (rank 1) to least. Write exactly one
sentence for the contribution field describing specifically what that resource
contributed to your answer.

EVIDENCE RULES:
- Include every resource you retrieved from or read that meaningfully informed
  the answer, even if indirectly.
- Do not include resources you looked at but did not use.
- For knowledge lattice spans: record the byte range exactly as returned.
- For read calls: record the line range you requested.
- relevanceRank: 1 is most informative. Ties are allowed; the array is ordered.
- contribution: One sentence. "Provided the Q3 2025 revenue figure of $1.3M."
  Not "This source was helpful."

Set status to "ok" when the grounding supports an answer. Set it to
"insufficient" when the grounding does not contain enough to answer. Set it to
"contradiction" only when grounding regions directly conflict on the point the
prompt asks about. When status is not "ok", the text should be one concise
explanation of what is missing or conflicting, based only on the grounding.`;

// ─── Schemas ────────────────────────────────────────────────────────────────

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["queries"],
  properties: {
    queries: {
      type: "array",
      description: "Distinct search queries for lattice retrieval.",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "string",
        description: "One concise, keyword-rich retrieval query.",
        minLength: 1
      }
    }
  }
} as const;

function createSynthesisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["status", "text", "evidence"],
    properties: {
      status: {
        type: "string",
        enum: ["ok", "insufficient", "contradiction"]
      },
      text: {
        type: "string",
        description: "The complete answer text."
      },
      evidence: {
        type: "array",
        description:
          "Every resource that meaningfully informed the answer, ranked most " +
          "informative first.",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "resourceId",
            "resourceKind",
            "resourceRevision",
            "sourceId",
            "span",
            "relevanceRank",
            "contribution"
          ],
          properties: {
            resourceId: { type: "string" },
            resourceKind: { type: "string" },
            resourceRevision: {
              type: ["number", "null"],
              description: "The resource revision at read time, if known. Use null when unknown."
            },
            sourceId: {
              type: ["string", "null"],
              description:
                "The Knowledge source ID when this evidence came from lattice " +
                "retrieval. Use null when not from lattice retrieval."
            },
            span: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "start", "end", "startLine", "endLine"],
              properties: {
                kind: {
                  type: "string",
                  enum: ["bytes", "lines"],
                  description:
                    '"bytes" for lattice retrieval spans, ' +
                    '"lines" for read-tool spans.'
                },
                start: { type: "integer", minimum: 0 },
                end: { type: "integer", minimum: 0 },
                startLine: { type: "integer", minimum: 1 },
                endLine: { type: "integer", minimum: 1 }
              },
              description:
                "For bytes kind: set start/end, and set startLine=0/endLine=0." +
                "For lines kind: set startLine/endLine, and set start=0/end=0."
            },
            relevanceRank: {
              type: "integer",
              minimum: 1,
              description:
                "1 = most informative. Ties allowed; array is ordered."
            },
            contribution: {
              type: "string",
              description:
                "One sentence: specifically what this resource contributed."
            }
          }
        }
      }
    }
  } as const;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function regionToGroundingText(regions: Region[]): string {
  return regions
    .map(
      (r) =>
        `[sourceId: ${r.sourceId}, label: ${r.label}, bytes: ${r.start}-${r.end}]\n${r.text}`
    )
    .join("\n\n");
}

function validateQueries(queries: string[], max: number): string[] {
  const trimmed = queries
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
  const deduped = [...new Set(trimmed)];
  return deduped.slice(0, max);
}

function validateEvidence(raw: unknown): DerivedEvidence[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is Record<string, unknown> =>
        typeof e === "object" && e !== null
    )
    .filter(
      (e) =>
        typeof e.resourceId === "string" &&
        e.resourceId.length > 0 &&
        typeof e.resourceKind === "string" &&
        e.resourceKind.length > 0 &&
        typeof e.span === "object" &&
        e.span !== null &&
        typeof (e.span as Record<string, unknown>).kind === "string" &&
        typeof e.relevanceRank === "number" &&
        e.relevanceRank >= 1 &&
        typeof e.contribution === "string"
    )
    .map((e) => {
      const span = e.span as Record<string, unknown>;
      let evidenceSpan: DerivedEvidenceSpan;
      if (span.kind === "bytes") {
        evidenceSpan = {
          kind: "bytes",
          start: Number(span.start ?? 0),
          end: Number(span.end ?? 0)
        };
      } else {
        evidenceSpan = {
          kind: "lines",
          startLine: Number(span.startLine ?? 1),
          endLine: Number(span.endLine ?? 1)
        };
      }
      return {
        resourceId: e.resourceId as string,
        resourceKind: e.resourceKind as string,
        resourceRevision:
          typeof e.resourceRevision === "number"
            ? (e.resourceRevision as number)
            : undefined,
        span: evidenceSpan,
        sourceId:
          typeof e.sourceId === "string"
            ? (e.sourceId as string)
            : undefined,
        relevanceRank: e.relevanceRank as number,
        contribution: e.contribution as string
      } satisfies DerivedEvidence;
    });
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class DerivedOutputServiceImpl implements DerivedOutputService {
  constructor(
    private readonly store: DerivedOutputStore,
    private readonly knowledge: Knowledge,
    private readonly intelligence: Intelligence,
    private readonly resourceReader: ResourceReader,
    private readonly config: DerivedOutputConfig,
    private readonly logger: Logger
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────

  async declare(
    request: DeclareDerivedOutputRequest
  ): Promise<DerivedOutput> {
    const start = performance.now();
    const id = randomUUID().replace(/-/g, "").slice(0, 32);
    const ts = now();

    const output: DerivedOutput = {
      id,
      kind: "prompt",
      definition: {
        prompt: request.prompt,
        contextEntries: request.contextEntries ?? [],
        stabilisationText: request.stabilisationText ?? "",
        definitionRevision: 1
      },
      headRevision: 0,
      freshness: {
        state: "refreshing",
        lastCheckedAt: null
      },
      createdAt: ts,
      updatedAt: ts
    };

    this.store.insertOutput(output);

    const durationMs = Math.round(performance.now() - start);
    this.logger.info("derived-outputs.declare", {
      id,
      promptLength: request.prompt.length,
      durationMs
    });

    // First refresh is triggered by the caller (endpoint) — or we run it
    // synchronously here. For now the endpoint will call refresh separately.
    return output;
  }

  async get(id: string): Promise<DerivedOutput | null> {
    const output = this.store.getOutput(id);
    this.logger.debug("derived-outputs.get", { id, found: output !== null });
    return output;
  }

  async getRevision(
    id: string,
    revision: number
  ): Promise<DerivedOutputRevision | null> {
    const rev = this.store.getRevision(id, revision);
    this.logger.debug("derived-outputs.get-revision", { outputId: id, revision, found: rev !== null });
    return rev;
  }

  async updateDefinition(
    id: string,
    request: UpdateDefinitionRequest
  ): Promise<DerivedOutput> {
    const start = performance.now();
    const output = this.store.getOutput(id);
    if (!output) throw new DerivedOutputNotFoundError(id);

    if (output.definition.definitionRevision !== request.expectedDefinitionRevision) {
      throw new StaleDefinitionRevisionError(
        id,
        request.expectedDefinitionRevision,
        output.definition.definitionRevision
      );
    }

    const newRevision = output.definition.definitionRevision + 1;
    const ts = now();

    this.store.updateOutputDefinition(
      id,
      request.prompt,
      JSON.stringify(request.contextEntries),
      request.stabilisationText,
      newRevision
    );

    this.store.updateOutputFreshness(
      id,
      "stale",
      ts,
      ts,
      null,
      null
    );

    const updated = this.store.getOutput(id)!;

    const durationMs = Math.round(performance.now() - start);
    this.logger.info("derived-outputs.update-definition", {
      id,
      definitionRevision: newRevision,
      durationMs
    });

    return updated;
  }

  async refresh(id: string): Promise<DerivedRefreshResult> {
    const start = performance.now();
    const output = this.store.getOutput(id);
    if (!output) throw new DerivedOutputNotFoundError(id);

    const frozenDefRev = output.definition.definitionRevision;
    const frozenHeadRev = output.headRevision;

    // Mark refreshing
    const ts = now();
    this.store.updateOutputFreshness(id, "refreshing", ts, null, null, null);

    // Persist attempt
    const attemptId = randomUUID().replace(/-/g, "");
    const contextDigest = createHash("sha256")
      .update(JSON.stringify(output.definition.contextEntries))
      .digest("hex");

    const attempt: RefreshAttempt = {
      id: attemptId,
      outputId: id,
      frozenDefinitionRevision: frozenDefRev,
      frozenContextDigest: contextDigest,
      settled: false,
      usagePromptTokens: 0,
      usageCompletionTokens: 0,
      usageTotalTokens: 0,
      usageReasoningTokens: 0,
      startedAt: ts
    };
    this.store.insertAttempt(attempt);

    try {
      // Stage: Plan
      const planMessages: Message[] = [
        {
          role: "system",
          content: PLANNING_SYSTEM
        },
        {
          role: "user",
          content: `PROMPT:\n${output.definition.prompt}\n\nPRIOR OUTPUT:\n${output.definition.stabilisationText || "(none)"}`
        }
      ];

      const planResult = await this.intelligence.reasonStructured(
        undefined,
        { cast: { purpose: "general", strength: "medium", speed: "high" }, messages: planMessages },
        planSchema as unknown as Record<string, unknown>
      );

      const planData = planResult.structured as { queries: string[] };
      const queries = validateQueries(
        planData?.queries ?? [],
        this.config.maxPlanQueries
      );

      this.logger.debug("derived-outputs.plan", {
        id,
        queryCount: queries.length,
        planTokens: planResult.usage.totalTokens
      });

      // Stage: Retrieve
      const allRegions: Region[] = [];
      let totalRetrievalTokens = planResult.usage.totalTokens;

      for (const query of queries) {
        const result = await this.knowledge.retrieve(query, {
          scope: output.definition.contextEntries.length > 0
            ? output.definition.contextEntries
            : undefined
        });
        allRegions.push(...result.regions);
        totalRetrievalTokens += result.usage.totalTokens;
      }

      const groundingText = regionToGroundingText(allRegions);

      this.logger.debug("derived-outputs.retrieve", {
        id,
        queryCount: queries.length,
        regionCount: allRegions.length
      });

      // Short-circuit: if no regions were found, skip synthesis.
      // Produce a guaranteed "no evidence" response without calling a model.
      if (allRegions.length === 0) {
        const noEvidenceContent =
          "Found no evidence to support a response.";
        const noEvidenceRevision: DerivedOutputRevision = {
          outputId: id,
          revision: frozenHeadRev + 1,
          definitionRevision: frozenDefRev,
          content: noEvidenceContent,
          evidence: [],
          status: "insufficient",
          createdAt: now()
        };

        this.store.insertRevision(noEvidenceRevision);
        this.store.updateOutputHead(id, frozenHeadRev + 1);
        this.store.updateOutputFreshness(id, "current", now(), null, null, null);

        if (!output.definition.stabilisationText) {
          this.store.updateOutputDefinition(
            id,
            output.definition.prompt,
            JSON.stringify(output.definition.contextEntries),
            noEvidenceContent,
            output.definition.definitionRevision
          );
        }

        this.store.updateAttemptResult(
          attemptId,
          frozenHeadRev + 1, "insufficient", true, null,
          planResult.usage.promptTokens,
          planResult.usage.completionTokens,
          totalRetrievalTokens,
          planResult.usage.reasoningTokens,
          now()
        );

        const refreshed = this.store.getOutput(id)!;
        const durationMs = Math.round(performance.now() - start);
        this.logger.info("derived-outputs.refresh.no-evidence", {
          id,
          revision: frozenHeadRev + 1,
          queryCount: queries.length,
          durationMs
        });

        return { output: refreshed, revision: noEvidenceRevision, skipped: false };
      }

      // Stage: Synthesise
      const synthesisMessages: Message[] = [
        { role: "system", content: SYNTHESIS_SYSTEM },
        {
          role: "user",
          content: `PROMPT:\n${output.definition.prompt}\n\nPRIOR OUTPUT:\n${output.definition.stabilisationText || "(none)"}\n\nGROUNDING REGIONS:\n${groundingText}`
        }
      ];

      // Build tool set for this synthesis run
      const evidenceAccumulator: DerivedEvidence[] = [];
      const toolSet = this.buildToolSet(evidenceAccumulator);

      const synthesisResult = await this.intelligence.reasonWithToolsStructured(
        undefined,
        {
          cast: {
            purpose: "general",
            strength: "high",
            speed: "medium"
          },
          messages: synthesisMessages
        },
        toolSet,
        createSynthesisSchema() as unknown as Record<string, unknown>,
        this.config.maxToolRounds
      );

      const synthData = synthesisResult.structured as {
        status: string;
        text: string;
        evidence: unknown;
      };

      const status = synthData?.status as DerivedOutputStatus ?? "insufficient";
      const content = (synthData?.text ?? "") as string;
      // Merge model-produced evidence with any tool-accumulated evidence
      const modelEvidence = validateEvidence(synthData?.evidence);
      const mergedEvidence = [...evidenceAccumulator];
      for (const me of modelEvidence) {
        if (!mergedEvidence.some(e => e.resourceId === me.resourceId && e.resourceKind === me.resourceKind)) {
          mergedEvidence.push(me);
        }
      }

      this.logger.debug("derived-outputs.synthesise", {
        id,
        status,
        contentLength: content.length,
        evidenceCount: mergedEvidence.length,
        toolRounds: synthesisResult.rounds,
        toolCalls: synthesisResult.calls,
        synthesisTokens: synthesisResult.usage.totalTokens
      });

      // Stage: Settle — reload and compare-and-swap
      const currentOutput = this.store.getOutput(id);
      if (!currentOutput) {
        // Deleted during refresh
        this.store.updateAttemptResult(
          attemptId,
          null, null, false,
          "output_deleted",
          0, 0, totalRetrievalTokens + synthesisResult.usage.totalTokens, synthesisResult.usage.reasoningTokens,
          now()
        );
        this.store.updateOutputFreshness(id, "failed", now(), null, "output_deleted", "Output was deleted during refresh");
        return { output: output, skipped: false };
      }

      if (currentOutput.definition.definitionRevision !== frozenDefRev) {
        // Definition changed — discard
        this.store.updateAttemptResult(
          attemptId,
          null, null, false,
          "definition_changed",
          synthesisResult.usage.promptTokens,
          synthesisResult.usage.completionTokens,
          synthesisResult.usage.totalTokens + totalRetrievalTokens,
          synthesisResult.usage.reasoningTokens,
          now()
        );
        this.store.updateOutputFreshness(id, "stale", now(), now(), null, null);
        return { output: currentOutput, skipped: false };
      }

      // Publish revision
      const newRev = frozenHeadRev + 1;
      const revision: DerivedOutputRevision = {
        outputId: id,
        revision: newRev,
        definitionRevision: frozenDefRev,
        content,
        evidence: mergedEvidence,
        status,
        createdAt: now()
      };

      this.store.insertRevision(revision);
      this.store.updateOutputHead(id, newRev);
      this.store.updateOutputFreshness(id, "current", now(), null, null, null);

      // Set stabilisation text from first successful revision
      if (!output.definition.stabilisationText && content) {
        this.store.updateOutputDefinition(
          id,
          currentOutput.definition.prompt,
          JSON.stringify(currentOutput.definition.contextEntries),
          content,
          currentOutput.definition.definitionRevision
        );
      }

      this.store.updateAttemptResult(
        attemptId,
        newRev, status, true, null,
        synthesisResult.usage.promptTokens,
        synthesisResult.usage.completionTokens,
        synthesisResult.usage.totalTokens + totalRetrievalTokens,
        synthesisResult.usage.reasoningTokens,
        now()
      );

      const refreshed = this.store.getOutput(id)!;

      const durationMs = Math.round(performance.now() - start);
      this.logger.info("derived-outputs.refresh", {
        id,
        revision: newRev,
        status,
        evidenceCount: mergedEvidence.length,
        durationMs
      });

      return { output: refreshed, revision, skipped: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error("derived-outputs.refresh.failed", { id, error: msg });
      this.store.updateAttemptResult(
        attemptId,
        null, null, false,
        `error: ${msg}`,
        0, 0, 0, 0,
        now()
      );
      this.store.updateOutputFreshness(id, "failed", now(), null, "refresh_failed", msg);
      const failed = this.store.getOutput(id)!;
      return { output: failed, skipped: false };
    }
  }

  async delete(id: string): Promise<void> {
    const start = performance.now();
    const output = this.store.getOutput(id);
    if (!output) throw new DerivedOutputNotFoundError(id);
    this.store.deleteOutput(id);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("derived-outputs.delete", { id, durationMs });
  }

  // ── Tool Builders ──────────────────────────────────────────────────────

  private buildToolSet(
    evidenceAccumulator: DerivedEvidence[]
  ): ToolSet {
    const bindings: ToolBinding[] = [
      this.createRetrieveTool(evidenceAccumulator),
      this.createReadTool(evidenceAccumulator),
      this.createListEvidenceTool(evidenceAccumulator)
    ];

    return new ToolSet(bindings);
  }

  private createRetrieveTool(
    evidenceAccumulator: DerivedEvidence[]
  ): ToolBinding {
    return {
      definition: {
        name: "retrieve",
        description:
          "Search the project knowledge lattice for text relevant to a query. " +
          "The lattice contains embedded windows from all admitted sources " +
          "(documents, uploaded files, connected external files, web captures). " +
          "Returns verbatim text regions ranked by relevance, each with source " +
          "identity and position. Use this when you need to find specific facts " +
          "or context beyond the initial retrieval.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "A concise, keyword-rich search query."
            }
          },
          required: ["query"]
        }
      },
      handler: async (args: Record<string, unknown>) => {
        const query = String(args.query ?? "");
        this.logger.debug("derived-outputs.tool.retrieve", { query });
        const result = await this.knowledge.retrieve(query);
        // Accumulate evidence from retrieval results
        for (const region of result.regions) {
          evidenceAccumulator.push({
            resourceId: region.sourceId,
            resourceKind: region.label,
            span: {
              kind: "bytes",
              start: region.start,
              end: region.end
            },
            sourceId: region.sourceId,
            relevanceRank: evidenceAccumulator.length + 1,
            contribution: `Retrieved from ${region.label} during synthesis.`
          });
        }
        return result.regions.map((r) => ({
          sourceId: r.sourceId,
          label: r.label,
          start: r.start,
          end: r.end,
          text: r.text,
          relevance: r.relevance
        }));
      }
    };
  }

  private createReadTool(
    evidenceAccumulator: DerivedEvidence[]
  ): ToolBinding {
    return {
      definition: {
        name: "read",
        description:
          "Read a range of lines from a resource identified by its ID and kind. " +
          "Lines are 1-based. Use this when you need the full text of a section " +
          "of a resource rather than a retrieval snippet.",
        inputSchema: {
          type: "object",
          properties: {
            resourceId: {
              type: "string",
              description: "The resource's stable ID."
            },
            resourceKind: {
              type: "string",
              description: "The resource kind, e.g. 'general::file::text'."
            },
            startLine: {
              type: "integer",
              minimum: 1,
              description: "First line to read (1-based, inclusive)."
            },
            endLine: {
              type: "integer",
              minimum: 1,
              description: "Last line to read (1-based, inclusive)."
            }
          },
          required: ["resourceId", "resourceKind", "startLine", "endLine"]
        }
      },
      handler: async (args: Record<string, unknown>) => {
        const resourceId = String(args.resourceId ?? "");
        const resourceKind = String(args.resourceKind ?? "");
        const startLine = Number(args.startLine ?? 1);
        const endLine = Number(args.endLine ?? 1);
        this.logger.debug("derived-outputs.tool.read", { resourceId, resourceKind, startLine, endLine });
        const content = await this.resourceReader.read(
          resourceId,
          resourceKind,
          startLine,
          endLine
        );
        if (!content) {
          return { error: `Resource not found: ${resourceId}` };
        }
        // Accumulate evidence
        evidenceAccumulator.push({
          resourceId: content.resourceId,
          resourceKind: content.resourceKind,
          resourceRevision: content.revision,
          span: {
            kind: "lines",
            startLine,
            endLine
          },
          relevanceRank: evidenceAccumulator.length + 1,
          contribution: `Read lines ${startLine}-${endLine} during synthesis.`
        });
        return { resourceId, resourceKind, text: content.text };
      }
    };
  }

  private createListEvidenceTool(
    evidenceAccumulator: DerivedEvidence[]
  ): ToolBinding {
    return {
      definition: {
        name: "list_evidence",
        description:
          "Return the current list of evidence items accumulated during this " +
          "synthesis. Each item includes the resource identity, span, relevance " +
          "rank, and contribution. Use this to review what you already have " +
          "before doing additional retrieval or reading.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      handler: async () => {
        this.logger.debug("derived-outputs.tool.list-evidence", { count: evidenceAccumulator.length });
        return evidenceAccumulator.map((e) => ({
          resourceId: e.resourceId,
          resourceKind: e.resourceKind,
          span: e.span,
          relevanceRank: e.relevanceRank,
          contribution: e.contribution
        }));
      }
    };
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createDerivedOutputService(
  store: DerivedOutputStore,
  knowledge: Knowledge,
  intelligence: Intelligence,
  resourceReader: ResourceReader,
  config: DerivedOutputConfig,
  logger: Logger
): DerivedOutputService {
  return new DerivedOutputServiceImpl(
    store,
    knowledge,
    intelligence,
    resourceReader,
    config,
    logger
  );
}
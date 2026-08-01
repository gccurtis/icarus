// DerivedOutputService — prompt-driven answer generation with evidence provenance.
// Pattern follows StructuredDataImpl.

import { randomUUID, createHash } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type { Knowledge } from "#platform/knowledge/knowledge.js";
import type {
  Region,
  ContextEntry,
  KnowledgeSourceMutation,
  KnowledgeResourceDescriptor,
  KnowledgeScopeManifest
} from "#platform/knowledge/types.js";
import type { Intelligence } from "#platform/intelligence/intelligence.js";
import type { ToolBinding } from "#platform/intelligence/tools.js";
import { ToolSet } from "#platform/intelligence/tools.js";
import type { Message, Usage } from "#platform/intelligence/types.js";
import type { DerivedOutputStore } from "./store.js";
import {
  DerivedOutputIdempotencyConflictError,
  DerivedOutputDefinitionUpdateIdempotencyConflictError,
  DerivedOutputRefreshIdempotencyConflictError,
  DerivedOutputNotFoundError,
  StaleDefinitionRevisionError,
  type DerivedOutput,
  type DerivedOutputRevision,
  type DerivedOutputStatus,
  type DerivedEvidence,
  type DerivedEvidenceSpan,
  type DeclareDerivedOutputRequest,
  type DeclareDerivedOutputOptions,
  type UpdateDefinitionRequest,
  type UpdateDerivedOutputDefinitionOptions,
  type DerivedRefreshResult,
  type RefreshDerivedOutputOptions,
  type RefreshAttempt
} from "./domain/model.js";

// ─── Config ─────────────────────────────────────────────────────────────────

export interface DerivedOutputConfig {
  readonly maxPlanQueries: number;   // default 8
  readonly maxToolRounds: number;    // default 8
}

// ─── Resource Reader Port ───────────────────────────────────────────────────

export interface ResourceReader {
  describeSource(sourceId: string): Promise<ResourceDescriptor | null>;
  list(scope: KnowledgeScopeManifest): Promise<readonly ResourceDescriptor[]>;
  read(
    resourceId: string,
    resourceKind: string,
    startLine: number,
    endLine: number,
    scope: KnowledgeScopeManifest
  ): Promise<ResourceContent | null>;
}

export type ResourceDescriptor = KnowledgeResourceDescriptor;

export interface ResourceContent {
  readonly resourceId: string;
  readonly resourceKind: string;
  readonly revision?: number;
  readonly text: string;
  readonly byteSize: number;
}

// ─── Service Interface ─────────────────────────────────────────────────────

export interface DerivedOutputService {
  declare(
    request: DeclareDerivedOutputRequest,
    options?: DeclareDerivedOutputOptions
  ): Promise<DerivedOutput>;
  get(id: string): Promise<DerivedOutput | null>;
  getRevision(
    id: string,
    revision: number
  ): Promise<DerivedOutputRevision | null>;
  updateDefinition(
    id: string,
    request: UpdateDefinitionRequest,
    options?: UpdateDerivedOutputDefinitionOptions
  ): Promise<DerivedOutput>;
  refresh(
    id: string,
    options?: RefreshDerivedOutputOptions
  ): Promise<DerivedRefreshResult>;
  recordKnowledgeSourceMutation(mutation: KnowledgeSourceMutation): void;
  delete(id: string): Promise<void>;
}

// ─── Prompts (inline, versioned in code) ────────────────────────────────────

const PLANNING_SYSTEM = `You are a retrieval planner. Your job is to produce a set of search queries
that will retrieve the material needed to answer the user's prompt.

The retrieval system searches a knowledge lattice — a hierarchical clustering
of embedded text windows from all admitted project sources. Each source is
chunked into overlapping windows, embedded, and clustered by semantic
similarity. Retrieval finds the windows most similar to your query and returns
verbatim text regions with exact UTF-16 character offsets.

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
lattice. Each region includes its resource identity, exact UTF-16 character offsets, and
text. These are your primary factual input.

You have four tools:
- retrieve(query): Search the knowledge lattice for additional text. The
  lattice contains embedded windows from all admitted sources (documents,
  uploaded files, connected external files, web captures). Returns verbatim
  text regions ranked by relevance with source identity and character offsets.
  Use this when the initial grounding is missing a fact you need, or when a
  grounding region suggests a follow-up you should verify.
- read(resourceId, resourceKind, startLine, endLine): Read a range of lines
  from a specific resource. Lines are 1-based. Use this when you need the
  full text of a section rather than a retrieval snippet.
- list_resources(): List the immutable resources admitted by this refresh's
  resolved Context. Use its exact resourceId and resourceKind values for read.
- list_evidence(): Return the trusted evidence candidates available so far. Use this
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
- For knowledge lattice spans: record the character range exactly as returned.
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
              type: "string",
              description:
                "The exact Knowledge source ID returned with the trusted evidence candidate."
            },
            span: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["kind", "start", "end"],
                  properties: {
                    kind: { type: "string", enum: ["characters"] },
                    start: { type: "integer", minimum: 0 },
                    end: { type: "integer", minimum: 0 }
                  }
                },
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["kind", "startLine", "endLine"],
                  properties: {
                    kind: { type: "string", enum: ["lines"] },
                    startLine: { type: "integer", minimum: 1 },
                    endLine: { type: "integer", minimum: 1 }
                  }
                }
              ]
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

function declarationRequestDigest(request: DeclareDerivedOutputRequest): string {
  const normalized = {
    prompt: request.prompt,
    contextEntries: request.contextEntries ?? [],
    stabilisationText: request.stabilisationText ?? ""
  };
  return createHash("sha256")
    .update(JSON.stringify(normalized), "utf8")
    .digest("hex");
}

function refreshRequestDigest(outputId: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ outputId }), "utf8")
    .digest("hex");
}

function definitionUpdateRequestDigest(
  outputId: string,
  request: UpdateDefinitionRequest
): string {
  const normalized = {
    outputId,
    prompt: request.prompt,
    contextEntries: request.contextEntries,
    stabilisationText: request.stabilisationText,
    expectedDefinitionRevision: request.expectedDefinitionRevision
  };
  return createHash("sha256")
    .update(JSON.stringify(normalized), "utf8")
    .digest("hex");
}

function validateIdempotencyKey(key: string): void {
  if (key.trim().length === 0) {
    throw new Error("Derived output idempotency key must not be blank");
  }
  if (Buffer.byteLength(key, "utf8") > 512) {
    throw new Error("Derived output idempotency key exceeds 512 bytes");
  }
}

interface EvidenceCandidate {
  readonly resourceId: string;
  readonly resourceKind: string;
  readonly resourceRevision?: number;
  readonly sourceId?: string;
  readonly span: DerivedEvidenceSpan;
}

function spanKey(span: DerivedEvidenceSpan): string {
  return span.kind === "characters"
    ? `characters:${span.start}:${span.end}`
    : `lines:${span.startLine}:${span.endLine}`;
}

function candidateKey(candidate: EvidenceCandidate): string {
  return `${candidate.resourceKind}:${candidate.resourceId}:${spanKey(candidate.span)}`;
}

function addCandidate(
  candidates: EvidenceCandidate[],
  candidate: EvidenceCandidate
): void {
  if (!candidates.some((current) => candidateKey(current) === candidateKey(candidate))) {
    candidates.push(candidate);
  }
}

function regionToGroundingText(
  regions: Region[],
  candidates: EvidenceCandidate[]
): string {
  return regions
    .map((region) => {
      const candidate = candidates.find(
        (current) =>
          current.sourceId === region.sourceId &&
          current.span.kind === "characters" &&
          current.span.start === region.start &&
          current.span.end === region.end
      );
      const identity = candidate
        ? `resourceId: ${candidate.resourceId}, resourceKind: ${candidate.resourceKind}, `
        : "";
      return `[${identity}sourceId: ${region.sourceId}, characters: ${region.start}-${region.end}]\n${region.text}`;
    })
    .join("\n\n");
}

function validateQueries(queries: unknown, max: number): string[] {
  if (!Array.isArray(queries) || queries.some((query) => typeof query !== "string")) {
    throw new Error("Invalid retrieval plan queries");
  }
  const trimmed = queries
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
  const deduped = [...new Set(trimmed)];
  const selected = deduped.slice(0, max);
  if (selected.length === 0) throw new Error("Retrieval plan contained no usable queries");
  return selected;
}

function candidateForRegion(
  region: Region,
  scope: KnowledgeScopeManifest
): EvidenceCandidate {
  const resource = scope.resources.find(
    (candidate) => candidate.sourceId === region.sourceId
  );
  if (!resource) {
    throw new Error("Knowledge returned a source outside the frozen scope");
  }
  return {
    ...resource,
    span: {
      kind: "characters",
      start: region.start,
      end: region.end
    }
  };
}

function parseEvidenceSpan(raw: unknown): DerivedEvidenceSpan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid evidence span");
  }
  const span = raw as Record<string, unknown>;
  if (span.kind === "characters") {
    if (
      !Number.isSafeInteger(span.start) ||
      !Number.isSafeInteger(span.end) ||
      (span.start as number) < 0 ||
      (span.end as number) <= (span.start as number)
    ) {
      throw new Error("Invalid character evidence span");
    }
    return {
      kind: "characters",
      start: span.start as number,
      end: span.end as number
    };
  }
  if (span.kind === "lines") {
    if (
      !Number.isSafeInteger(span.startLine) ||
      !Number.isSafeInteger(span.endLine) ||
      (span.startLine as number) < 1 ||
      (span.endLine as number) < (span.startLine as number)
    ) {
      throw new Error("Invalid line evidence span");
    }
    return {
      kind: "lines",
      startLine: span.startLine as number,
      endLine: span.endLine as number
    };
  }
  throw new Error("Unknown evidence span kind");
}

function validateEvidence(
  raw: unknown,
  candidates: EvidenceCandidate[]
): DerivedEvidence[] {
  if (!Array.isArray(raw)) throw new Error("Evidence must be an array");

  const validated: DerivedEvidence[] = [];
  const usedCandidates = new Set<string>();
  let previousRank = 0;

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid evidence item");
    }
    const evidence = item as Record<string, unknown>;
    if (
      typeof evidence.resourceId !== "string" ||
      evidence.resourceId.length === 0 ||
      typeof evidence.resourceKind !== "string" ||
      evidence.resourceKind.length === 0 ||
      !Number.isSafeInteger(evidence.relevanceRank) ||
      (evidence.relevanceRank as number) < 1 ||
      typeof evidence.contribution !== "string" ||
      evidence.contribution.trim().length === 0
    ) {
      throw new Error("Invalid evidence fields");
    }
    if (
      evidence.resourceRevision !== null &&
      evidence.resourceRevision !== undefined &&
      (!Number.isSafeInteger(evidence.resourceRevision) ||
        (evidence.resourceRevision as number) < 1)
    ) {
      throw new Error("Invalid evidence resource revision");
    }
    if (
      evidence.sourceId !== null &&
      evidence.sourceId !== undefined &&
      (typeof evidence.sourceId !== "string" || evidence.sourceId.length === 0)
    ) {
      throw new Error("Invalid evidence source ID");
    }

    const span = parseEvidenceSpan(evidence.span);
    const requested: EvidenceCandidate = {
      resourceId: evidence.resourceId,
      resourceKind: evidence.resourceKind,
      span
    };
    const key = candidateKey(requested);
    const candidate = candidates.find((current) => candidateKey(current) === key);
    if (!candidate) throw new Error("Evidence did not originate from grounding or a tool result");
    if (usedCandidates.has(key)) throw new Error("Duplicate evidence item");
    usedCandidates.add(key);

    const suppliedRevision = evidence.resourceRevision ?? undefined;
    if (suppliedRevision !== candidate.resourceRevision) {
      throw new Error("Evidence revision did not match the trusted candidate");
    }
    if (evidence.sourceId !== candidate.sourceId) {
      throw new Error("Evidence source ID did not match the trusted candidate");
    }
    const rank = evidence.relevanceRank as number;
    if (rank < previousRank) throw new Error("Evidence must be ordered by relevance rank");
    previousRank = rank;

    validated.push({
      resourceId: candidate.resourceId,
      resourceKind: candidate.resourceKind,
      resourceRevision: candidate.resourceRevision,
      span: candidate.span,
      sourceId: candidate.sourceId,
      relevanceRank: rank,
      contribution: evidence.contribution.trim()
    });
  }

  return validated;
}

function validateSynthesis(
  raw: unknown,
  candidates: EvidenceCandidate[]
): {
  status: DerivedOutputStatus;
  content: string;
  evidence: DerivedEvidence[];
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid synthesis result");
  }
  const result = raw as Record<string, unknown>;
  if (
    result.status !== "ok" &&
    result.status !== "insufficient" &&
    result.status !== "contradiction"
  ) {
    throw new Error("Invalid synthesis status");
  }
  if (typeof result.text !== "string" || result.text.trim().length === 0) {
    throw new Error("Synthesis text must be non-empty");
  }
  const evidence = validateEvidence(result.evidence, candidates);
  if (result.status === "ok" && evidence.length === 0) {
    throw new Error("A successful synthesis must cite trusted evidence");
  }
  return { status: result.status, content: result.text, evidence };
}

const zeroUsage = (): Usage => ({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  reasoningTokens: 0
});

function addUsage(left: Usage, right: Usage): Usage {
  return {
    promptTokens: left.promptTokens + right.promptTokens,
    completionTokens: left.completionTokens + right.completionTokens,
    totalTokens: left.totalTokens + right.totalTokens,
    reasoningTokens: left.reasoningTokens + right.reasoningTokens,
    costUsd:
      left.costUsd !== undefined || right.costUsd !== undefined
        ? (left.costUsd ?? 0) + (right.costUsd ?? 0)
        : undefined
  };
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
    request: DeclareDerivedOutputRequest,
    options?: DeclareDerivedOutputOptions
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

    let declared = output;
    let created = true;
    if (options) {
      validateIdempotencyKey(options.idempotencyKey);
      const requestDigest = declarationRequestDigest(request);
      const claim = this.store.claimDeclaration(
        output,
        options.idempotencyKey,
        requestDigest
      );
      if (claim.requestDigest !== requestDigest) {
        throw new DerivedOutputIdempotencyConflictError(
          options.idempotencyKey
        );
      }
      declared = claim.output;
      created = claim.created;
    } else {
      this.store.insertOutput(output);
    }

    const durationMs = Math.round(performance.now() - start);
    this.logger.info("derived-outputs.declare", {
      id: declared.id,
      created,
      promptLength: request.prompt.length,
      durationMs
    });

    // First refresh is triggered by the caller (endpoint) — or we run it
    // synchronously here. For now the endpoint will call refresh separately.
    return declared;
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
    request: UpdateDefinitionRequest,
    options?: UpdateDerivedOutputDefinitionOptions
  ): Promise<DerivedOutput> {
    const start = performance.now();
    const ts = now();
    if (options) {
      validateIdempotencyKey(options.idempotencyKey);
      if (!this.store.getOutput(id)) throw new DerivedOutputNotFoundError(id);
      const requestDigest = definitionUpdateRequestDigest(id, request);
      const claim = this.store.claimDefinitionUpdate(
        id,
        options.idempotencyKey,
        requestDigest,
        ts
      );
      if (claim.requestDigest !== requestDigest) {
        throw new DerivedOutputDefinitionUpdateIdempotencyConflictError(
          options.idempotencyKey
        );
      }
      if (claim.result) {
        this.logger.info("derived-outputs.update-definition.replayed", {
          id,
          idempotencyKey: options.idempotencyKey,
          definitionRevision: claim.result.definition.definitionRevision,
          durationMs: Math.round(performance.now() - start)
        });
        return claim.result;
      }
    }
    const result = this.store.updateOutputDefinition({
      outputId: id,
      expectedDefinitionRevision: request.expectedDefinitionRevision,
      prompt: request.prompt,
      contextEntriesJson: JSON.stringify(request.contextEntries),
      stabilisationText: request.stabilisationText,
      updatedAt: ts,
      ...(options ? { idempotencyKey: options.idempotencyKey } : {})
    });
    if (result.state === "not_found") {
      throw new DerivedOutputNotFoundError(id);
    }
    if (result.state === "stale") {
      throw new StaleDefinitionRevisionError(
        id,
        request.expectedDefinitionRevision,
        result.actualDefinitionRevision
      );
    }

    const durationMs = Math.round(performance.now() - start);
    this.logger.info("derived-outputs.update-definition", {
      id,
      definitionRevision: result.output.definition.definitionRevision,
      durationMs
    });

    return result.output;
  }

  async refresh(
    id: string,
    options?: RefreshDerivedOutputOptions
  ): Promise<DerivedRefreshResult> {
    const start = performance.now();
    const output = this.store.getOutput(id);
    if (!output) throw new DerivedOutputNotFoundError(id);

    if (options) {
      validateIdempotencyKey(options.idempotencyKey);
      const requestDigest = refreshRequestDigest(id);
      const claim = this.store.claimRefresh(
        id,
        options.idempotencyKey,
        requestDigest,
        now()
      );
      if (claim.requestDigest !== requestDigest) {
        throw new DerivedOutputRefreshIdempotencyConflictError(
          options.idempotencyKey
        );
      }
      if (claim.result) {
        this.logger.info("derived-outputs.refresh.replayed", {
          outputId: id,
          idempotencyKey: options.idempotencyKey,
          headRevision: claim.result.output.headRevision,
          skipped: claim.result.skipped,
          durationMs: Math.round(performance.now() - start)
        });
        return claim.result;
      }
    }

    const frozenDefRev = output.definition.definitionRevision;
    const frozenHeadRev = output.headRevision;
    const frozenKnowledgeGeneration = this.store.getKnowledgeGeneration();
    const ts = now();
    const attemptId = randomUUID().replace(/-/g, "");
    const canonicalContextEntries = [...output.definition.contextEntries]
      .map((entry) => ({ id: entry.id, kind: entry.kind }))
      .sort((left, right) =>
        left.kind === right.kind
          ? left.id.localeCompare(right.id)
          : left.kind.localeCompare(right.kind)
      );
    const contextDigest = createHash("sha256")
      .update(JSON.stringify(canonicalContextEntries))
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

    let usage = zeroUsage();
    let stage = "resolve_scope";
    let scopeDigest: string | undefined;

    try {
      // Resolve nested Context and every resource kind exactly once. Passing an
      // explicit empty array snapshots the current full-project source set.
      const frozenScope = await this.knowledge.resolveScope(
        output.definition.contextEntries
      );
      if (!frozenScope) throw new Error("Derived refresh requires a frozen scope");
      scopeDigest = frozenScope.scopeDigest;

      // Stage: Plan
      stage = "plan";
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
      usage = addUsage(usage, planResult.usage);

      const planData = planResult.structured as { queries?: unknown } | null;
      const queries = validateQueries(
        planData?.queries,
        this.config.maxPlanQueries
      );

      this.logger.debug("derived-outputs.plan", {
        outputId: id,
        attemptId,
        queryCount: queries.length,
        totalTokens: planResult.usage.totalTokens
      });

      // Stage: Retrieve
      stage = "retrieve";
      const allRegions: Region[] = [];

      for (const query of queries) {
        const result = await this.knowledge.retrieve(query, {
          scopeManifest: frozenScope
        });
        allRegions.push(...result.regions);
        usage = addUsage(usage, result.usage);
      }

      const evidenceCandidates: EvidenceCandidate[] = [];
      for (const region of allRegions) {
        addCandidate(
          evidenceCandidates,
          candidateForRegion(region, frozenScope)
        );
      }
      const groundingText = regionToGroundingText(
        allRegions,
        evidenceCandidates
      );

      this.logger.debug("derived-outputs.retrieve", {
        outputId: id,
        attemptId,
        queryCount: queries.length,
        regionCount: allRegions.length,
        evidenceCandidateCount: evidenceCandidates.length,
        scopeResourceCount: frozenScope.resources.length
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
        stage = "settle";
        const settled = this.store.settleRefresh({
          attemptId,
          outputId: id,
          expectedDefinitionRevision: frozenDefRev,
          expectedHeadRevision: frozenHeadRev,
          expectedKnowledgeGeneration: frozenKnowledgeGeneration,
          revision: noEvidenceRevision,
          usage,
          completedAt: now(),
          fallbackOutput: output,
          ...(options ? { idempotencyKey: options.idempotencyKey } : {})
        });
        const durationMs = Math.round(performance.now() - start);
        this.logger.info("derived-outputs.refresh.completed", {
          outputId: id,
          attemptId,
          path: "no_evidence",
          outcome: settled.state,
          ...(settled.state === "published"
            ? { revision: noEvidenceRevision.revision }
            : {}),
          status: noEvidenceRevision.status,
          queryCount: queries.length,
          scopeDigest: frozenScope.scopeDigest,
          knowledgeGeneration: frozenKnowledgeGeneration,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          reasoningTokens: usage.reasoningTokens,
          ...(usage.costUsd !== undefined ? { costUsd: usage.costUsd } : {}),
          durationMs
        });
        return settled.result;
      }

      // Stage: Synthesise
      const synthesisMessages: Message[] = [
        { role: "system", content: SYNTHESIS_SYSTEM },
        {
          role: "user",
          content: `PROMPT:\n${output.definition.prompt}\n\nPRIOR OUTPUT:\n${output.definition.stabilisationText || "(none)"}\n\nGROUNDING REGIONS:\n${groundingText}`
        }
      ];

      // Every tool closes over this exact manifest and trusted-candidate set.
      stage = "synthesise";
      const toolSet = this.buildToolSet(
        evidenceCandidates,
        frozenScope,
        (toolUsage) => {
          usage = addUsage(usage, toolUsage);
        }
      );

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
      usage = addUsage(usage, synthesisResult.usage);
      const { status, content, evidence } = validateSynthesis(
        synthesisResult.structured,
        evidenceCandidates
      );

      this.logger.debug("derived-outputs.synthesise", {
        outputId: id,
        attemptId,
        status,
        contentLength: content.length,
        evidenceCount: evidence.length,
        evidenceCandidateCount: evidenceCandidates.length,
        toolRounds: synthesisResult.rounds,
        toolCalls: synthesisResult.calls,
        totalTokens: synthesisResult.usage.totalTokens
      });

      const newRev = frozenHeadRev + 1;
      const revision: DerivedOutputRevision = {
        outputId: id,
        revision: newRev,
        definitionRevision: frozenDefRev,
        content,
        evidence,
        status,
        createdAt: now()
      };
      stage = "settle";
      const settled = this.store.settleRefresh({
        attemptId,
        outputId: id,
        expectedDefinitionRevision: frozenDefRev,
        expectedHeadRevision: frozenHeadRev,
        expectedKnowledgeGeneration: frozenKnowledgeGeneration,
        revision,
        usage,
        completedAt: now(),
        fallbackOutput: output,
        ...(options ? { idempotencyKey: options.idempotencyKey } : {})
      });
      const durationMs = Math.round(performance.now() - start);
      this.logger.info("derived-outputs.refresh.completed", {
        outputId: id,
        attemptId,
        path: "synthesis",
        outcome: settled.state,
        ...(settled.state === "published" ? { revision: newRev } : {}),
        status,
        evidenceCount: evidence.length,
        scopeDigest: frozenScope.scopeDigest,
        knowledgeGeneration: frozenKnowledgeGeneration,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        reasoningTokens: usage.reasoningTokens,
        ...(usage.costUsd !== undefined ? { costUsd: usage.costUsd } : {}),
        durationMs
      });
      return settled.result;
    } catch (err) {
      const completedAt = now();
      const diagnosticMessage = `Refresh failed during ${stage}.`;
      const failed = this.store.failRefresh({
        attemptId,
        outputId: id,
        expectedDefinitionRevision: frozenDefRev,
        expectedHeadRevision: frozenHeadRev,
        expectedKnowledgeGeneration: frozenKnowledgeGeneration,
        diagnosticCode: "refresh_failed",
        diagnosticMessage,
        usage,
        completedAt,
        fallbackOutput: output,
        ...(options ? { idempotencyKey: options.idempotencyKey } : {})
      });
      this.logger.error("derived-outputs.refresh.failed", {
        outputId: id,
        attemptId,
        stage,
        outcome: failed.state,
        errorKind: err instanceof Error ? err.name : "UnknownError",
        ...(scopeDigest ? { scopeDigest } : {}),
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        reasoningTokens: usage.reasoningTokens,
        ...(usage.costUsd !== undefined ? { costUsd: usage.costUsd } : {}),
        durationMs: Math.round(performance.now() - start)
      });
      return failed.result;
    }
  }

  recordKnowledgeSourceMutation(mutation: KnowledgeSourceMutation): void {
    const start = performance.now();
    const invalidated = this.store.markAllOutputsStaleForKnowledgeChange(now());
    this.logger.info("derived-outputs.knowledge.invalidated", {
      operation: mutation.operation,
      generation: invalidated.generation,
      outputsMarkedStale: invalidated.outputsMarkedStale,
      durationMs: Math.round(performance.now() - start)
    });
  }

  async delete(id: string): Promise<void> {
    const start = performance.now();
    if (!this.store.deleteOutput(id)) throw new DerivedOutputNotFoundError(id);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("derived-outputs.delete", { id, durationMs });
  }

  // ── Tool Builders ──────────────────────────────────────────────────────

  private buildToolSet(
    candidates: EvidenceCandidate[],
    scope: KnowledgeScopeManifest,
    recordUsage: (usage: Usage) => void
  ): ToolSet {
    const bindings: ToolBinding[] = [
      this.createRetrieveTool(candidates, scope, recordUsage),
      this.createReadTool(candidates, scope),
      this.createListResourcesTool(scope),
      this.createListEvidenceTool(candidates)
    ];

    return new ToolSet(bindings);
  }

  private createRetrieveTool(
    candidates: EvidenceCandidate[],
    scope: KnowledgeScopeManifest,
    recordUsage: (usage: Usage) => void
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
        if (typeof args.query !== "string" || args.query.trim().length === 0) {
          throw new Error("Invalid retrieval query");
        }
        const query = args.query.trim();
        const start = performance.now();
        const result = await this.knowledge.retrieve(query, {
          scopeManifest: scope
        });
        recordUsage(result.usage);
        for (const region of result.regions) {
          addCandidate(candidates, candidateForRegion(region, scope));
        }
        this.logger.debug("derived-outputs.tool.retrieve", {
          queryLength: query.length,
          regionCount: result.regions.length,
          totalTokens: result.usage.totalTokens,
          durationMs: Math.round(performance.now() - start)
        });
        return result.regions.map((region) => {
          const candidate = candidateForRegion(region, scope);
          return {
            resourceId: candidate.resourceId,
            resourceKind: candidate.resourceKind,
            resourceRevision: candidate.resourceRevision ?? null,
            sourceId: region.sourceId,
            span: candidate.span,
            text: region.text,
            relevance: region.relevance
          };
        });
      }
    };
  }

  private createReadTool(
    candidates: EvidenceCandidate[],
    scope: KnowledgeScopeManifest
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
        if (
          typeof args.resourceId !== "string" ||
          args.resourceId.length === 0 ||
          typeof args.resourceKind !== "string" ||
          args.resourceKind.length === 0 ||
          !Number.isSafeInteger(args.startLine) ||
          !Number.isSafeInteger(args.endLine) ||
          (args.startLine as number) < 1 ||
          (args.endLine as number) < (args.startLine as number)
        ) {
          throw new Error("Invalid resource read request");
        }
        const resourceId = args.resourceId;
        const resourceKind = args.resourceKind;
        const startLine = args.startLine as number;
        const endLine = args.endLine as number;
        const descriptor = scope.resources.find(
          (resource) =>
            resource.resourceId === resourceId &&
            resource.resourceKind === resourceKind
        );
        if (!descriptor) throw new Error("Resource is outside the frozen scope");

        const start = performance.now();
        const content = await this.resourceReader.read(
          resourceId,
          resourceKind,
          startLine,
          endLine,
          scope
        );
        if (!content) throw new Error("Scoped resource could not be read");
        const candidate: EvidenceCandidate = {
          resourceId: content.resourceId,
          resourceKind: content.resourceKind,
          resourceRevision: content.revision,
          sourceId: descriptor.sourceId,
          span: {
            kind: "lines",
            startLine,
            endLine
          }
        };
        addCandidate(candidates, candidate);
        this.logger.debug("derived-outputs.tool.read", {
          resourceId,
          resourceKind,
          startLine,
          endLine,
          returnedLength: content.text.length,
          durationMs: Math.round(performance.now() - start)
        });
        return {
          resourceId: candidate.resourceId,
          resourceKind: candidate.resourceKind,
          resourceRevision: candidate.resourceRevision ?? null,
          sourceId: candidate.sourceId,
          span: candidate.span,
          text: content.text
        };
      }
    };
  }

  private createListResourcesTool(scope: KnowledgeScopeManifest): ToolBinding {
    return {
      definition: {
        name: "list_resources",
        description:
          "List the immutable resources admitted by this refresh's resolved " +
          "Context. Only these exact resource IDs and kinds may be read.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      handler: async () => {
        const resources = await this.resourceReader.list(scope);
        const trusted = resources.filter((resource) =>
          scope.resources.some(
            (allowed) =>
              allowed.sourceId === resource.sourceId &&
              allowed.resourceId === resource.resourceId &&
              allowed.resourceKind === resource.resourceKind &&
              allowed.resourceRevision === resource.resourceRevision
          )
        );
        if (trusted.length !== resources.length) {
          throw new Error("Resource reader returned an item outside the frozen scope");
        }
        this.logger.debug("derived-outputs.tool.list-resources", {
          count: trusted.length,
          scopeDigest: scope.scopeDigest
        });
        return trusted.map((resource) => ({ ...resource }));
      }
    };
  }

  private createListEvidenceTool(
    candidates: EvidenceCandidate[]
  ): ToolBinding {
    return {
      definition: {
        name: "list_evidence",
        description:
          "Return the trusted evidence candidates observed during this " +
          "synthesis. Each item includes an exact resource identity and span. " +
          "Use this to review what you already have " +
          "before doing additional retrieval or reading.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      handler: async () => {
        this.logger.debug("derived-outputs.tool.list-evidence", { count: candidates.length });
        return candidates.map((candidate) => ({
          resourceId: candidate.resourceId,
          resourceKind: candidate.resourceKind,
          resourceRevision: candidate.resourceRevision ?? null,
          sourceId: candidate.sourceId ?? null,
          span: candidate.span
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

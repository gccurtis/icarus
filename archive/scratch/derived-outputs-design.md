# Derived Outputs Capability — Design

## Summary

Derived Outputs is a **regular capability** (`3-capabilities/derived-outputs/`)
that produces answers from project Knowledge with full provenance. You give it
a prompt and optional Context scope. It plans retrieval queries, runs them
against the Knowledge lattice, and synthesises an answer together with a
ranked, attributable set of **evidence** — each piece identifying the exact
resource and span that informed the answer, plus a one-sentence explanation of
how it contributed.

The capability owns the entire lifecycle: declare, refresh, read, and delete.
Resource capabilities (Document, Slides, Spreadsheet) hold only a
`DerivedOutputRef` — an output ID and revision — and call refresh when they
want a newer revision. Derived Outputs never pushes content into resources; the
resource pulls when it chooses.

The first and primary kind is `"prompt"`. Future kinds (e.g. structured data
summaries, cross-resource analyses) are additive without changing the core
model.

### Why a separate capability

- **Knowledge** is retrieval-only — it never synthesises. That is Intelligence's
  job.
- **Intelligence** is a stateless platform service — it has no persistence,
  revisions, staleness tracking, or endpoints.
- **Derived Outputs** bridges them: it orchestrates retrieval + reasoning,
  persists immutable revisions with evidence, tracks when the output might be
  out of date, and exposes endpoints.

### Where it fits

```
User writes a prompt
  → Derived Outputs plans queries (reasoning call: prompt → queries)
  → Knowledge retrieves regions from the lattice
  → Intelligence synthesises an answer with evidence (reasoning call with tools:
    retrieve, read, list_evidence)
  → Derived Outputs persists an immutable revision
  → Resource (Document, Slide, etc.) pulls the revision text into its content
```

### Prerequisites

- Platform Knowledge: `retrieve`, `retrieveMany` with Context-scoped retrieval.
- Platform Intelligence: `reasonStructured`, `reasonWithToolsStructured`.
- Context capability: `ContextEntry`, `resolve`.
- Connector and General Files: resource-reader registration so the `read` tool
  can pull full resource content.

---

## Core concepts

### Derived Output

The mutable identity. It holds the **definition** (what you asked and how you
scoped it) and a pointer to the **head revision** (the latest answer). Its
**freshness** is a cached signal that tells callers whether the answer might be
out of date without forcing them to re-run the pipeline.

```
DerivedOutput
  ├─ definition     ← mutable: prompt, scope, stabilisation text
  ├─ headRevision   ← pointer to latest immutable revision (0 until first refresh)
  └─ freshness      ← cached: "current" | "stale" | "refreshing" | "failed"
```

### Definition

The mutable configuration that describes *what to answer* and *how to scope
it*. Changing the definition — the prompt text, the Context scope, or the
stabilisation text — marks the output stale. The next refresh will use the new
definition.

```
definition = {
  prompt,             // "What is the current status of Project X?"
  contextEntries,     // which resources to scope retrieval to (empty = everything)
  stabilisationText,  // prior output text used to keep refreshes stable
  definitionRevision  // incremented on every update; used as an optimistic lock
}
```

### Output vs Revision

`DerivedOutput` is the **mutable identity**. It holds the prompt, scope,
stabilisation text, a pointer to the latest revision, and freshness.

`DerivedOutputRevision` is one **frozen answer**. It holds the answer text,
evidence, and status from a single generation run.

The output is like a query you've saved. Revisions are its answer history.

```
DerivedOutput (id: "abc123")
  ├─ prompt:        "What is the status of Project X?"
  ├─ headRevision:  3
  └─ freshness:     "current"
       │
       │ points to
       ▼
  DerivedOutputRevision (revision: 3)
    ├─ content:  "Project X is on track..."
    ├─ evidence: [ ... ]
    ├─ status:   "ok"
    └─ createdAt: "2026-07-31T..."
```

### Revision

An immutable snapshot of one generation run. Every refresh that produces new
content creates a new revision. The head pointer advances; past revisions are
never overwritten. Each revision records the answer text, the evidence that
supported it, and the definition revision frozen at generation time.

```
Revision 1 → Revision 2 → Revision 3 → ...
               ↑ headRevision
```

Revisions exist so the user can inspect past answers and their evidence — for
example, to see what changed between refreshes, or to understand what the
model used to produce an answer that later turned out to be wrong.

### Freshness

Freshness is a **cached signal**. Recomputing it would require re-running the
full pipeline, which costs model tokens. Instead:

- The output is `"current"` after a successful refresh.
- When a source in the output's Context scope is added or updated in the
  Knowledge lattice, the output is marked `"stale"`.
- During a refresh, it is `"refreshing"`.
- If a refresh errors, it becomes `"failed"` with a diagnostic.

This lets callers and the frontend cheaply answer "might this be out of date?"
without running any models. A future Automation capability can watch freshness
and trigger refreshes on a schedule or in response to lattice events. The
capability itself does not auto-refresh — it only tracks the signal.

### Evidence

Evidence is the output's provenance — the resources and spans the model used
to produce the answer. The model returns evidence alongside the answer as part
of the structured output. Each piece of evidence carries enough identity for
the frontend to render a clickable link to the actual resource.

Evidence is not generated after the fact from the answer. It is the structured
output of what the model *used*. The model decides which resources were
informative, ranks them, and writes one sentence about how each contributed.

There are two kinds of span in evidence:

- **Byte-range spans** come from Knowledge lattice retrieval. The lattice
  indexes text by byte offsets (or rune offsets), so a retrieved region is
  described by `start` and `end` byte positions within a specific source.
  These carry a `sourceId` so the staleness mechanism can later cross-reference
  which sources changed and which derived outputs are affected.
- **Line-range spans** come from `read` tool calls. Since files may be large
  and byte offsets are not meaningful to the model, the model specifies lines
  to read and the evidence records line numbers.

The term "evidence" is used here because these are the supporting materials for
a specific output — they are the evidence backing the answer. The term
"findings" is reserved for a different concept elsewhere in the product.

---

## Where it lives

```
apps/backend/src/
  3-capabilities/
    derived-outputs/
      domain/
        model.ts           # all types
        errors.ts          # NotFound, StaleDefinition, RefreshFailed, etc.
      application/
        declareService.ts  # create DerivedOutput, run first refresh
        refreshService.ts  # plan → retrieve → synthesise → settle
        readService.ts     # get output metadata or revision
      ports/
        repository.ts      # DerivedOutputRepository interface
        knowledge.ts        # Knowledge retrieval port
        intelligence.ts     # Intelligence port
        resourceReader.ts   # port for reading full resource content
      persistence/
        migrations/
          001-derived-outputs.ts
        sqliteDerivedOutputRepository.ts
      index.ts

  4-job-wiring/
    derived-outputs/
      registerDerivedOutputEndpointMappings.ts
      createDerivedOutputJobs.ts
```

---

## Types & Interfaces

### Identity

```ts
type DerivedOutputKind = "prompt"; // extensible: future kinds are additive

interface DerivedOutput {
  readonly id: string;                  // random 16-byte hex
  readonly kind: DerivedOutputKind;
  readonly definition: DerivedOutputDefinition;
  readonly headRevision: number;        // 0 until first successful refresh
  readonly freshness: DerivedOutputFreshness;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

No `deletedAt`. Delete is a hard delete. If a resource held a ref to a deleted
output, it renders a broken-reference state — the same pattern used when any
referenced resource is removed.

### Definition

The mutable configuration. Each update increments `definitionRevision`, which
acts as an optimistic lock: refreshes freeze the definition revision and will
not settle if it changed under them.

```ts
interface DerivedOutputDefinition {
  /** The user's question or prompt. */
  readonly prompt: string;

  /** Scope for Knowledge retrieval. Empty = everything in the project lattice. */
  readonly contextEntries: ContextEntry[];

  /**
   * Prior output text used to stabilise refreshes.
   *
   * On first run this is empty. After the first successful revision, the
   * answer text becomes the stabilisation text. The user may hand-edit it
   * through the definition update endpoint — for example to fix a phrasing
   * preference, restructure a section, or remove a paragraph they don't want
   * the model to regenerate.
   *
   * The model is instructed to preserve structure and wording, changing only
   * what the grounding requires. This means if the current answer is "Revenue
   * was $1.2M" and the only new fact is $1.3M, the refresh output should be
   * "Revenue was $1.3M" — same sentence, just the number changed.
   */
  readonly stabilisationText: string;

  /** Incremented on every definition update. Used as an optimistic lock. */
  readonly definitionRevision: number;
}
```

### Revision

An immutable snapshot of one generation run. Every refresh that produces
content creates a new revision. The head pointer advances; past revisions
remain inspectable.

```ts
interface DerivedOutputRevision {
  readonly outputId: string;
  readonly revision: number;            // 1-based, monotonic — never reused
  readonly definitionRevision: number;  // frozen at generation time
  readonly content: string;             // the answer text
  readonly evidence: DerivedEvidence[]; // ranked most → least informative
  readonly status: DerivedOutputStatus;
  readonly createdAt: string;
}

type DerivedOutputStatus =
  | "ok"            // answer produced with grounding
  | "insufficient"  // grounding did not support an answer
  | "contradiction"; // grounding conflicted on the requested point
```

### Evidence

One piece of grounded information the model used. Carries enough identity for
the frontend to render a link to the actual resource. The model produces this
list as part of the structured synthesis output.

There are two span representations because the Knowledge lattice indexes by
byte (or rune) offsets and the `read` tool operates on lines.

```ts
interface DerivedEvidence {
  /** The resource's stable ID. */
  readonly resourceId: string;

  /** Kind string so the frontend knows what type of link to render. */
  readonly resourceKind: string;

  /** The resource revision at read time, if known. */
  readonly resourceRevision?: number;

  /**
   * The exact span of the resource that was informative.
   *
   * For Knowledge lattice retrieval, this is a byte-range span.
   * For `read` tool calls, this is a line-range span.
   */
  readonly span: DerivedEvidenceSpan;

  /**
   * The Knowledge sourceId this evidence came from, when it originated from
   * a retrieval call (plan queries or the `retrieve` tool). This is the
   * identifier Knowledge uses internally. It exists so staleness propagation
   * can cross-reference changed sources against their derived outputs.
   */
  readonly sourceId?: string;

  /** 1 = most informative. The array is ordered; ties are allowed. */
  readonly relevanceRank: number;

  /** One sentence from the model describing how this informed the answer. */
  readonly contribution: string;
}

type DerivedEvidenceSpan =
  | DerivedByteSpan    // from Knowledge lattice retrieval
  | DerivedLineSpan;   // from read tool calls

interface DerivedByteSpan {
  readonly kind: "bytes";
  readonly start: number;  // byte offset, inclusive
  readonly end: number;    // byte offset, exclusive
}

interface DerivedLineSpan {
  readonly kind: "lines";
  readonly startLine: number;  // 1-based, inclusive
  readonly endLine: number;    // 1-based, inclusive
}
```

### Freshness

A cached signal. Updated by lattice change events and refresh lifecycle.

```ts
interface DerivedOutputFreshness {
  readonly state: "current" | "stale" | "refreshing" | "failed";
  readonly lastCheckedAt: string | null;
  readonly staleSince?: string;
  readonly diagnostic?: {
    readonly code: string;
    readonly message: string;
  };
}
```

### Resource reference (held by other capabilities)

```ts
/**
 * What a Document, Slide, or Spreadsheet stores to reference a Derived Output.
 * The resource compares appliedRevision with headRevision to decide whether
 * to advance its reference after calling refresh.
 */
interface DerivedOutputRef {
  readonly outputId: string;
  readonly appliedRevision: number;
}
```

---

## Runtime Objects

```ts
interface DerivedOutputService {
  declare(request: DeclareDerivedOutputRequest): Promise<DerivedOutput>;
  get(id: string): Promise<DerivedOutput | null>;
  getRevision(id: string, revision: number): Promise<DerivedOutputRevision | null>;
  updateDefinition(id: string, request: UpdateDefinitionRequest): Promise<DerivedOutput>;
  refresh(id: string): Promise<DerivedRefreshResult>;
  delete(id: string): Promise<void>;
}

interface DeclareDerivedOutputRequest {
  prompt: string;
  contextEntries?: ContextEntry[];
  stabilisationText?: string;
}

interface UpdateDefinitionRequest {
  prompt: string;
  contextEntries: ContextEntry[];
  stabilisationText: string;
  expectedDefinitionRevision: number; // optimistic lock
}

interface DerivedRefreshResult {
  readonly output: DerivedOutput;
  readonly revision?: DerivedOutputRevision; // present when new revision was published
  readonly skipped: boolean;                 // true when nothing changed
}
```

### Dependencies

```ts
interface DerivedOutputsDependencies {
  knowledge: Knowledge;            // retrieve, retrieveMany
  intelligence: Intelligence;      // reasonStructured, reasonWithToolsStructured
  resourceReader: ResourceReader;  // reads full resource content by ID + kind
  logger: Logger;
}

/**
 * ResourceReader aggregates readers registered by Connector, General Files,
 * and any future capability that owns readable content.
 */
interface ResourceReader {
  read(resourceId: string, resourceKind: string): Promise<ResourceContent | null>;
}

interface ResourceContent {
  readonly resourceId: string;
  readonly resourceKind: string;
  readonly revision?: number;
  readonly text: string;
  readonly byteSize: number;
}
```

---

## Refresh Pipeline

Three stages, following the established serial→concurrent→serial job pattern.
The serial stages own canonical mutation; the concurrent stage does the
expensive model work.

### Stage 1: Serial — freeze

```
1. Load the DerivedOutput.
2. Mark freshness as "refreshing".
3. Freeze: prompt, contextEntries, stabilisationText, definitionRevision.
4. Resolve contextEntries → admitted source IDs (via Context).
5. Persist an idempotent attempt record.
6. Enqueue stage 2 on the concurrent queue.
```

### Stage 2: Concurrent — plan, retrieve, synthesise

```
1. PLAN
   Call Intelligence.reasonStructured with the planning prompt.
   → { queries: string[] }
   Validate: deduplicate, trim empty, enforce max count (default 8).

2. RETRIEVE
   Call Knowledge.retrieveMany(queries, { contexts: frozenContextEntries }).
   → Region[][] + KnowledgeScopeManifest
   Assemble regions into a grounding text block for the model.
   Each region includes sourceId, label, start/end offsets, and verbatim text.

3. SYNTHESISE
   Call Intelligence.reasonWithToolsStructured with:
   - Synthesis prompt (prompt + stabilisationText + grounding regions)
   - Tools: retrieve, read, list_evidence
   - Schema: { status, text, evidence[] }
   → { status: "ok" | "insufficient" | "contradiction", text, evidence[] }

4. Validate the structured result:
   - Every evidence item has non-empty resourceId and resourceKind.
   - relevanceRank values are positive integers.
   - status is one of the three valid values.
   - text is a non-empty string when status is "ok".

5. Persist the candidate revision.
6. Enqueue stage 3 on the serial queue.
```

### Stage 3: Serial — settle

```
1. Reload the DerivedOutput.
2. If definitionRevision changed since freeze → discard candidate, mark stale.
   (User edited the definition while refresh was running. Their new definition
    takes priority; the next refresh will use it.)
3. If a newer revision was already published since freeze → discard candidate.
   (Another refresh completed first. Its revision is already the head.)
4. Otherwise:
   - Publish the revision as headRevision + 1.
   - Update freshness to "current".
   - If stabilisationText was empty, set it to the new content text.
   - Record usage (prompt/completion/reasoning tokens) on the attempt record.
```

### Why the freeze-settle pattern?

The expensive work (planning + retrieval + synthesis) can take tens of seconds.
During that time the user might edit the definition or another refresh might
complete. The freeze captures exactly what was asked at the moment the refresh
started. The settle checks that nothing changed. If something did, the
candidate is discarded — it's cheaper to re-run than to reconcile.

---

## Tools

The synthesis call receives these tools. More will be added as the capability
matures (e.g. a tool to read Structured Data entries, a tool to evaluate a
Formula expression).

### `retrieve`

Search the project Knowledge lattice. The lattice is a hierarchical clustering
of embedded text windows from all admitted sources. Retrieval performs
best-first descent from the corpus tier, scores windows by cosine similarity
to the query embedding, assembles overlapping windows into contiguous verbatim
regions, and returns the top-ranked regions with their source identity and
exact text (byte offsets).

```ts
{
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
}
```

### `read`

Read a line range from a specific resource. The model specifies lines to read
rather than byte offsets — line numbers are the natural coordinate system for
text. The capability translates line numbers to the underlying file access.

```ts
{
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
        description: "The resource's stable ID (sourceId, connector entry ID, etc.)."
      },
      resourceKind: {
        type: "string",
        description: "The resource kind, e.g. 'general::file::text', 'connector::file::text'."
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
}
```

### `list_evidence`

Return the current set of evidence accumulated so far in this synthesis run.
The model can call this to review what it already has before deciding what
additional retrieval or reading to do.

```ts
{
  name: "list_evidence",
  description:
    "Return the current list of evidence items accumulated during this " +
    "synthesis. Each item includes the resource identity, span, relevance " +
    "rank, and contribution. Use this to review what you already have before " +
    "doing additional retrieval or reading.",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
}
```

The `list_evidence` handler returns the current in-progress evidence array from
the ongoing tool loop. The model can see what it has and decide whether to
retrieve more, read more, or proceed to the final answer.

---

## Model Prompts

### Planning prompt

**System:**

```
You are a retrieval planner. Your job is to produce a set of search queries
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
of those facts. For example, if the prior output says "Revenue was $1.2M in
Q3 2025", plan a query for "Q3 2025 revenue". The prior output is retrieval
context only — it is not factual authority. You are planning how to check it,
not assuming it is correct.

Do not answer the prompt. Do not infer facts. Your sole output is the list of
queries.
```

**User:**

```
PROMPT:
{{prompt}}

PRIOR OUTPUT:
{{stabilisationText}}
```

When `stabilisationText` is empty, `PRIOR OUTPUT` is `(none)`.

### Synthesis prompt

**System:**

```
You answer a user's prompt. You have access to grounding material and tools.
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
explanation of what is missing or conflicting, based only on the grounding.
```

**User:**

```
PROMPT:
{{prompt}}

PRIOR OUTPUT:
{{stabilisationText}}

GROUNDING REGIONS:
{{groundingRegions}}
```

When `stabilisationText` is empty, `PRIOR OUTPUT` is `(none)`.

### Planning schema

```ts
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
```

After decoding, the capability trims whitespace from every query, removes
empty strings, deduplicates exact duplicates, and enforces the max count.

### Synthesis schema

```ts
const synthesisSchema = {
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
        required: ["resourceId", "resourceKind", "span", "relevanceRank", "contribution"],
        properties: {
          resourceId: { type: "string" },
          resourceKind: { type: "string" },
          resourceRevision: {
            type: "number",
            description: "The resource revision at read time, if known."
          },
          sourceId: {
            type: "string",
            description:
              "The Knowledge source ID when this evidence came from lattice " +
              "retrieval. Omit for read-tool evidence."
          },
          span: {
            type: "object",
            additionalProperties: false,
            required: ["kind"],
            properties: {
              kind: {
                type: "string",
                enum: ["bytes", "lines"],
                description:
                  "\"bytes\" for lattice retrieval spans, " +
                  "\"lines\" for read-tool spans."
              },
              start: { type: "integer", minimum: 0 },
              end: { type: "integer", minimum: 0 },
              startLine: { type: "integer", minimum: 1 },
              endLine: { type: "integer", minimum: 1 }
            },
            description:
              "For bytes: provide start, end, and omit startLine/endLine. " +
              "For lines: provide startLine, endLine, and omit start/end."
          },
          relevanceRank: {
            type: "integer",
            minimum: 1,
            description: "1 = most informative. Ties allowed; array is ordered."
          },
          contribution: {
            type: "string",
            description: "One sentence: specifically what this resource contributed."
          }
        }
      }
    }
  }
} as const;
```

After decoding, the capability validates:
- Every evidence item has non-empty `resourceId` and `resourceKind`.
- `span.kind` is `"bytes"` or `"lines"` with the correct fields present.
- `relevanceRank` values are positive integers.
- `status` is one of the three valid values.
- When `status` is `"ok"`, `text` is non-empty.

---

## Change Operations

The closed vocabulary of canonical mutations:

```ts
type DerivedOutputChangeOperation =
  | { type: "declare"; output: DerivedOutput }
  | { type: "update-definition"; outputId: string; definition: DerivedOutputDefinition }
  | { type: "begin-refresh"; outputId: string; frozenDefinitionRevision: number }
  | { type: "publish-revision"; outputId: string; revision: DerivedOutputRevision }
  | { type: "mark-stale"; outputId: string; reason: string }
  | { type: "mark-failed"; outputId: string; diagnostic: { code: string; message: string } }
  | { type: "delete"; outputId: string };
```

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/derived-outputs` | Declare an output and run its first refresh. |
| GET | `/derived-outputs?id=` | Read output metadata and freshness. |
| GET | `/derived-output-revisions?outputId=&revision=` | Read one immutable revision. |
| PATCH | `/derived-output-definition` | Update prompt, scope, or stabilisation text. |
| POST | `/derived-output-refresh` | Run the refresh pipeline. |
| DELETE | `/derived-outputs` | Hard delete. |

---

## Jobs

| Job | Queue | Effect |
|-----|-------|--------|
| `derived-outputs.declare` | serial → concurrent → serial | Persist identity, freeze, plan, retrieve, synthesise, settle. |
| `derived-outputs.read` | concurrent | Read metadata or one revision without mutation. |
| `derived-outputs.update-definition` | serial | Apply compare-and-swap, mark head stale. |
| `derived-outputs.refresh` | serial → concurrent → serial | Freeze, plan, retrieve, synthesise, settle conditionally. |
| `derived-outputs.delete` | serial | Hard delete. |

---

## SQL Tables

### derived_outputs

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PRIMARY KEY | Random 16-byte hex. |
| kind | TEXT NOT NULL | `"prompt"` initially. |
| prompt | TEXT NOT NULL | The user's question or prompt. |
| context_entries | TEXT NOT NULL | JSON array of `ContextEntry`. |
| stabilisation_text | TEXT NOT NULL DEFAULT '' | |
| definition_revision | INTEGER NOT NULL DEFAULT 1 | |
| head_revision | INTEGER NOT NULL DEFAULT 0 | 0 until first successful refresh. |
| freshness_state | TEXT NOT NULL DEFAULT 'current' | |
| freshness_last_checked_at | TEXT | |
| freshness_stale_since | TEXT | |
| freshness_diagnostic_code | TEXT | |
| freshness_diagnostic_message | TEXT | |
| created_at | TEXT NOT NULL | |
| updated_at | TEXT NOT NULL | |

### derived_output_revisions

| Column | Type | Notes |
|--------|------|-------|
| output_id | TEXT NOT NULL | FK to derived_outputs.id. |
| revision | INTEGER NOT NULL | 1-based, monotonic. |
| definition_revision | INTEGER NOT NULL | Frozen at generation time. |
| content_text | TEXT NOT NULL | |
| evidence | TEXT NOT NULL | JSON array of `DerivedEvidence`. |
| status | TEXT NOT NULL | `ok`, `insufficient`, `contradiction`. |
| created_at | TEXT NOT NULL | |
| PRIMARY KEY | (output_id, revision) | |

### derived_output_refresh_attempts

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PRIMARY KEY | |
| output_id | TEXT NOT NULL | FK to derived_outputs.id. |
| frozen_definition_revision | INTEGER NOT NULL | |
| frozen_context_digest | TEXT NOT NULL | |
| candidate_revision | INTEGER | Null if synthesis failed. |
| candidate_status | TEXT | |
| settled | INTEGER NOT NULL DEFAULT 0 | 1 = became the head. |
| discarded_reason | TEXT | |
| usage_prompt_tokens | INTEGER NOT NULL DEFAULT 0 | |
| usage_completion_tokens | INTEGER NOT NULL DEFAULT 0 | |
| usage_total_tokens | INTEGER NOT NULL DEFAULT 0 | |
| usage_reasoning_tokens | INTEGER NOT NULL DEFAULT 0 | |
| started_at | TEXT NOT NULL | |
| completed_at | TEXT | |

---

## How resources consume Derived Outputs

A resource (Document, Slides, Spreadsheet) stores a `DerivedOutputRef`:

```ts
// Inside a Document Block, Slide element, or Spreadsheet cell:
{
  derivedOutput: {
    outputId: "a1b2c3...",
    appliedRevision: 3
  }
}
```

When the resource wants to refresh:

1. It calls `POST /derived-output-refresh`.
2. If `newHeadRevision > appliedRevision`, the resource appends its own
   ChangeSet advancing `appliedRevision` to the new head.
3. The resource renders `DerivedOutputRevision.content.text`.

Derived Outputs never mutates resource state. The resource pulls.

---

## Design decisions

1. **Evidence, not findings.** The model's structured output includes both the
   answer and the evidence that supports it — together. Evidence is the
   provenance for the output. The term "findings" is reserved for a different
   concept elsewhere in the product.

2. **Stabilisation text, not output shape.** Rather than a separate schema or
   template language, the prior answer text IS the shape. The model is
   instructed to preserve structure and wording, changing only what the
   grounding requires. The user hand-edits the stabilisation text through the
   definition update endpoint to guide tone and structure.

3. **The model produces evidence.** The synthesis model decides which resources
   were informative and ranks them. The capability validates structure but does
   not curate the list. This keeps provenance genuinely reflective of what the
   model used.

4. **Span, not excerpt.** Evidence records exact spans — byte offsets for
   lattice retrieval, line numbers for `read` calls. These are precise
   coordinates the frontend can use to navigate to the exact location in the
   resource. There is no summarised or hand-written text field.

5. **sourceId for staleness tracking.** Evidence from lattice retrieval carries
   the Knowledge `sourceId`. When a source changes in the lattice, the
   staleness mechanism can cross-reference changed sources against derived
   outputs that depend on them. The exact communication pattern (push vs pull)
   will be designed later; the field is there to enable it.

6. **Output vs Revision split.** `DerivedOutput` is the mutable identity
   (prompt, scope, freshness). `DerivedOutputRevision` is one frozen answer.
   They are separate types because the output is a saved query you might update
   and re-run, while revisions are the answer history. The output has fields
   like `freshness` and `definitionRevision` that don't apply to a frozen
   revision; the revision has `content`, `evidence`, and `status` that don't
   apply to the mutable output.

7. **Tool set is extensible.** `retrieve`, `read`, and `list_evidence` cover
   the initial surface. Additional tools (read structured data, evaluate
   formula, etc.) will be added as needed without changing the pipeline shape.

8. **Separate from Knowledge.** Knowledge owns the lattice and retrieval.
   Derived Outputs owns the prompt → retrieval → synthesis → provenance
   pipeline. This keeps Knowledge focused and keeps the generation lifecycle in
   one place.

9. **Immutable revisions.** Every generation produces a new revision. The head
   pointer advances. Past revisions and their evidence are always inspectable —
   the user can see what changed between refreshes and what evidence supported
   each answer.

10. **Hard delete.** No soft delete. If a resource held a ref to a deleted
    output, it renders a broken-reference state — the same pattern used
    elsewhere for deleted resources.

11. **Staleness is lazy.** The capability does not automatically re-run the
    pipeline when a dependency changes. It marks the output stale. A future
    Automation capability, or a user-triggered refresh, decides when to re-run.

12. **Serial → concurrent → serial jobs.** Follows the established pattern:
    freeze inputs on the serial queue, do expensive model work on the concurrent
    pool, settle the result on the serial queue with compare-and-swap.

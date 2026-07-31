# Document capability — Prompt refresh

## Vocabulary and boundary

This design uses deliberately separate terms:

- **Evidence** is the distinct Evidence capability and its canonical objects.
- **Source** is an object owned by Sources or another capability.
- **Lattice grounding region** is a text region returned by Knowledge retrieval.
  It contains exact text, an origin/version, and a locator. It is the only
  factual input to Prompt resolution.

`DocumentContext` is a Document-owned `{ id, kind }` value. Every Prompt Block
stores a list of them and passes that list unchanged to Knowledge. The initial
use is direct Resource scoping, for example
`{ id: "<document-id>", kind: "document" }`. Document does not read those
Resources. Knowledge translates the list into retrieval scope and ignores
out-of-scope lattice artifacts during descent. Material absent from the scoped
Knowledge result is not available to Prompt resolution.

## Prompt Block

A Prompt Block is a first-class Block type. Its `content` is ordinary editable
canonical text with marks and styles. It is not a separate generated-display
field.

```text
Prompt Block
  ├─ editable content
  └─ PromptDefinition
       ├─ instruction
       ├─ DocumentContext[]
       ├─ optional persona
       ├─ definition/content revisions
       └─ last accepted lattice-grounding result
```

The configured input is an instruction plus `DocumentContext[]`. Each entry has
only `id` and `kind`; there is no subkind. An empty list adds no restriction and
therefore searches the whole already project-scoped lattice. The shape is
expected to move into a shared Context library later without changing stored
Prompt definitions.

The required Knowledge API and descent changes are tracked in
[Knowledge Context-scoping TODO](../knowledge-context-scoping-todo.md).

A direct text edit keeps the Block as a Prompt Block and increments
`contentRevision`; a definition edit increments `definitionRevision`.
Normalization ensures a Prompt Block always has at least one text atom, even
when its content is initially empty.

## Initial generation versus refresh

Both cases use the same retrieval and settlement machinery. The refresh planner
also receives the frozen editable text so it can retrieve updates for the
specific entities already present in the Block. Synthesis uses one of two
prompts:

| Kind | Selection rule | Planning input | Synthesis input |
| --- | --- | --- | --- |
| `initial` | No `lastResolution` and current editable text is empty | instruction | instruction + lattice grounding |
| `refresh` | A prior resolution or any current editable text exists | instruction + current text as retrieval context | instruction + lattice grounding + current text as an editorial baseline |

The initial prompt writes the first grounded answer. The refresh prompt asks the
reasoning model to retain the baseline's structure, tone, and user additions
while making the smallest necessary factual update. Current text is an editorial
baseline, never factual grounding.

A resolution may be scheduled manually or automatically:

| Trigger | Admission rule |
| --- | --- |
| `manual` | Always resolves. |
| `automatic` | Coalesced after a referenced Context/resource or Knowledge-lattice publication; may skip when that triggering scope/grounding manifest is already represented by the accepted resolution. |

## Resolution process

```text
serial request
  → load Prompt Block
  → choose initial or refresh
  → freeze definition, content, revisions, and template/schema digests
  → persist idempotent attempt

concurrent resolution
  → Intelligence.reasonStructured(plan messages with frozen content, plan schema)
  → Knowledge.retrieveMany(queries, { contexts: frozenContexts })
  → Intelligence.reasonStructured(initial or refresh messages, synthesis schema)
  → validate the structured value
  → derive atom-local patches from current text → candidate text
  → persist proposal

serial settlement
  → reload Prompt Block
  → definition revision and content revision still equal frozen values?
       yes: append prompt.apply-refresh ChangeSet
       no:  mark proposal stale; make no Document mutation
```

`retrieveMany` returns both exact lattice grounding regions and the
`KnowledgeScopeManifest` produced from the frozen context list. This is the
planned Knowledge extension recorded in the linked TODO; there is no
intermediate Document Context service.

The reasoning model decides which changes are supported by the retrieved
grounding. Document validates only the structured contract and backend safety.
For a refresh, it serializes `InlineContent` into `PromptEditableText`: text
atoms become the editorial baseline and Formula/reference atoms become protected
tokens. The candidate must retain every protected token unchanged and in order.
Document then derives minimal atom-local `PromptTextPatch` operations.

At settlement, `prompt.apply-refresh` contains the exact patches and a
`PromptResolution` containing the Knowledge scope manifest,
lattice-grounding manifest, resolution kind, and prompt/schema digests. It
increments `contentRevision`, sets `lastResolution`, and becomes an ordinary
reversible ChangeSet.

If a user edits the Prompt text or definition after resolution begins, the
proposal remains inspectable but cannot settle. A subsequent resolution starts
from the newer text.

## Structured reasoning contract

All model calls use Platform Intelligence's existing strict structured-reasoning
method:

```ts
intelligence.reasonStructured(
  signal,
  {
    cast: {
      purpose:
        | "document.prompt.plan"
        | "document.prompt.initial"
        | "document.prompt.refresh",
      strength,
      speed,
    },
    messages,
  },
  schema,
);
```

The injected `Intelligence` instance sends the schema as the provider's strict
`json_schema` response format and returns decoded JSON plus normalized usage.
The prompt therefore describes the reasoning task; it does not ask the model to
"return JSON." The schema enforces the JSON shape.

### Retrieval-plan schema

The runtime constructs `maxItems` from its configured query bound:

```ts
const createPromptPlanSchema = (maxQueries: number) =>
  ({
    type: "object",
    additionalProperties: false,
    required: ["queries"],
    properties: {
      queries: {
        type: "array",
        description:
          "Distinct search queries needed to retrieve lattice grounding for the current instruction.",
        minItems: 1,
        maxItems: maxQueries,
        items: {
          type: "string",
          description: "One concise, keyword-rich retrieval query.",
          minLength: 1,
        },
      },
    },
  }) as const;
```

After decoding, Document trims every query, rejects empty strings, deduplicates
exact duplicates, and enforces the configured count again.

### Synthesis schema

Initial generation and refresh intentionally share one result type:

```ts
const promptSynthesisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "candidateText"],
  properties: {
    status: {
      type: "string",
      description:
        "Whether the lattice grounding supports the requested answer, is insufficient, or conflicts on the requested point.",
      enum: ["ok", "insufficient", "contradiction"],
    },
    candidateText: {
      type: "string",
      description:
        "The complete text that should appear in the Prompt Block after this resolution.",
    },
  },
} as const;
```

Document validates the decoded object against its local DTO schema as well. For
a refresh it additionally verifies that protected inline-item tokens remain
unchanged and ordered before deriving patches.

## Complete model prompts

These are versioned runtime templates. Each attempt and accepted resolution
records the prompt and schema digests used.

### Retrieval planning

System message:

```text
You plan bounded retrieval for an editable Document Prompt Block.

Write concise, keyword-rich search queries that would retrieve the material
needed to answer CURRENT INSTRUCTION. Cover distinct facts or subquestions
rather than writing near-duplicate queries.

When an EDITORIAL BASELINE is present, use its named entities, dates, measures,
and other specific claims to plan queries for the current version of those
facts. The baseline is retrieval context only, not factual authority.

Do not answer the instruction. Do not infer facts. Your sole job is to plan
retrieval queries.
```

User message:

```text
CURRENT INSTRUCTION:
{{instruction}}

EDITORIAL BASELINE:
{{editorialBaseline.text}}
```

For initial generation, `{{editorialBaseline.text}}` is `(none)`.

### Initial grounded generation

System message:

```text
You write the initial content of an editable Document Prompt Block.

LATTICE GROUNDING REGIONS are the only authority for factual claims. Follow
CURRENT INSTRUCTION using those regions. Never invent a fact or use outside
knowledge.

Set status to "ok" when the grounding supports the requested answer. Set it to
"insufficient" when it does not. Set it to "contradiction" only when grounding
regions conflict on the exact requested point.

When status is "ok", write the requested answer directly. When status is
"insufficient" or "contradiction", write one concise explanation based only on
the grounding.
```

User message:

```text
CURRENT INSTRUCTION:
{{instruction}}

LATTICE GROUNDING REGIONS:
{{groundingRegions}}
```

### Grounded stable refresh

System message:

```text
You update an editable Document Prompt Block.

You receive CURRENT INSTRUCTION, an EDITORIAL BASELINE, and LATTICE GROUNDING
REGIONS. The grounding regions are the only authority for facts you add or
change. The editorial baseline is not factual authority: it shows the current
wording, organization, formatting, and user additions that should remain stable
whenever possible.

Follow these rules:

1. Answer CURRENT INSTRUCTION using the grounding regions. Never invent a fact
   or use outside knowledge.
2. Preserve the baseline's headings, order, paragraph shape, wording, tone,
   formatting markers, and user additions unless a grounding region requires a
   factual change. Make the smallest change that updates the relevant fact.
3. Do not rephrase, reorganize, summarize, or expand stable text merely to make
   it sound new. Do not mention that anything changed, was previously different,
   or was refreshed.
4. Protected tokens such as {{formula:...}} and {{reference:...}} are exact
   placeholders for inline items. Preserve every protected token unchanged and
   in the same order.
5. Set status to "ok" when the grounding supports an answer. Set it to
   "insufficient" when the grounding does not support the requested answer.
   Set it to "contradiction" only when grounding regions conflict on the exact
   requested point.
6. For "insufficient" or "contradiction", preserve a non-empty editorial
   baseline unchanged.
```

User message:

```text
CURRENT INSTRUCTION:
{{instruction}}

EDITORIAL BASELINE:
{{editorialBaseline.text}}

LATTICE GROUNDING REGIONS:
{{groundingRegions}}
```

`{{groundingRegions}}` renders one `[region-id] text` line per retrieved region,
or `(none)` when retrieval is empty.

When a Prompt chooses a persona, its resolved instructions are inserted as a
style-only subsection of the applicable synthesis system message. The standard
grounding, status, stability, and protected-token rules remain authoritative.

## Attempt records and recovery

```ts
interface PromptRefreshAttempt {
  id: string;
  documentId: string;
  promptBlockId: string;
  clientRequestId: string;
  requestDigest: string;
  trigger: "manual" | "automatic";
  resolutionKind: "initial" | "refresh";
  frozenDocumentRevision: number;
  frozenDefinitionRevision: number;
  frozenContentRevision: number;
  frozenDefinitionDigest: string;
  frozenContexts: DocumentContext[];
  frozenContent: InlineContent;
  promptDigest: string;
  schemaDigest: string;
  state:
    | "requested"
    | "resolving"
    | "proposed"
    | "settled"
    | "failed"
    | "stale"
    | "canceled";
  queries?: string[];
  resolution?: PromptResolution;
  patches?: PromptTextPatch[];
  diagnostic?: PromptDiagnostic;
  settledChangeSetId?: string;
}
```

Acceptance, resolution, and settlement have separate idempotent receipts. The
attempt is operational state; the accepted `prompt.apply-refresh` ChangeSet is
canonical history. Restart recovery resumes an incomplete stage from its
receipt.

## Automatic refresh

The rebuildable prompt dependency index maps typed IDs from the frozen
`DocumentContext[]` and source versions from each accepted Knowledge scope/grounding
manifest to Prompt Blocks. Relevant resource or Knowledge publications may
enqueue an automatic refresh. The index is only a scheduler optimization;
resolution still passes the current context list to Knowledge and performs a fresh
scoped retrieval before it can write.

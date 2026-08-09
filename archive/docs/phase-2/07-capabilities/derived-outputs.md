# Derived Outputs

*Verified against source at commit ef6d462, 2026-08-09.*

A Derived Output is a prompt-driven answer with evidence provenance —
`domain/model.ts:1-2` says exactly that. A caller declares a prompt and a Context scope; a refresh
freezes that scope, plans retrieval queries, retrieves from the Knowledge lattice, synthesises an
answer with four tools, validates that every cited span actually came back from something the
pipeline retrieved or read, and publishes it as the next immutable numbered revision — or discards
the whole attempt because the definition, the head, or the Knowledge generation moved underneath
it. The mutable definition and the immutable revision chain are two different things with two
different clocks, and keeping them apart is the single most important thing to understand about
this capability.

---

## 1 · At a glance

| | |
| --- | --- |
| **Shape** | Hybrid — flat files at the module root plus a `domain/model.ts`. No `application/`, no `ports/` directory, no `wire/` |
| **Endpoints** | **7** — 3 POST, 2 GET, 1 PATCH, 1 DELETE |
| **DB file** | `./data/derived-outputs.db`, opened at [`1-init/create/derived-outputs.ts:10,19`](../../../apps/backend/src/1-init/create/derived-outputs.ts) |
| **Tables** | **9** — 8 declared in `sqlite-store.ts:49-166` plus the shared history table, all prefixed `do_<sha256(projectId)[0:16]>_` |
| **Revision model** | A mutable `DerivedOutputDefinition` behind a `definitionRevision` optimistic lock; an append-only `_revisions` chain numbered from 1 that is never reused; a separate resource `revision` for history; three separate idempotency-claim tables; a three-way CAS at settle time |
| **Test files (tests)** | [`derived-outputs.test.ts`](../../../apps/backend/test/capabilities/derived-outputs.test.ts) — 1,169 lines, **17 tests, 17 pass, 0 fail** |
| **Source files / lines** | **5 / 2,837** for `3-capabilities/derived-outputs/`. Add `4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts` (206) and `1-init/create/derived-outputs.ts` (30) for everything it owns: **7 / 3,073** |
| **Module `docs/`** | 6 files, 742 lines — accurate and explicitly self-critical (§10.10) |
| **Status** | Complete and wired. **No HTTP endpoint forwards an idempotency key**, so replay safety exists only for Document's in-process calls |

Per-file sizes, `wc -l`:

| File | Lines | What it holds |
| --- | ---: | --- |
| [`derived-outputs.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/derived-outputs.ts) | **1,342** | Config, the `ResourceReader` port, the service interface, two system prompts, two JSON schemas, every validator, `DerivedOutputServiceImpl`, four tool builders, the factory |
| [`sqlite-store.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/sqlite-store.ts) | 1,034 | Nine tables, three claim protocols, the settle/fail CAS |
| [`domain/model.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/domain/model.ts) | 261 | Every domain type and six error classes |
| [`store.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/store.ts) | 157 | The `DerivedOutputStore` port — 17 methods |
| [`index.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/index.ts) | 43 | The barrel |

`derived-outputs.ts` is the largest non-store file in the backend. See §10.9 for the size problem
and what the current line ranges actually are.

---

## 2 · Domain model

### 2.1 The output, and its three counters

```ts
export interface DerivedOutput {
  readonly id: string;                  // random 16-byte hex
  readonly kind: DerivedOutputKind;
  readonly revision: number;            // current resource revision
  readonly definition: DerivedOutputDefinition;
  readonly headRevision: number;        // 0 until first successful refresh
  readonly freshness: DerivedOutputFreshness;
  readonly createdAt: string;           // ISO-8601
  readonly updatedAt: string;           // ISO-8601
}
```

`model.ts:10-19`. `DerivedOutputKind = "prompt"` is the only kind (`model.ts:6`), commented
*"// extensible: future kinds are additive"*.

Three independent counters live on one object. Conflating any two of them will produce a wrong
description of this capability:

| Counter | Meaning | Starts | Advances on |
| --- | --- | ---: | --- |
| `revision` | resource/aggregate revision — the history clock | 1 | *every* accepted current-state mutation: definition update, publish, owned failure, **and every Knowledge invalidation** |
| `definition.definitionRevision` | optimistic lock on the definition | 1 | an accepted `updateDefinition` only |
| `headRevision` | the latest published answer number | **0** | a successful publish, always `previous + 1` |

`id` is `randomUUID().replace(/-/g, "").slice(0, 32)` (`derived-outputs.ts:595`) — a UUIDv4 with
its dashes stripped and truncated, so 122 bits of entropy, not the 128 that "random 16-byte hex"
suggests.

### 2.2 The definition — mutable

```ts
export interface DerivedOutputDefinition {
  /** The user's question or prompt. */
  readonly prompt: string;

  /** Scope for Knowledge retrieval. Empty = everything in the project lattice. */
  readonly contextEntries: ContextEntry[];

  /**
   * Prior output text used to stabilise refreshes.
   *
   * On first run this is empty. After the first successful revision, the
   * answer text becomes the stabilisation text. The user may hand-edit it
   * through the definition update endpoint.
   */
  readonly stabilisationText: string;

  /** Incremented on every definition update. Used as an optimistic lock. */
  readonly definitionRevision: number;
}
```

`model.ts:23-41`, comments verbatim. An **empty** `contextEntries` array is not "no scope" — it is
"the whole project lattice", and `Knowledge.resolveScope` snapshots every current source for it
(`0-platform/knowledge/knowledge.ts:247-257`). Only `undefined` means no scope, and a refresh with
no scope throws.

### 2.3 The revision — immutable

```ts
export interface DerivedOutputRevision {
  readonly outputId: string;
  readonly revision: number;            // 1-based, monotonic — never reused
  readonly definitionRevision: number;  // frozen at generation time
  readonly content: string;             // the answer text
  readonly evidence: DerivedEvidence[]; // ranked most → least informative
  readonly status: DerivedOutputStatus;
  readonly createdAt: string;           // ISO-8601
}

export type DerivedOutputStatus =
  | "ok"            // answer produced with grounding
  | "insufficient"  // grounding did not support an answer
  | "contradiction"; // grounding conflicted on the requested point
```

`model.ts:45-58`. Status is stored **per revision** (`_revisions.status`), never on the output. The
synthesis prompt is what actually defines the three values, `derived-outputs.ts:168-172`, verbatim:

> "Set status to "ok" when the grounding supports an answer. Set it to
> "insufficient" when the grounding does not contain enough to answer. Set it to
> "contradiction" only when grounding regions directly conflict on the point the
> prompt asks about. When status is not "ok", the text should be one concise
> explanation of what is missing or conflicting, based only on the grounding."

`validateSynthesis` (`derived-outputs.ts:527-554`) enforces the union membership, a non-blank
`text`, and one more rule that matters:

```ts
if (result.status === "ok" && evidence.length === 0) {
  throw new Error("A successful synthesis must cite trusted evidence");
}
```

### 2.4 Evidence and its two span kinds

```ts
/**
 * One piece of grounded information the model used. Carries enough identity
 * for the frontend to render a link to the actual resource. The model
 * produces this list as part of the structured synthesis output.
 */
export interface DerivedEvidence {
  readonly resourceId: string;
  readonly resourceKind: string;
  readonly resourceRevision?: number;
  readonly span: DerivedEvidenceSpan;
  readonly sourceId?: string;
  readonly relevanceRank: number;
  readonly contribution: string;
}
```

`model.ts:62-99`. Two field comments carry decisions.

`span` (`model.ts:77-83`):

> ```
>   /**
>    * The exact span of the resource that was informative.
>    *
>    * For Knowledge lattice retrieval, this is a UTF-16 code-unit range, which
>    * is the coordinate system used by JavaScript string slicing in Knowledge.
>    * For `read` tool calls, this is a line-range span.
>    */
> ```

`sourceId` (`model.ts:86-91`):

> ```
>   /**
>    * The Knowledge sourceId this evidence came from, when it originated from
>    * a retrieval call (plan queries or the `retrieve` tool). This is the
>    * identifier Knowledge uses internally. It exists so staleness propagation
>    * can cross-reference changed sources against their derived outputs.
>    */
> ```

**That stated purpose is not implemented.** Invalidation is project-wide and ignores
`mutation.sourceId` entirely — see §7.2 and §10.2.

`relevanceRank` (`model.ts:94`): *"1 = most informative. The array is ordered; ties are allowed."*

The union is exactly two variants, closed (`model.ts:101-118`):

```ts
export type DerivedEvidenceSpan = DerivedTextSpan | DerivedLineSpan;

export interface DerivedTextSpan {
  readonly kind: "characters";
  readonly start: number;  // UTF-16 code-unit offset, inclusive
  readonly end: number;    // UTF-16 code-unit offset, exclusive
}

/** @deprecated Use DerivedTextSpan; Knowledge has never emitted byte offsets. */
export type DerivedByteSpan = DerivedTextSpan;

export interface DerivedLineSpan {
  readonly kind: "lines";
  readonly startLine: number;  // 1-based, inclusive
  readonly endLine: number;    // 1-based, inclusive
}
```

A `characters` span comes from Knowledge lattice retrieval — the plan queries and the `retrieve`
tool. A `lines` span comes from a successful `read` tool call, and only from there. There is no
third source.

One read-side shim exists, `sqlite-store.ts:212-222`, comment verbatim:

> ```
> // Legacy rows called these JavaScript string offsets "bytes". They were
> // always UTF-16 offsets, so normalise the label on read.
> ```

It rewrites a stored `kind: "bytes"` to `"characters"` on the way out. **No write path can produce
`"bytes"`** — `parseEvidenceSpan` accepts only the two live kinds. This is pure
backward-compatibility for rows written before the rename, and `DerivedByteSpan` itself has zero
consumers (§10.8).

### 2.5 Freshness — a cached signal, not a lock

```ts
/**
 * A cached signal. Updated by lattice change events and refresh lifecycle.
 * Recomputing it would require re-running the full pipeline.
 */
export interface DerivedOutputFreshness {
  readonly state: "current" | "stale" | "refreshing" | "failed";
  readonly lastCheckedAt: string | null;
  readonly staleSince?: string;
  readonly diagnostic?: { readonly code: string; readonly message: string };
}
```

`model.ts:122-134`. Every transition, taken from the SQL:

| To | Written by | Line | Side effects |
| --- | --- | ---: | --- |
| `refreshing` | **`declare` only** | `derived-outputs.ts:609-612` | `lastCheckedAt: null` |
| `current` | the publish CAS | `sqlite-store.ts:758-762` | sets `lastCheckedAt`; **clears** `staleSince` and both diagnostic columns |
| `stale` | `updateOutputDefinition` | `sqlite-store.ts:440-444` | sets `lastCheckedAt` **and** `staleSince` to `updatedAt`; clears diagnostics |
| `stale` | Knowledge invalidation | `sqlite-store.ts:559-567` | `staleSince = COALESCE(freshness_stale_since, ?)` — preserves the *first* stale time; clears diagnostics; **does not touch `lastCheckedAt`** |
| `failed` | the fail CAS | `sqlite-store.ts:860-871` | sets `lastCheckedAt`; **nulls `staleSince`**; writes `freshness_diagnostic_code` / `_message` |

Two consequences worth stating plainly:

- **`refresh` never sets `refreshing`.** Only `declare` does. There is no in-flight lock derivable
  from `freshness`, and a second concurrent refresh is fenced at settle time, not at start time.
- **Knowledge invalidation has no `WHERE` clause** (`sqlite-store.ts:559-567`). It sets `stale` on
  every row, including one that is currently `refreshing` because it was just declared.

### 2.6 `DerivedOutputRef` — what a host stores

```ts
/**
 * What a Document, or any future host capability, stores to reference a
 * Derived Output.
 */
export interface DerivedOutputRef {
  readonly outputId: string;
  readonly appliedRevision: number;
}
```

`model.ts:138-145`. Two consumers exist in `src/`, both type-level:

| Consumer | Where |
| --- | --- |
| Document | `document/domain/model.ts:10,177` — `PromptBlock.output`; `:380` — `{ type: "prompt.apply-derived-output"; blockId; output }` |
| Slides | `slides/domain/model.ts:9,223` — `{ kind: "prompt"; output }`; `:516` — `{ type: "prompt.apply-derived-output"; site; output }` (Slides is unreachable — see [slides.md](slides.md)) |

`appliedRevision` is an **adoption pointer**: the host holds one specific answer revision and
decides when to move to a newer head. **Derived Outputs never writes into a host.** Deleting or
purging an output does not rewrite any `DerivedOutputRef`; the host is left holding an
`outputId` that now 404s while `GET /derived-output-revisions` for the same id still returns 200
(§6.3).

### 2.7 Requests, options, the attempt record, and the errors

Requests and options (`model.ts:149-181`): `DeclareDerivedOutputRequest {prompt, contextEntries?,
stabilisationText?}`, `UpdateDefinitionRequest {prompt, contextEntries, stabilisationText,
expectedDefinitionRevision}`, three single-field `…Options {idempotencyKey}` types (declare,
refresh, definition update), and `DerivedRefreshResult {output, revision?, skipped}`.

`RefreshAttempt` (`model.ts:185-200`) is the operational record: `id`, `outputId`,
`frozenDefinitionRevision`, `frozenContextDigest`, `candidateRevision?`, `candidateStatus?`,
`settled`, `discardedReason?`, **four** usage token counts, `startedAt`, `completedAt?`.
`costUsd` is not among them — see §10.1.

`DerivedOutputChangeOperation` (`model.ts:204-211`) is a seven-variant union exported from the
barrel with **zero consumers**. It reads like the start of an operation/replay log that was never
built. Dead (§10.8).

Six error classes (`model.ts:215-261`):

| Class | Ctor field(s) | Message |
| --- | --- | --- |
| `DerivedOutputNotFoundError` | `outputId` | `Derived output not found: ${outputId}` |
| `DerivedOutputConflictError` | `outputId` | `Derived output conflict: ${outputId}` |
| `DerivedOutputIdempotencyConflictError` | `idempotencyKey` | `Derived output declaration key was reused with different input` |
| `DerivedOutputRefreshIdempotencyConflictError` | `idempotencyKey` | `Derived output refresh key was reused with different input` |
| `DerivedOutputDefinitionUpdateIdempotencyConflictError` | `idempotencyKey` | `Derived output definition-update key was reused with different input` |
| `StaleDefinitionRevisionError` | `outputId`, `expected`, `actual` | `Stale definition revision for ${outputId}: expected ${expected}, got ${actual}` |

**`DerivedOutputConflictError` is raised nowhere in the repository.** `grep -rn "new
DerivedOutputConflictError" src test` returns zero hits. It is exported and HTTP-mapped to 409, and
it is dead (§10.3).

---

## 3 · `stabilisationText` and the drift-damping intent

Two mechanisms, and they are the clearest expression of intent in the capability.

**Mechanism 1 — the store fills it once, then never again.** Inside the publish CAS,
`sqlite-store.ts:754-757`:

```sql
stabilisation_text = CASE
  WHEN stabilisation_text = '' THEN ?
  ELSE stabilisation_text
END,
```

The first successful answer becomes the stabilisation text; every later refresh leaves it alone.
The only way to change it afterwards is `updateDefinition`, which replaces it wholesale.

**Mechanism 2 — both prompts are told to treat it as shape, not truth.**

Planner, `derived-outputs.ts:113-116`, verbatim:

> "When a PRIOR OUTPUT is present, use its named entities, dates, measures, and
> other specific claims to plan queries that would retrieve the current version
> of those facts. The prior output is retrieval context only — it is not factual
> authority. You are planning how to check it, not assuming it is correct."

Synthesiser, `derived-outputs.ts:144-151`, verbatim:

> "When a PRIOR OUTPUT is present, it shows the answer from the last refresh.
> Your goal is to preserve its structure, headings, order, paragraph shape,
> wording, and tone — making the smallest factual change that the grounding
> requires. Do not rephrase, reorganise, or expand stable text merely to make it
> sound new. Do not mention that anything changed, was previously different, or
> was refreshed. If the prior output says "Revenue was $1.2M" and the only new
> fact is that it is now $1.3M, your output should be identical except for the
> number."

The text is injected into both user messages as
`` `PROMPT:\n${prompt}\n\nPRIOR OUTPUT:\n${stabilisationText || "(none)"}` `` (`:813`, `:925`).

**This is a prompt-level guarantee only.** Nothing in the code diffs the new answer against the old
one, constrains how far it may move, or verifies that anything was preserved. If the model rewrites
the whole answer, the pipeline publishes the rewrite.

---

## 4 · Evidence validation: the model may select provenance, never invent it

The mechanism is a **trusted candidate set** built only from things the pipeline actually observed
in this attempt.

```ts
interface EvidenceCandidate {
  readonly resourceId: string;
  readonly resourceKind: string;
  readonly resourceRevision?: number;
  readonly sourceId?: string;
  readonly span: DerivedEvidenceSpan;
}
```

`derived-outputs.ts:328-334`. Candidates enter at exactly three places:

| # | Source | Line | Span kind |
| ---: | --- | ---: | --- |
| 1 | every region returned by a **planned** `knowledge.retrieve` | 849-855 | `characters` |
| 2 | every region returned by the **`retrieve` tool** | 1131-1133 | `characters` |
| 3 | every successful **`read` tool** call | 1225-1236 | `lines` |

`candidateForRegion` (`:389-407`) is itself a fence — a region whose source is not in the frozen
manifest aborts the attempt:

```ts
const resource = scope.resources.find(c => c.sourceId === region.sourceId);
if (!resource) {
  throw new Error("Knowledge returned a source outside the frozen scope");
}
```

The dedup key is `` `${resourceKind}:${resourceId}:${spanKey(span)}` `` where `spanKey` is
`characters:start:end` or `lines:startLine:endLine` (`:336-344`); `addCandidate` (`:346-353`) is a
linear scan-and-skip.

`validateEvidence` (`:447-525`) then applies ten rules per item, in order:

| # | Rule | Line | Error |
| ---: | --- | ---: | --- |
| 1 | the item is a plain object | 458-460 | `Invalid evidence item` |
| 2 | non-empty `resourceId`/`resourceKind`, safe-int `relevanceRank ≥ 1`, non-blank `contribution` | 462-472 | `Invalid evidence fields` |
| 3 | `resourceRevision` is null/undefined or a safe int ≥ 1 | 474-481 | `Invalid evidence resource revision` |
| 4 | `sourceId` is null/undefined or a non-empty string | 482-488 | `Invalid evidence source ID` |
| 5 | the span parses — `characters` needs `start ≥ 0` and `end > start`; `lines` needs `startLine ≥ 1` and `endLine ≥ startLine` | 490, 409-445 | `Invalid character evidence span` / `Invalid line evidence span` / `Unknown evidence span kind` |
| 6 | **the (kind, id, span) key matches a trusted candidate** | 496-498 | `Evidence did not originate from grounding or a tool result` |
| 7 | no candidate is cited twice | 499-500 | `Duplicate evidence item` |
| 8 | a supplied `resourceRevision` **exactly equals** the candidate's | 502-505 | `Evidence revision did not match the trusted candidate` |
| 9 | a supplied `sourceId` **exactly equals** the candidate's | 506-508 | `Evidence source ID did not match the trusted candidate` |
| 10 | ranks are non-decreasing across the array | 509-511 | `Evidence must be ordered by relevance rank` |

The accepted record is then built **from the candidate, not from the model's object**
(`:513-521`): `resourceId`, `resourceKind`, `resourceRevision`, `span` and `sourceId` all come from
the trusted candidate, and only `relevanceRank` and the trimmed `contribution` come from the model.
**The model cannot fabricate provenance at all — it can only select and annotate it.**

The regression test is *"untrusted evidence spans fail safely after all pipeline usage is
counted"*, and *"one frozen manifest scopes initial retrieval and every synthesis evidence tool"*
covers the manifest side.

One honest gap: the prompt asks for *"exactly one sentence"* per `contribution` (`:154-156`,
`:165-166`); the code only checks non-blank after trim.

---

## 5 · Operations

### 5.1 `DerivedOutputService` — 10 methods

`derived-outputs.ts:72-96`:

```ts
declare(request, options?): Promise<DerivedOutput>
get(id): Promise<DerivedOutput | null>
getRevision(id, revision): Promise<DerivedOutputRevision | null>
updateDefinition(id, request, options?): Promise<DerivedOutput>
refresh(id, options?): Promise<DerivedRefreshResult>
recordKnowledgeSourceMutation(mutation): void        // synchronous
delete(id): Promise<void>
purge(id): Promise<void>
pruneHistory(cutoff): Promise<number>
purgeExpired(cutoff): Promise<number>
```

`declare` (`:590-649`) allocates the id, writes `revision: 1`, `definitionRevision: 1`,
`headRevision: 0`, `freshness: {state: "refreshing", lastCheckedAt: null}`. It performs **no
validation of the prompt** — an empty prompt is accepted, with no length bound (§10.5).

Document consumes a narrower port, `document/ports/derivedOutputs.ts` — `DocumentDerivedOutputs`
mirrors seven methods and deliberately omits `recordKnowledgeSourceMutation`, `pruneHistory` and
`purgeExpired`. It is a types-only import, so Document and Derived Outputs never link at runtime
except through the object `startBackend.ts:102-111` hands over.

### 5.2 `DerivedOutputStore` — the port

`store.ts:96-157`, 17 methods across four groups: output CRUD and the three `claim*` protocols;
`getKnowledgeGeneration` / `markAllOutputsStaleForKnowledgeChange`; `getRevision` /
`getHeadRevision`; attempt insert/update plus `settleRefresh`, `failRefresh`, and `close`.

Two of those are dead: `getHeadRevision` is declared (`store.ts:133`) and implemented
(`sqlite-store.ts:586-593`) and **never called**; `close()` is implemented but **not on the service
interface**, so the running backend can never close the handle (§10.8).

Two of the port's doc comments state the design in one line each:

> `/** Compare, publish, update freshness, and settle the attempt atomically. */` — `store.ts:150`
>
> `/** Record a failed computation without overwriting a newer refresh state. */` — `store.ts:153`

### 5.3 The refresh pipeline, in order

`refresh(id, options?)` — `derived-outputs.ts:728-1045`. Config: `maxPlanQueries` and
`maxToolRounds`, both defaulting to 8 (`loadBackendConfig.ts:234-237`; `derivedOutputs` is a
defaults-only section and does **not** appear in `etc/configuration.yaml`).

1. `store.getOutput(id)`; missing → `DerivedOutputNotFoundError` (`:733-734`).
2. Optional claim/replay (`:736-760`). A completed claim returns the stored result and logs
   `derived-outputs.refresh.replayed`.
3. **Freeze** (`:762-776`): `frozenDefRev`, `frozenHeadRev`,
   `frozenKnowledgeGeneration = store.getKnowledgeGeneration()`, a 32-hex `attemptId`, and
   `contextDigest = sha256(JSON.stringify(entries.map(e => ({id, kind})).sort(by kind, then id)))`.
4. `insertAttempt` (`:777-789`) — `settled: false`, all four usage counters 0.
5. `stage = "resolve_scope"` → `knowledge.resolveScope(definition.contextEntries)`. Comment
   verbatim (`:796-797`):
   > ```
   > // Resolve nested Context and every resource kind exactly once. Passing an
   > // explicit empty array snapshots the current full-project source set.
   > ```
   A `null` result throws `"Derived refresh requires a frozen scope"`.
6. `stage = "plan"` → `intelligence.reasonStructured(undefined, {cast: {purpose:"general",
   strength:"medium", speed:"high"}, messages}, planSchema)`. `planSchema` (`:176-193`) demands
   `{queries: string[]}` with `minItems: 1, maxItems: 8` — **the 8 is hard-coded in the schema**
   and separately enforced by `config.maxPlanQueries`. `validateQueries` (`:376-387`) trims, drops
   empties, dedupes, slices to the max, and throws *"Retrieval plan contained no usable queries"*
   if nothing survives. Query text is never logged.
7. `stage = "retrieve"` → the queries run **sequentially** in a `for` loop (`:841-847`), each with
   `{scopeManifest: frozenScope}`. Regions and embedding usage accumulate.
8. Candidates are built from every region; `regionToGroundingText` (`:355-374`) renders each region
   as `[resourceId: …, resourceKind: …, sourceId: …, characters: <start>-<end>]` followed by the
   verbatim text, joined by blank lines. The `resourceId`/`resourceKind` prefix is present only
   when a candidate matched the region.
9. **The no-evidence short-circuit** (`:870-918`). Comment verbatim:
   > ```
   > // Short-circuit: if no regions were found, skip synthesis.
   > // Produce a guaranteed "no evidence" response without calling a model.
   > ```
   Content is the exact literal `"Found no evidence to support a response."`, `evidence: []`,
   `status: "insufficient"`, `revision: frozenHeadRev + 1`. It goes through the **same**
   `settleRefresh` path and logs `path: "no_evidence"`. Test: *"a no-evidence refresh atomically
   publishes an insufficient revision and telemetry"*.
10. `stage = "synthesise"` → `buildToolSet`, then `reasonWithToolsStructured(undefined, {cast:
    {purpose:"general", strength:"high", speed:"medium"}, messages}, toolSet,
    createSynthesisSchema(), config.maxToolRounds)`. Comment at `:929`:
    > `// Every tool closes over this exact manifest and trusted-candidate set.`
11. `validateSynthesis` → a candidate `{revision: frozenHeadRev + 1, definitionRevision:
    frozenDefRev, content, evidence, status}`.
12. `stage = "settle"` → `store.settleRefresh(...)`. Logs `derived-outputs.refresh.completed` with
    `path: "synthesis"`, `outcome: settled.state`, and — **only when published** — `revision`.
13. **catch** (`:1013-1044`): builds `diagnosticMessage = \`Refresh failed during ${stage}.\``,
    calls `store.failRefresh(...)` with `diagnosticCode: "refresh_failed"`, logs
    `derived-outputs.refresh.failed` at **error** with `{stage, outcome, errorKind: err.name}`,
    and **returns** `failed.result`. It does **not** rethrow.

The five `stage` values that can appear in a diagnostic are `resolve_scope`, `plan`, `retrieve`,
`synthesise`, `settle`. **The provider's exception message is never stored and never logged** —
only the error's class name and the stage.

Usage accounting (`addUsage`, `:563-574`) sums `promptTokens`, `completionTokens`, `totalTokens`,
`reasoningTokens` and `costUsd` across planning, **every** Knowledge retrieval, **every** tool
retrieval, and synthesis into one accumulator. `costUsd` is logged and **not persisted** (§10.1).

### 5.4 The four synthesis tools

`buildToolSet` (`:1080-1093`) binds four tools, all closing over the same manifest and candidate
array:

| Tool | Input | Guard | Effect |
| --- | --- | --- | --- |
| `retrieve` | `{query: string}` | non-blank after trim, else `"Invalid retrieval query"` | scoped `knowledge.retrieve`; every region becomes a candidate via `candidateForRegion`, which throws on an out-of-manifest source; logs `derived-outputs.tool.retrieve` |
| `read` | `{resourceId, resourceKind, startLine, endLine}` | safe ints, `startLine ≥ 1`, `endLine ≥ startLine`, else `"Invalid resource read request"`; then manifest membership, else `"Resource is outside the frozen scope"`; then a `null` from the reader → `"Scoped resource could not be read"` | adds a `lines` candidate carrying `descriptor.sourceId` and `content.revision`; logs `derived-outputs.tool.read` |
| `list_resources` | `{}` | the reader's output must be an exact subset of `scope.resources` on all four descriptor fields, else `"Resource reader returned an item outside the frozen scope"` | logs `derived-outputs.tool.list-resources` |
| `list_evidence` | `{}` | none | returns a copy of every candidate so far (`sourceId ?? null`); logs `derived-outputs.tool.list-evidence` |

The `read` tool checks manifest membership **twice** — once itself (`:1209-1214`) and once inside
`RuntimeResourceRegistry.read` (`1-init/create/resource-reader.ts:170-178`). Only the second emits
`resources.read.denied`, and it is unreachable through this tool because the first check has
already thrown.

### 5.5 The read boundary this capability depends on

`ResourceReader` (`derived-outputs.ts:48-58`) — `describeSource`, `list`, `read` — is satisfied by
[`1-init/create/resource-reader.ts`](../../../apps/backend/src/1-init/create/resource-reader.ts)
(349 lines), the only enforcement point for a scoped read. Its whole authorisation model is
membership in the frozen manifest (`:170-178`):

```ts
const descriptor = scope.resources.find(
  (resource) =>
    resource.resourceId === resourceId &&
    resource.resourceKind === resourceKind
);
if (!descriptor) {
  this.logger.debug("resources.read.denied", { resourceId, resourceKind });
  return null;
}
```

Derived Outputs' own `docs/invariants.md:44` names this correctly: *"This is retrieval containment, not
end-user authentication."* Three things a reader must not overstate:

- `resources.read.denied` is logged at **`debug`**, so on a non-debug level denied reads are
  invisible.
- It covers **only** the manifest-membership failure. Every later refusal — wrong revision, a
  connector source-id mismatch, missing content — returns `null` **with no log line at all**.
- **There is no Document content reader.** A `document`-kinded resource passes the manifest gate,
  falls through all three typed branches and returns `null`. Lattice retrieval on a Document still
  works and its regions are citable; the `read` tool cannot open one.

`ResourceReader`, `ResourceDescriptor` and `ResourceContent` are declared **inside** the 1,342-line
service file (`derived-outputs.ts:46-68`) rather than in a `ports/` directory — a shape difference
from every layered capability, called out in
[03-capability-anatomy.md](../03-capability-anatomy.md).

---

## 6 · Endpoints

`registerDerivedOutputEndpoints(registry, service, logger)` —
[`registerDerivedOutputEndpoints.ts`](../../../apps/backend/src/4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts).
Seven `registry.register` call sites, no loops, all `responseMode: "inline"`.

| # | Method + path | Job `name` | Queue | Line | Success | Does |
| ---: | --- | --- | --- | ---: | --- | --- |
| 1 | `POST /derived-outputs` | `derived-outputs.declare` | concurrent | 40 | **201** | declares, then runs the first refresh **inline** and returns the `DerivedRefreshResult` |
| 2 | `GET /derived-outputs?id=` | `derived-outputs.get` | concurrent | 71 | 200 / 404 | reads the output |
| 3 | `GET /derived-output-revisions?outputId=&revision=` | `derived-outputs.get-revision` | concurrent | 90 | 200 / 404 | reads one immutable answer |
| 4 | `PATCH /derived-output-definition` | `derived-outputs.update-definition` | **serial** | 116 | 200 | one SQLite CAS on `definitionRevision`; also marks freshness stale |
| 5 | `POST /derived-output-refresh` | `derived-outputs.refresh` | concurrent | 145 | 200 | runs the pipeline |
| 6 | `DELETE /derived-outputs?id=` | `derived-outputs.delete` | **serial** | 164 | **204** | logical delete |
| 7 | `POST /derived-outputs/purge` | `derived-outputs.purge` | **serial** | 179 | **204** | requires a prior logical delete |

Facts that matter to a caller:

- **A `201` can carry a failure.** Endpoint 1 calls `declare` and then `refresh(output.id)`
  unkeyed, and `refresh` swallows pipeline errors and returns a `failed` result. Only errors thrown
  by `declare` — or by `refresh`'s pre-pipeline checks — reach `deError`.
- **`id` arrives two different ways.** Endpoints 2 and 6 read it from the **query string**;
  4, 5 and 7 read it from the **body**.
- **Endpoint 4 silently clears the scope on a malformed body.** `:129-131` hard-defaults
  `contextEntries` to `[]` when the body value is not an array. Because an empty array means "the
  whole project lattice", a typo does not fail — it widens the scope to everything.
- **No endpoint forwards an idempotency key.** Endpoint 4 passes no options at all despite
  `updateDefinition` accepting them (§10.4).
- Endpoint 1 is the only one that logs on error (`derived-outputs.declare.error`, at `error`).

The function logs its own manifest at registration (`:194-205`):
`derived-outputs.endpoints.registered { count: 7, endpoints: [...] }`. **The `7` is a hard-coded
literal**, not `endpoints.length` and not derived from the registry — it can drift from reality
silently, exactly as Investigation's `count: 23` already has.

### 6.1 Error mapping

`deError` (`:15-30`):

| Thrown | Status | `error` |
| --- | ---: | --- |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| `DerivedOutputNotFoundError` | 404 | `not_found` |
| `DerivedOutputConflictError` | 409 | `conflict` — **unreachable, never thrown** |
| `DerivedOutputIdempotencyConflictError` | 409 | `idempotency_mismatch` |
| `StaleDefinitionRevisionError` | 409 | `stale_revision` |
| everything else | 400 | `bad_request` |

**Two of the six error classes are missing from this ladder**:
`DerivedOutputRefreshIdempotencyConflictError` and
`DerivedOutputDefinitionUpdateIdempotencyConflictError` would fall through to 400. Both are
unreachable over HTTP today because no endpoint passes keys, but both are reachable through
Document. `4-job-wiring/document/registerDocumentEndpoints.ts:4,64` maps the definition-update one
to 409; **`DerivedOutputRefreshIdempotencyConflictError` is mapped nowhere in the codebase**
(§10.4).

### 6.2 Log events

| Level | Events |
| --- | --- |
| info | `derived-outputs.declare`, `derived-outputs.update-definition`, `derived-outputs.update-definition.replayed`, `derived-outputs.refresh.replayed`, `derived-outputs.refresh.completed`, `derived-outputs.knowledge.invalidated`, `derived-outputs.delete`, `derived-outputs.purge`, `derived-outputs.endpoints.registered` |
| debug | `derived-outputs.get`, `derived-outputs.get-revision`, `derived-outputs.plan`, `derived-outputs.retrieve`, `derived-outputs.synthesise`, `derived-outputs.tool.{retrieve,read,list-resources,list-evidence}` |
| error | `derived-outputs.refresh.failed`, `derived-outputs.declare.error` |

No prompt text, no query text, no answer text and no region text is logged — only lengths, counts,
digests and token totals. Nothing here passes a `detail` label, so every record is `shape` by
default; see [06-platform-services.md](../06-platform-services.md).

### 6.3 The asymmetry a client will hit

**`GET /derived-output-revisions?outputId=X&revision=N` still returns 200 for a logically deleted
output**, because `getRevision` queries `_revisions` and never consults `_outputs`.
`GET /derived-outputs?id=X` returns 404 for the same output at the same moment. That is the whole
point of the retained-answer root (§7.3), not an oversight: an answer a Document adopted stays
readable after the output is deleted, until someone purges it.

---

## 7 · Persistence

`SQLiteDerivedOutputStore` —
[`sqlite-store.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/sqlite-store.ts).
Header comment (`:1-3`): *"SQLite implementation of DerivedOutputStore. // Table prefix =
SHA-256(projectId).slice(0, 16). // Pattern follows SQLiteDataStore and SQLiteContextStore."*

Pragmas (`:235-238`): `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000`, and
**`foreign_keys = ON`** — the last is not optional here. Every cascade below depends on it.

### 7.1 The nine tables

| # | Table | Key | Holds | FK |
| ---: | --- | --- | --- | --- |
| 1 | `do_<p>_resources` | `id` PK, `created_at` | **the stable root.** One row per output id, never removed by a logical delete | — |
| 2 | `do_<p>_outputs` | `id` PK | the live aggregate: `kind`, `revision CHECK (>= 1)`, `prompt`, `context_entries` JSON, `stabilisation_text`, `definition_revision`, `head_revision`, five `freshness_*` columns, `created_at`, `updated_at` | `id → _resources(id) ON DELETE CASCADE` |
| 3 | `do_<p>_runtime_state` | `singleton` PK `CHECK (singleton = 1)` | `knowledge_generation INTEGER >= 0`, seeded by `INSERT OR IGNORE (1, 0)` | — |
| 4 | `do_<p>_declarations` | `idempotency_key` PK | `request_digest`, `output_id` **UNIQUE**, `created_at` | `output_id → _outputs(id) ON DELETE CASCADE` |
| 5 | `do_<p>_refresh_claims` | `idempotency_key` PK | `request_digest`, `output_id`, `result_json`, `created_at`, `completed_at` | `output_id → _outputs(id) ON DELETE CASCADE` |
| 6 | `do_<p>_definition_update_claims` | `idempotency_key` PK | same shape as 5 | `output_id → _outputs(id) ON DELETE CASCADE` |
| 7 | `do_<p>_revisions` | PK `(output_id, revision)` | **the immutable answers**: `definition_revision`, `content_text`, `evidence_json`, `status`, `created_at` | `output_id → **_resources**(id) ON DELETE CASCADE` |
| 8 | `do_<p>_refresh_attempts` | `id` PK | `output_id`, `frozen_definition_revision`, `frozen_context_digest`, `candidate_revision`, `candidate_status`, `settled`, `discarded_reason`, **four** token columns, `started_at`, `completed_at` | `output_id → _outputs(id) ON DELETE CASCADE` |
| 9 | `do_<p>_history` | PK `(resource_kind, resource_id, revision)` | the shared revision-history schema; `resource_kind` is always `"derived-output"` | — |

Only two indexes beyond the primary keys: `…_refresh_claims_output` and
`…_definition_update_claims_output`, both on `(output_id, created_at)` (`:112-113`, `:130-131`).

The claim tables carry identical CHECK constraints (`:86-89`, `:98-101`, `:116-119`):

```sql
idempotency_key TEXT PRIMARY KEY
  CHECK (length(trim(idempotency_key)) > 0 AND length(idempotency_key) <= 512),
request_digest  TEXT NOT NULL
  CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
```

plus, on tables 5 and 6, `CHECK ((result_json IS NULL) = (completed_at IS NULL))` — **a claim is
either fully pending or fully completed, never half**.

**`_revisions` is the only table pointed at `_resources` instead of `_outputs`.** That single FK
choice is what makes §7.3 work.

### 7.2 Three claim tables, because their replay payloads differ

| Table | Digest input | Replay payload | Claim type |
| --- | --- | --- | --- |
| `_declarations` | `sha256({prompt, contextEntries, stabilisationText})` — `derived-outputs.ts:286-295` | the `DerivedOutput` itself, re-read with `getOutput(existing.output_id)` | `DerivedOutputDeclarationClaim {output, requestDigest, created}` |
| `_refresh_claims` | `sha256({outputId})` — `:297-301` | `DerivedRefreshResult` as canonical JSON in `result_json` | `DerivedOutputRefreshClaim {requestDigest, result?, created}` |
| `_definition_update_claims` | `sha256({outputId, prompt, contextEntries, stabilisationText, expectedDefinitionRevision})` — `:303-317` | `DerivedOutput` as canonical JSON in `result_json` | `DerivedOutputDefinitionUpdateClaim {requestDigest, result?, created}` |

The refresh digest covers **only the output id**. Reusing a refresh key for a *different* output is
what throws; reusing it for the same output is a legitimate replay no matter what changed in
between. `_declarations` has no `result_json` because the output row itself is the durable result —
`claimDeclaration` re-reads it and throws
`` `Derived output declaration '${key}' references a missing output` `` (`sqlite-store.ts:306-309`)
if it is gone.

All three claim methods run as `db.transaction(...).immediate()`. Key validation
(`derived-outputs.ts:319-326`) is non-blank after trim and ≤ 512 UTF-8 bytes, mirroring the SQL
CHECK.

**A claim is not single-flight.** The module's own `docs/invariants.md:82` says so and the code
agrees: `claimRefresh` inserts a pending row and returns `{created: true}`; a second caller sees
`{created: false}` with no `result` and **proceeds to recompute**. The claim guarantees that the
*settled result* is replayed identically, not that the work happens once.

**Who actually supplies keys.** Not HTTP. The only real users are Document's attempt stages, in
`3-capabilities/document/application/documentService.ts`:

| Key | Call | Line |
| --- | --- | ---: |
| `` `document:prompt-definition:${canonicalDigest({documentId, requestId})}` `` | `updateDefinition` | 1367 |
| `` `document:prompt-create:${attempt.id}` `` | `declare` | 1516 |
| `` `document:prompt-create:${attempt.id}:refresh` `` | `refresh` | 1528 |
| `` `document:prompt-refresh:${attempt.id}:refresh` `` | `refresh` | 1619 |

Document's own comment at `:1355-1357` explains why it bothers:

> ```
> // Derived Outputs is idempotent on this key alone, so a retry after a
> // crash between this call and recordSubmission below simply replays the
> // already-completed result rather than reapplying the definition twice.
> ```

### 7.3 The three-way CAS settle

`settleRefresh(input)` — `sqlite-store.ts:679-794`.

A **pre-transaction shape check** throws outside the transaction (`:680-686`):

```ts
if (
  input.revision.outputId !== input.outputId ||
  input.revision.definitionRevision !== input.expectedDefinitionRevision ||
  input.revision.revision !== input.expectedHeadRevision + 1
) {
  throw new Error("Refresh candidate does not match its frozen output state");
}
```

Then, inside one `db.transaction(...).immediate()`, four ordered fences:

| Order | Fence | Line | `SettleRefreshState` | Attempt `discarded_reason` |
| ---: | --- | ---: | --- | --- |
| 0 | the output row still exists | 692-703 | `output_deleted` | `"output_deleted"` |
| 1 | `definition_revision === expectedDefinitionRevision` | 706-720 | `definition_changed` | `"definition_changed"` |
| 2 | `head_revision === expectedHeadRevision` | 722-733 | `head_changed` | `"head_changed"` |
| 3 | `getKnowledgeGeneration() === expectedKnowledgeGeneration` | 735-746 | `knowledge_changed` | `"knowledge_changed"` |

Existence is really a fourth check; the *three-way CAS* proper is **definition × head × knowledge
generation**. Fence 0 is the only one that returns `output: null` and falls back to
`input.fallbackOutput` for the claim payload.

When all four pass:

1. `insertRevision(input.revision)` (`:748`);
2. `archiveOutput(output, completedAt)` — a history snapshot of the **pre-publish** aggregate
   (`:749`);
3. the publish `UPDATE` (`:750-775`), which sets `head_revision`, `revision = revision + 1`, the
   conditional `stabilisation_text` from §3, `freshness_state = 'current'`, `lastCheckedAt`, and
   nulls `staleSince` plus both diagnostic columns — **guarded a second time in its own `WHERE`**:
   `WHERE id = ? AND definition_revision = ? AND head_revision = ?`;
4. `if (published.changes !== 1) throw new Error("Derived refresh publish CAS changed an
   unexpected row count")` (`:776-778`);
5. `settleAttempt(input, true, null)`;
6. `completeRefreshClaim(...)`.

`failRefresh` (`:796-898`) runs **the same four fences in the same order**, then archives and
writes `freshness_state = 'failed'` with the same doubly-guarded `WHERE` and its own
`if (markedFailed.changes !== 1) throw` (`:881-883`). Its result type is
`{state: "failed" | Exclude<SettleRefreshState, "published">, output, result}` (`store.ts:52-56`),
and a *successful* fail-marking returns `skipped: false` (`:893`) — **`skipped` means "a concurrent
change won", not "nothing happened"**.

Four tests pin this: *"concurrent refreshes publish one revision and leave current freshness"*,
*"an old-definition refresh cannot roll back a newer published definition"*, *"a late failing
attempt cannot overwrite a newer successful head"*, and *"Knowledge add and remove invalidate
outputs and fence an in-flight refresh"*.

### 7.4 Knowledge generation and project-wide invalidation

`markAllOutputsStaleForKnowledgeChange(changedAt)` — `sqlite-store.ts:546-573`, one immediate
transaction:

1. `SELECT * FROM _outputs` and `archiveOutput` **every** row;
2. `UPDATE _runtime_state SET knowledge_generation = knowledge_generation + 1 WHERE singleton = 1`;
3. `UPDATE _outputs SET freshness_state = 'stale', revision = revision + 1,
   freshness_stale_since = COALESCE(freshness_stale_since, ?), diagnostics NULL, updated_at = ?`
   — **with no `WHERE` clause at all**;
4. return `{generation, outputsMarkedStale: stale.changes}`.

The wiring is one line, `1-init/startBackend.ts:95-97`:
`knowledge.onSourceMutation(m => derivedOutputs.recordKnowledgeSourceMutation(m))`, where
`KnowledgeSourceMutation = {operation: "add" | "remove", sourceId}`
(`0-platform/knowledge/types.ts:150-153`). The handler (`derived-outputs.ts:1047-1056`) is
**synchronous** and logs `derived-outputs.knowledge.invalidated {operation, generation,
outputsMarkedStale, durationMs}`.

**`mutation.sourceId` is never read.** One added file marks every derived output in the project
stale, bumps every output's `revision`, and writes one history snapshot per output. This is
deliberate as an implementation, and it is exactly the behaviour `DerivedEvidence.sourceId` was
introduced to make unnecessary (§10.2).

### 7.5 Logical delete, the retained-answer root, and the purge cascade

`deleteOutput(id, deletedAt)` (`sqlite-store.ts:472-492`), one immediate transaction: read the row;
`archiveOutput` → a history snapshot at `N`; `insertHistoryDeletion` at `N + 1` with no snapshot;
`DELETE FROM _outputs WHERE id = ?`; throw if `changes !== 1`; return `N + 1`.

With `foreign_keys = ON`, that one `DELETE` decides everything:

| Cascaded away | Retained |
| --- | --- |
| `_declarations` rows for this output | `_resources` row — **the root** |
| `_refresh_claims` rows | `_revisions` rows — every published answer, its content, evidence and status |
| `_definition_update_claims` rows | `_history` rows — every snapshot plus the terminal record |
| `_refresh_attempts` rows | |

So a logical delete removes the *operational* state and keeps the *answers*. That is what makes the
§6.3 asymmetry correct rather than a bug. A side effect worth knowing: the claim rows are wiped, so
an idempotency key that was already used for a deleted output becomes reusable — harmless only
because the service checks the output exists before claiming (`derived-outputs.ts:675`, `:733-734`).

`purgeOutput(id)` (`:494-514`) is the second cascade:

1. `if (this.getOutput(id)) throw new ResourceNotDeletedError("derived-output", id)` — a live
   output is refused;
2. the latest history record must exist and be `deleted`, else
   `ResourceHistoryNotFoundError("derived-output", id)`;
3. then, in one immediate transaction, `purgeResourceHistory(...)` and
   `DELETE FROM _resources WHERE id = ?` — **which cascades `_revisions` away**.

**Two cascades, two roots, in that order:** logical delete cascades the operational tables off
`_outputs`; purge cascades the answer table off `_resources`. Test: *"logical delete removes current
operational state while purge removes retained output history"*.

`pruneHistory(cutoff)` (`:516-523`) passes the predicate
`(_kind, id) => this.getOutput(id) !== null`, so it prunes snapshots only for outputs that are
still live and never removes a still-deleted resource's terminal record. `purgeExpired(cutoff)`
(`:525-533`) lists expired terminal deletions, filters to `resourceKind === "derived-output"`, and
calls `purgeOutput` on each.

Both are reached only through the shared scheduler —
`bindResourceRetentionPort("derived-outputs", derivedOutputs)` at `1-init/startBackend.ts:139`,
sixth of eleven ports. Retention defaults are `revisionRetentionDays: 30` and
`sweepIntervalHours: 24` (`loadBackendConfig.ts:254-257`).

**Nothing prunes `_refresh_attempts` or the three claim tables.** The retention sweep governs the
history table and the resource root only; attempt rows and completed claims accumulate for the life
of the database.

---

## 8 · Invariants

| Invariant | Enforced at |
| --- | --- |
| A published revision number is `previousHead + 1` and never reused | pre-transaction check `sqlite-store.ts:680-686` + PK `(output_id, revision)` |
| A publish is atomic with its history snapshot, its attempt settlement and its claim completion | one `db.transaction(...).immediate()`, `sqlite-store.ts:687-793` |
| A stale definition, a moved head, a deleted output or a changed Knowledge generation discards the candidate | fences 0-3, `sqlite-store.ts:692-746` |
| The publish `UPDATE` is guarded a second time in SQL and must affect exactly one row | `sqlite-store.ts:764-778` |
| A failure cannot overwrite a newer success | `failRefresh` runs the same four fences, `sqlite-store.ts:796-898` |
| `stabilisation_text` is written once, then only by `updateDefinition` | `sqlite-store.ts:754-757` |
| A definition update is one CAS on `definition_revision` and also marks the output stale | `sqlite-store.ts:407-469`, guard at `:426-431`, `UPDATE … WHERE id = ? AND definition_revision = ?` at `:446`, `changes !== 1` throw at `:457-459` |
| Every cited evidence span originates from a region or a `read` this attempt performed | `derived-outputs.ts:496-498` |
| A cited revision and sourceId must equal the trusted candidate's | `derived-outputs.ts:502-508` |
| Accepted evidence is rebuilt from the candidate, not from the model's object | `derived-outputs.ts:513-521` |
| `status: "ok"` requires at least one evidence item | `derived-outputs.ts:550-552` |
| Knowledge may not return a source outside the frozen manifest | `derived-outputs.ts:393-398` |
| A tool may not read a resource outside the frozen manifest | `derived-outputs.ts:1209-1214` **and** `resource-reader.ts:170-178` |
| `list_resources` output must be an exact subset of the manifest | `derived-outputs.ts:1272-1283` |
| A claim's result is either fully present or fully absent | SQL `CHECK ((result_json IS NULL) = (completed_at IS NULL))` |
| A replay returns byte-identical JSON to the first caller's result | `sqlite-store.ts:974-984` |
| A claim may not change its output identity | `sqlite-store.ts:967-969`, `:1002-1004` |
| Purge refuses a live output and requires a terminal deletion record | `sqlite-store.ts:495-504` |
| An answer survives a logical delete and dies with a purge | the `_revisions → _resources` FK, `sqlite-store.ts:142-144` |

---

## 9 · Design decisions worth preserving

### On why a cascaded claim is safe

`sqlite-store.ts:964-965`, inside `completeRefreshClaim`:

> ```
> // A concurrent delete cascades the claim. The refresh remains safely
> // skipped, but there is no longer an output-scoped identity to retain.
> ```

A delete that lands mid-refresh takes the claim row with it. Rather than treating the missing row
as corruption, the method returns the in-memory result and moves on — the refresh was going to be
discarded anyway, and there is no identity left to key a replay against.

### On returning parsed JSON rather than the object you already have

`sqlite-store.ts:983`:

> `// Return the same canonical JSON shape that every later replay reads.`

`completeRefreshClaim` returns `JSON.parse(encoded)`, not the in-memory `result`. The first caller
and every replay therefore receive byte-identical shapes — `undefined` fields dropped, key order
fixed by the encoder. Without this, the first response and the replayed response could differ in
ways a client would notice. `completeDefinitionUpdateClaim` does the same (`:1020-1031`).

### On freezing the scope exactly once

`derived-outputs.ts:796-797`:

> ```
> // Resolve nested Context and every resource kind exactly once. Passing an
> // explicit empty array snapshots the current full-project source set.
> ```

and, on the Knowledge side, `0-platform/knowledge/knowledge.ts:279-281`:

> ```
> // Freeze the composed execution scope, including nested entries, public
> // resource identities, and revisions. Every query/tool in one refresh
> // receives this exact object rather than resolving Context again.
> ```

One `Object.freeze`d manifest is the unit of authorisation, the unit of provenance, and the thing
the settle fence compares against. Re-resolving Context per tool call would have made every one of
those three properties impossible to state.

### On tools closing over the manifest

`derived-outputs.ts:929`:

> `// Every tool closes over this exact manifest and trusted-candidate set.`

The tools take no scope argument. There is no way for the model to widen its own scope, because
scope is not in the tool's input schema at all.

### On a "no evidence" answer being a real published revision

`derived-outputs.ts:870-871`:

> ```
> // Short-circuit: if no regions were found, skip synthesis.
> // Produce a guaranteed "no evidence" response without calling a model.
> ```

The empty case takes the same `settleRefresh` path, consumes a revision number, and is stored with
`status: "insufficient"`. It is an answer, not an error — which is why a host holding a
`DerivedOutputRef` sees a normal head move rather than a silent no-op.

### On the deprecated span alias

`model.ts:111`:

> `/** @deprecated Use DerivedTextSpan; Knowledge has never emitted byte offsets. */`

Paired with the read-side normaliser at `sqlite-store.ts:212-213`, this is a complete, honest record
of a naming mistake: the alias stays so old code compiles, the shim stays so old rows read, and both
say in one line that the offsets were never bytes.

### On an unfinished decision left in the code

`derived-outputs.ts:646-647`, at the end of `declare`:

> ```
> // First refresh is triggered by the caller (endpoint) — or we run it
> // synchronously here. For now the endpoint will call refresh separately.
> ```

This is an explicit "not decided yet" marker in shipped code. The endpoint does call `refresh`
separately (`registerDerivedOutputEndpoints.ts:59`), and the consequence — a `201` that can carry a
failed result — is described in §6.

---

## 10 · Known gaps and defects

Collected, with everything else in the backend, in [11-known-issues.md](../11-known-issues.md).

### 10.1 `costUsd` is deliberately not persisted

`addUsage` (`derived-outputs.ts:563-574`) tracks `costUsd` across the whole pipeline and both
completion log lines emit it when it is present (`:914`, `:1009`). The `_refresh_attempts` table
has **four** token columns and no cost column (`sqlite-store.ts:147-165`), and `RefreshAttempt`
(`model.ts:185-200`) has no such field. Per-attempt cost exists only in the log file, which has no
retention (see [06-platform-services.md](../06-platform-services.md)). The module's
`docs/invariants.md:110` states this; `docs/types.md:86` does not.

### 10.2 `DerivedEvidence.sourceId`'s documented purpose is unimplemented

The field's comment says it exists *"so staleness propagation can cross-reference changed sources
against their derived outputs"* (`model.ts:86-91`). `recordKnowledgeSourceMutation`
(`derived-outputs.ts:1047-1056`) ignores `mutation.sourceId` and
`markAllOutputsStaleForKnowledgeChange` has no `WHERE` clause. **Invalidation is project-wide.**
Every output in the project goes stale, gains a revision and gains a history snapshot when any
single source is added or removed. The data needed for selective invalidation is being collected
and validated correctly; nothing consumes it.

### 10.3 `DerivedOutputConflictError` is raised nowhere

Exported from the barrel (`index.ts:36`), mapped to HTTP 409
(`registerDerivedOutputEndpoints.ts:22-23`), and constructed by nothing in `src/` or `test/`. Dead.

### 10.4 No HTTP endpoint forwards an idempotency key

All three claim tables are only ever written by Document's in-process calls (§7.2). A caller using
this capability purely over HTTP gets **no replay safety at all**: a retried
`POST /derived-output-refresh` runs the whole pipeline again, and a retried `POST /derived-outputs`
creates a second output.

Compounding it, two of the three idempotency-conflict errors are unmapped in `deError` and would
surface as 400 `bad_request` rather than 409 `idempotency_mismatch`, and
`DerivedOutputRefreshIdempotencyConflictError` is unmapped **everywhere in the codebase**.

### 10.5 `declare` does not validate the prompt

`derived-outputs.ts:590-649` accepts an empty string and applies no length bound. The endpoint
coerces with `String(body.prompt ?? "")` (`registerDerivedOutputEndpoints.ts:48`), so
`POST /derived-outputs` with no body at all declares an output with an empty prompt and immediately
runs a refresh against it.

### 10.6 `PATCH /derived-output-definition` silently widens the scope on a malformed body

`registerDerivedOutputEndpoints.ts:129-131` hard-defaults `contextEntries` to `[]` when the field is
not an array. Because `[]` means "the whole project lattice", a client that sends
`contextEntries: null`, or misspells the key, converts a narrowly-scoped output into a
whole-project one and gets a 200.

### 10.7 The registration manifest count is a hard-coded literal

`registerDerivedOutputEndpoints.ts:195` logs `count: 7` next to a hand-written seven-element array.
Neither is derived from the registry. Investigation has the identical pattern and its literal is
already wrong by three.

### 10.8 Dead and unreachable surface

| Symbol | Status |
| --- | --- |
| `DerivedOutputConflictError` | Exported, HTTP-mapped, never thrown (§10.3) |
| `DerivedOutputChangeOperation` (`model.ts:204-211`) | Seven-variant union on the barrel, zero consumers |
| `DerivedOutputStore.getHeadRevision` (`store.ts:133`, `sqlite-store.ts:586-593`) | Declared and implemented, never called |
| `DerivedByteSpan` (`model.ts:112`) | Deprecated alias on the barrel, zero consumers |
| `DerivedOutputStore.close()` (`store.ts:156`, `sqlite-store.ts:900-902`) | Implemented, **not on the service interface** — the running backend can never close the handle |
| The `read` tool's second manifest check | `resource-reader.ts:170-178` is unreachable from this tool; the first check at `derived-outputs.ts:1209-1214` has already thrown |
| The `document` branch of `ResourceReader.read` | There is none. A `document`-kinded read always returns `null` (§5.5) |

### 10.9 The size problem, stated honestly

`derived-outputs.ts` is **1,342 lines** and holds prompts, JSON schemas, two ports, every
validator, the service class, four tool builders and the factory. There is **no codified size rule
anywhere in `src/`** — no lint rule, no comment, no module doc states a limit. The only statement
of the expectation is on the archived page
[phase-1/claude-notes/03-capability-anatomy.md:42-57](../../phase-1/claude-notes/03-capability-anatomy.md),
which lays out the flat shape as `index.ts` + `types.ts`/`domain/model.ts` + `validation.ts` +
`store.ts` + `sqlite-store.ts` + one runtime service file, and then says this file *"is arguably due
for the layered shape"*. Derived Outputs is the only capability that both claims the flat shape and
collapses five of those roles into one file.

The archived review at
[phase-1/claude-notes/review/001-consistency-and-doc-drift.md:101-111](../../phase-1/claude-notes/review/001-consistency-and-doc-drift.md)
proposed a split and cited exact line ranges. **Only `46-69` (the ports) still resolves.** Measured
at HEAD:

| Region | Lines |
| --- | --- |
| Config | 41-44 |
| Ports (`ResourceReader`, `ResourceDescriptor`, `ResourceContent`) | 46-68 |
| Service interface | 72-96 |
| Prompts | 98-172 |
| JSON schemas | 174-278 |
| Helpers and validators | 280-574 |
| `DerivedOutputServiceImpl` | 576-1322 |
| — of which, tool builders | 1078-1321 |
| Factory | 1324-1342 |

### 10.10 Where the module's own `docs/` package is imprecise

`3-capabilities/derived-outputs/docs/` is 6 files, 742 lines, accurate, and explicitly
self-critical — it already states that HTTP does not forward idempotency options
(`types.md:82`), that some idempotency errors are unmapped (`flows.md:19`), that the one-sentence
contribution rule is unenforced (`flows.md:100`), that claims are not single-flight
(`invariants.md:82`), and that there is no Document reader (`flows.md:121`). A later pass owns those
files; four things to sharpen are recorded here.

| File | Claim | Reality |
| --- | --- | --- |
| `types.md:86` | Lists what `RefreshAttempt` persists | Correct, but should say `costUsd` is **deliberately not** persisted. `invariants.md:110` does; `types.md` does not |
| `concepts.md:19` | Knowledge generation is a project-wide counter | True, and the consequence is never stated: `DerivedEvidence.sourceId`'s documented raison d'être is unimplemented (§10.2) |
| `types.md:93` | `DerivedOutputConflictError` is "mapped by HTTP but not currently raised by service" | Stronger and still true: it is raised **nowhere in the repository** |
| `invariants.md:22` | "Output IDs are random 16-byte/32-hex identities" | `randomUUID().replace(/-/g,"").slice(0,32)` — a UUIDv4 with dashes stripped, so 122 bits, not 128 |
| `flows.md:5`, `:17` | "registers seven inline jobs" / "logs a seven-endpoint manifest" | Correct, but the `7` in the payload is hard-coded and can drift (§10.7) |
| `README.md:54-57` | Links to design drafts under `scratch/` | Those are the owner's live drafts, ahead of the code. They are not evidence for anything on this page |

---

## 11 · Where to look for what

| Concern | File |
| --- | --- |
| Every domain type, the span union, the six errors | [`domain/model.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/domain/model.ts) |
| Prompts, schemas, validators, the service, the tools | [`derived-outputs.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/derived-outputs.ts) |
| The nine tables, the claims, the settle/fail CAS | [`sqlite-store.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/sqlite-store.ts) |
| The store port and its input/result types | [`store.ts`](../../../apps/backend/src/3-capabilities/derived-outputs/store.ts) |
| HTTP and the error ladder | [`registerDerivedOutputEndpoints.ts`](../../../apps/backend/src/4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts) |
| The scoped-read boundary | [`1-init/create/resource-reader.ts`](../../../apps/backend/src/1-init/create/resource-reader.ts) |
| Construction and the Knowledge subscription | [`1-init/create/derived-outputs.ts`](../../../apps/backend/src/1-init/create/derived-outputs.ts), [`1-init/startBackend.ts:88-97`](../../../apps/backend/src/1-init/startBackend.ts) |

Related pages: [06-platform-services.md](../06-platform-services.md) for Knowledge, Intelligence and
the scope manifest, [document.md](document.md) for the only capability that supplies idempotency
keys and holds `DerivedOutputRef`s, [04-state-and-persistence.md](../04-state-and-persistence.md)
for the shared history table and the retention sweep, and
[05-async-attempt-pipeline.md](../05-async-attempt-pipeline.md) for the Document-side attempt
machinery that drives most refreshes.

There is no superseded design page for Derived Outputs. `phase-1/capabilities-old/` contains no
`derived-outputs.md` and no file in it describes this capability.

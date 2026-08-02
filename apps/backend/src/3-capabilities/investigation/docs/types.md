# Investigation types and persistence

## Public type authority

All public Investigation types originate in
[`domain/model.ts`](../domain/model.ts) and are re-exported through
[`index.ts`](../index.ts). `Question`, `Hypothesis`, and `Finding` are both the
persisted-domain and service-layer representations. SQLite row objects remain
private to [`sqliteInvestigationStore.ts`](../persistence/sqliteInvestigationStore.ts);
there are no runtime projection types.

Shared aliases are deliberately small:

```ts
type ActorId = string;
type IsoTimestamp = string;
```

The runtime validates timestamps as parseable dates and emits normalized ISO
strings. IDs are nonblank project-local strings; production creation uses
`randomUUID()`.

## Status and relationship unions

| Type | Exact values |
|---|---|
| `QuestionStatus` | `open`, `proposed`, `answered` |
| `HypothesisStatus` | `proposed`, `accepted`, `refuted`, `inconclusive` |
| `HypothesisConfidenceLevel` | `strongly_refuted`, `weakly_refuted`, `uncertain`, `weakly_supported`, `strongly_supported` |
| `FindingStatus` | `proposed`, `accepted`, `rejected` |
| `FindingRelationship` | `supports`, `refutes`, `qualifies`, `contextualizes` |

The corresponding exported constant arrays are also the source for runtime
membership guards. Deletion is absent from every status union.

## Question

```ts
interface Question {
  readonly id: string;
  readonly text: string;
  readonly context?: string;
  readonly currentAnswer?: string;
  readonly assumptions: readonly string[];
  readonly status: QuestionStatus;
  readonly tags: readonly string[];
  readonly revision: number;
  readonly createdBy: ActorId;
  readonly updatedBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
```

`context` contains framing, constraints, background, and any other information
needed to understand/research the Question. `currentAnswer` is mutable and has no
separate immutable answer entity or approval object; superseded complete Question
snapshots, including their answers, are retained in shared history. Assumptions are plain
strings.

### Question requests and filter

```ts
interface CreateQuestionRequest {
  readonly text: string;
  readonly context?: string;
  readonly assumptions?: readonly string[];
  readonly tags?: readonly string[];
}

interface UpdateQuestionRequest {
  readonly text?: string;
  readonly context?: string | null;
  readonly assumptions?: readonly string[];
  readonly tags?: readonly string[];
}

interface QuestionFilter {
  readonly status?: QuestionStatus;
  readonly tag?: string;
}
```

On update, omitted fields are unchanged and `context: null` clears Context.
Answer changes use dedicated runtime methods rather than `UpdateQuestionRequest`.
Tags are trimmed, required nonblank, and deduplicated; assumptions remain an
ordinary string list.

## Hypothesis

```ts
interface Hypothesis {
  readonly id: string;
  readonly questionIds: readonly string[];
  readonly statement: string;
  readonly rationale?: string;
  readonly assumptions: readonly string[];
  readonly status: HypothesisStatus;
  readonly confidenceLevel?: HypothesisConfidenceLevel;
  readonly revision: number;
  readonly createdBy: ActorId;
  readonly updatedBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
```

`questionIds` may be empty and is the one authority for Hypothesis-to-Question
association. IDs are trimmed and deduplicated. The current runtime does not
require the named Questions to exist when the Hypothesis is written. A
nonblank `statement` is required; rationale and categorical confidence are
optional. Assumptions remain plain strings.

### Hypothesis requests and filter

```ts
interface CreateHypothesisRequest {
  readonly questionIds?: readonly string[];
  readonly statement: string;
  readonly rationale?: string;
  readonly assumptions?: readonly string[];
  readonly confidenceLevel?: HypothesisConfidenceLevel;
}

interface UpdateHypothesisRequest {
  readonly questionIds?: readonly string[];
  readonly statement?: string;
  readonly rationale?: string | null;
  readonly assumptions?: readonly string[];
  readonly status?: HypothesisStatus;
  readonly confidenceLevel?: HypothesisConfidenceLevel | null;
}

interface HypothesisFilter {
  readonly questionId?: string;
  readonly status?: HypothesisStatus;
}
```

`null` clears rationale or confidence. Any supported status can be assigned by
update; there is no Finding prerequisite or transition-specific request type.

## Finding links

```ts
interface FindingQuestionLink {
  readonly questionId: string;
  readonly relationship?: FindingRelationship;
}

interface FindingHypothesisLink {
  readonly hypothesisId: string;
  readonly relationship?: FindingRelationship;
}
```

The ID alone means “relevant but unclassified.” These arrays live only on the
Finding. Runtime validation canonicalizes IDs and collapses duplicates by
target ID. Reverse arrays are not part of `Question` or `Hypothesis`.

## Finding references and spans

```ts
type FindingReferenceSpan =
  | { readonly kind: "characters"; readonly start: number; readonly end: number }
  | { readonly kind: "lines"; readonly startLine: number; readonly endLine: number };

type FindingReference =
  | {
      readonly kind: "resource";
      readonly resourceKind: string;
      readonly resourceId: string;
      readonly locator?: string;
      readonly resourceRevision?: number | string;
      readonly span?: FindingReferenceSpan;
      readonly note?: string;
      readonly needsReview?: boolean;
    }
  | {
      readonly kind: "url";
      readonly href: string;
      readonly observedAt: IsoTimestamp;
      readonly span?: FindingReferenceSpan;
      readonly note?: string;
      readonly needsReview?: boolean;
    };
```

Character spans require safe integers with `start >= 0` and `end > start` and
use UTF-16 `[start,end)` semantics. Line spans require safe integers with
`startLine >= 1` and `endLine >= startLine`, using inclusive one-based lines.

Resource IDs/kinds are nonblank. A numeric revision is a positive safe integer;
a string revision is nonblank. Runtime validation requires a revision for the
known kinds `collection`, `connector-item`, `context`, `deck`,
`derived-output`, `document`, `function`, `general-file`, `slide`,
`structured-data`, and `variable`, plus kinds prefixed by `connector::` or
`general::file::`. This requirement reflects owner-provided revision identity
and the current resource kinds exposed by General Files; it does not create an
Investigation revision system.

URL references accept only HTTP(S) URLs. `observedAt` is normalized to an ISO
timestamp. It records observation time but does not provide change detection.

The exported helper:

```ts
const findingNeedsReview = (finding: Finding): boolean =>
  finding.references.some((reference) => reference.needsReview === true);
```

is the only Finding-level staleness calculation. Clearing review removes the
flag rather than storing a second aggregate status.

## Finding

```ts
interface Finding {
  readonly id: string;
  readonly claim: string;
  readonly references: readonly FindingReference[];
  readonly commentary?: string;
  readonly status: FindingStatus;
  readonly tags: readonly string[];
  readonly questionLinks: readonly FindingQuestionLink[];
  readonly hypothesisLinks: readonly FindingHypothesisLink[];
  readonly knowledgeSourceId?: string;
  readonly revision: number;
  readonly createdBy: ActorId;
  readonly updatedBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
```

A Finding requires a nonblank claim and at least one validated reference.
`knowledgeSourceId` is present while acceptance is durably associated with the
stable `finding:{id}` Knowledge source. It is internal integration identity,
not a `FindingReference` or Source domain record.

### Finding requests and filter

```ts
interface ProposeFindingRequest {
  readonly claim: string;
  readonly references: readonly FindingReference[];
  readonly commentary?: string;
  readonly tags?: readonly string[];
  readonly questionLinks?: readonly FindingQuestionLink[];
  readonly hypothesisLinks?: readonly FindingHypothesisLink[];
}

interface UpdateFindingRequest {
  readonly claim?: string;
  readonly references?: readonly FindingReference[];
  readonly commentary?: string | null;
  readonly tags?: readonly string[];
  readonly questionLinks?: readonly FindingQuestionLink[];
  readonly hypothesisLinks?: readonly FindingHypothesisLink[];
}

interface FindingFilter {
  readonly status?: FindingStatus;
  readonly questionId?: string;
  readonly hypothesisId?: string;
}
```

Omitted update fields retain their values; `commentary: null` clears
commentary. Status and review flags use dedicated methods. Relationship target
existence is not a write precondition.

## Runtime contract and construction context

[`InvestigationRuntime`](../domain/model.ts) contains 28 flat methods: nine
Question methods, six Hypothesis methods, eleven Finding methods, and two shared retention
methods. Every
method returns a Promise even though the current SQLite store is synchronous,
because Knowledge operations and other adapters are asynchronous.

```ts
interface InvestigationRuntimeContext {
  readonly actorId: ActorId;
  readonly now?: () => IsoTimestamp;
  readonly generateId?: () => string;
}
```

`actorId` supplies authorship for all mutations. The optional clock and ID
factory are deterministic test seams; production startup supplies only
`config.userId` and uses the default clock/UUID generator.

## Error family

| Error | Stable code | Meaning |
|---|---|---|
| `InvestigationNotFoundError(entity,id)` | `not_found` | A required live Question, Hypothesis, or Finding is absent |
| `InvestigationInvalidInputError(message)` | `invalid_input` | Runtime input fails supported shape/value validation |
| `InvestigationInvalidOperationError(message)` | `invalid_operation` | Input shape is valid but the requested lifecycle operation is not allowed |

All extend `InvestigationError`, whose `code` is the adapter-safe
discriminant. The HTTP layer has a private `InvestigationIngressError` for raw
wire-shape failures and maps both families without matching message text.

## Store port

[`InvestigationStore`](../ports/investigationStore.ts) is one synchronous,
project-local persistence contract:

| Record | Methods |
|---|---|
| Question | `insertQuestion`, `getQuestion`, `listQuestions`, `updateQuestion`, `deleteQuestion` |
| Hypothesis | `insertHypothesis`, `getHypothesis`, `listHypotheses`, `updateHypothesis`, `deleteHypothesis` |
| Finding | `insertFinding`, `getFinding`, `listFindings`, `updateFinding`, `deleteFinding` |
| Acceptance fence | `acceptFindingIfClaimMatches` |
| Shared history | `purge`, `pruneHistory`, `expiredDeleted` |

The conditional acceptance method atomically updates a live Finding to
`accepted` only when its persisted claim still equals the text that was just
admitted to Knowledge. This narrow store primitive avoids a public record
revision/CAS abstraction.

Store `get` methods return `undefined`; the runtime converts that to `null` for
public optional reads. Current tables contain live records only.

## SQLite representation

[`SQLiteInvestigationStore`](../persistence/sqliteInvestigationStore.ts) opens
`./data/investigation.db`. The project table prefix is:

```text
inv_${sha256(projectId).slice(0, 16)}
```

The three current tables and one shared history table are created on that connection.
WAL, `busy_timeout=5000`, and `synchronous=NORMAL` are configured.

### Questions table

| Column | Representation |
|---|---|
| `id`, `text` | required text |
| `context`, `current_answer` | nullable text |
| `assumptions_json`, `tags_json` | required JSON arrays, default `[]` |
| `status` | checked `open | proposed | answered` |
| revision/authorship/timestamps | `revision`, `created_by`, `updated_by`, `created_at`, `updated_at` |

The recent index covers `(status, updated_at DESC)`.

### Hypotheses table

| Column | Representation |
|---|---|
| `id`, `statement` | required text |
| `question_ids_json`, `assumptions_json` | required JSON arrays, default `[]` |
| `rationale` | nullable text |
| `status` | checked four-value Hypothesis status |
| `confidence_level` | nullable, checked five-value category |
| revision/authorship/timestamps | same convention as Question |

The recent index covers `(status, updated_at DESC)`.

### Findings table

| Column | Representation |
|---|---|
| `id`, `claim` | required text |
| `references_json` | required JSON reference array |
| `commentary` | nullable text |
| `status` | checked `proposed | accepted | rejected` |
| `tags_json`, `question_links_json`, `hypothesis_links_json` | required JSON arrays, default `[]` for all except references |
| `knowledge_source_id` | nullable internal Knowledge identity |
| revision/authorship/timestamps | same convention as Question |

The recent index covers `(status, updated_at DESC)`. A second index covers
`knowledge_source_id` for accepted current rows.

### Shared history table

Rows are keyed by `(resource_kind, resource_id, revision)`. `snapshot` rows
contain the complete prior Question, Hypothesis, or Finding JSON; `deleted`
rows have no snapshot and terminate a deleted resource's history. Purge removes
all history rows for one resource.

There are no foreign keys or relationship tables. Reverse filtering uses
SQLite JSON functions and an `EXISTS` check for the live target. Results are
ordered by `updated_at DESC, id ASC`. `close()` is available on the concrete
store for tests/lifecycle owners but is not part of `InvestigationStore` or
`InvestigationRuntime`.

## Wire representation

Endpoint successes return canonical records directly for create/get/update or
status operations. List endpoints return `{ records: [...] }`; deletes return
HTTP 204 with `null`. The endpoint decoder builds typed requests before calling
the runtime, while the runtime repeats domain validation so in-process callers
receive the same invariants.

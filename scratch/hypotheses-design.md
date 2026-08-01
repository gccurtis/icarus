# Hypotheses Capability — Design

## Summary

Hypotheses is a small, project-scoped capability for proposed explanations or
claims that can be evaluated over time. A Hypothesis may address one Question,
several Questions, part of an answer, or connect Findings across related
Questions. It is not a one-to-one candidate answer nested under a Question.

The persisted model remains deliberately small. It records the proposition,
its rationale and assumptions, related Question IDs, its current assessment,
and an optional categorical confidence level. Findings owns the evidence
relationships; a runtime projection queries those relationships when needed.

## Outcomes

Given valid project and actor context, Hypotheses can:

- create and edit a durable proposed explanation;
- associate it with zero, one, or many Questions without nesting it under any
  one Question;
- record a simple current assessment and evidentiary direction;
- assemble related Questions and Findings for research or evaluation; and
- soft-delete it so it is absent from ordinary reads.

It does not test itself, calculate confidence, require evidence before a status
change, or enter the Knowledge lattice directly.

## Persisted model

```ts
type IsoTimestamp = string;
type ActorId = string;

type HypothesisStatus =
  | "proposed"
  | "accepted"
  | "refuted"
  | "inconclusive";

type HypothesisConfidenceLevel =
  | "strongly_refuted"
  | "weakly_refuted"
  | "uncertain"
  | "weakly_supported"
  | "strongly_supported";

interface Hypothesis {
  /** Stable project-local identity. */
  readonly id: string;

  /** Zero or more Questions to which this proposition is relevant. */
  readonly questionIds: readonly string[];

  /** The proposed explanation or claim. */
  readonly statement: string;

  /** Optional explanation of why the proposition is plausible or useful. */
  readonly rationale?: string;

  /** Plain-text assumptions. An empty list means none were recorded. */
  readonly assumptions: readonly string[];

  readonly status: HypothesisStatus;

  /** Optional categorical assessment; absent means not yet assessed. */
  readonly confidenceLevel?: HypothesisConfidenceLevel;

  readonly createdBy: ActorId;
  readonly updatedBy: ActorId;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly deletedAt?: IsoTimestamp;
}
```

`questionIds` replaces the earlier mandatory singular `questionId`. It may be
empty while a Hypothesis is being framed, and it supports one or many IDs
without a separate join entity.

Assumptions are plain strings. They do not have IDs, statuses, approval,
individual confidence, or their own lifecycle.

There is no numeric confidence field in this settled design because no current
implementation requires one. If a later concrete use needs a numeric
assessment, it should be optional, named `confidenceScore`, and documented as
an uncalibrated score rather than a probability. It must not replace
`confidenceLevel`.

## Status semantics

| Status | Meaning |
|---|---|
| `proposed` | Under consideration and not yet resolved. |
| `accepted` | Currently treated as the best-supported explanation. |
| `refuted` | Available evidence is considered sufficient to reject it. |
| `inconclusive` | It was evaluated, but evidence supports neither acceptance nor refutation. |

The service may set any of these values explicitly. It does not infer status
from Finding counts, force a transition sequence, or require an accepted
Finding before a Hypothesis can be created or reassessed.

`confidenceLevel` describes evidentiary direction; `status` records the current
conclusion. The capability does not automatically force one from the other.

Deletion is not a Hypothesis status. It sets `deletedAt`; deleted Hypotheses are
treated as absent by ordinary getters, lists, and runtime assemblers.

## Relationship ownership

Hypotheses persists `questionIds` because it owns which Questions a Hypothesis
addresses. Questions exposes the reverse list by querying Hypotheses.

Hypotheses does not persist `findingIds`. Findings owns every
Finding-to-Hypothesis relationship:

```ts
type FindingRelationship =
  | "supports"
  | "refutes"
  | "qualifies"
  | "contextualizes";

interface FindingHypothesisLink {
  readonly hypothesisId: string;
  readonly relationship?: FindingRelationship;
}

interface RelatedFindingRef {
  readonly findingId: string;
  readonly relationship?: FindingRelationship;
}
```

The optional value always reads from the Finding toward the Hypothesis. A
reverse `supports` item therefore means “the Finding supports the Hypothesis,”
not the reverse. Omission means the Finding is relevant but unclassified.

The four values have the same meaning used for Finding-to-Question links:

- `supports`: the Finding favors the claim;
- `refutes`: the Finding weighs against the claim;
- `qualifies`: the Finding narrows, conditions, or limits the claim; and
- `contextualizes`: the Finding supplies background or explains why the claim
  is worth considering without supporting or refuting it.

No larger relationship taxonomy is introduced.

## Runtime representation

The persisted Hypothesis is the editable source of truth. Evaluation and
Research receive a non-persisted projection assembled from live records:

```ts
interface RuntimeHypothesis {
  /** Includes questionIds, statement, rationale, assumptions, and assessment. */
  readonly hypothesis: Hypothesis;

  /** Live Questions resolved from Hypothesis.questionIds. */
  readonly questions: readonly Question[];

  /** Findings queried by FindingHypothesisLink.hypothesisId. */
  readonly findings: readonly {
    readonly finding: Finding;
    readonly relationship?: FindingRelationship;
  }[];
}
```

The runtime projection is assembled on demand and is not persisted. It uses
narrow readers:

```ts
interface HypothesisQuestionReader {
  get(id: string): Promise<Question | null>;
}

interface HypothesisFindingReader {
  listForHypothesis(hypothesisId: string): Promise<readonly {
    finding: Finding;
    relationship?: FindingRelationship;
  }[]>;
}
```

Deleted or unavailable Questions and Findings are omitted from ordinary
runtime projections. Their IDs may remain in the owning persisted record; no
cascade or bidirectional synchronization is required.

## Store interface

```ts
interface HypothesisStore {
  get(id: string): Hypothesis | undefined;
  list(filter?: {
    questionId?: string;
    status?: HypothesisStatus;
  }): Hypothesis[];
  insert(hypothesis: Hypothesis): void;
  update(hypothesis: Hypothesis): void;
  softDelete(id: string, deletedAt: IsoTimestamp): void;
}
```

The SQLite adapter is project-bound and synchronous. `get` and `list` return
only non-deleted rows ordered by `updatedAt` descending. Initial Question-ID
filtering may inspect the bounded JSON list in application/store code; a join
table or JSON index is not required until measurements justify it.

## Service layer

```ts
interface HypothesisService {
  create(request: CreateHypothesisRequest): Promise<Hypothesis>;
  update(id: string, request: UpdateHypothesisRequest): Promise<Hypothesis>;
  get(id: string): Promise<Hypothesis | null>;
  list(filter?: {
    questionId?: string;
    status?: HypothesisStatus;
  }): Promise<Hypothesis[]>;
  delete(id: string): Promise<void>;
}

interface HypothesisRuntimeAssembler {
  get(id: string): Promise<RuntimeHypothesis>;
}

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
```

Creation starts in `proposed`. `update` is a direct, deterministic
last-write-wins mutation; it does not calculate status or confidence from
related Findings. Unsupported status or confidence values are rejected at
ingress, but the capability adds no evidence-count gate or transition engine.

Authored mutations use the project's serial queue. Reads and runtime assembly
are concurrent.

The core service is constructed first. Composition creates
`HypothesisRuntimeAssembler` only after Questions and Findings are available,
using their narrow readers. This avoids cyclic service construction and does
not create another persistence owner.

## Endpoints

| Method | Path | Queue | Purpose |
|---|---|---|---|
| `POST` | `/hypotheses/create` | serial | Create a proposed Hypothesis. |
| `POST` | `/hypotheses/update` | serial | Edit content, Question links, status, or confidence. |
| `GET` | `/hypotheses/get?id=...` | concurrent | Read one persisted Hypothesis. |
| `GET` | `/hypotheses/list?questionId=...&status=...` | concurrent | List persisted Hypotheses. |
| `GET` | `/hypotheses/runtime?id=...` | concurrent | Assemble Questions and related Findings. |
| `DELETE` | `/hypotheses/delete?id=...` | serial | Soft-delete a Hypothesis. |

## Persistence

```sql
CREATE TABLE IF NOT EXISTS hyp_${prefix}_hypotheses (
  id                   TEXT PRIMARY KEY,
  question_ids_json    TEXT NOT NULL DEFAULT '[]',
  statement            TEXT NOT NULL,
  rationale            TEXT,
  assumptions_json     TEXT NOT NULL DEFAULT '[]',
  status               TEXT NOT NULL CHECK (
                         status IN (
                           'proposed', 'accepted', 'refuted', 'inconclusive'
                         )
                       ),
  confidence_level     TEXT CHECK (
                         confidence_level IS NULL OR confidence_level IN (
                           'strongly_refuted',
                           'weakly_refuted',
                           'uncertain',
                           'weakly_supported',
                           'strongly_supported'
                         )
                       ),
  created_by           TEXT NOT NULL,
  updated_by           TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  deleted_at           TEXT
);

CREATE INDEX IF NOT EXISTS hyp_${prefix}_hypotheses_recent
  ON hyp_${prefix}_hypotheses(status, updated_at DESC)
  WHERE deleted_at IS NULL;
```

## Logging

Every operation uses the injected Logger. Mutation logs include operation,
Hypothesis ID, actor ID, prior and next status, confidence level, Question and
assumption counts, outcome, and duration. Runtime logs include resolved
Question and Finding counts. Logs do not contain the statement, rationale, or
assumption text, and the capability never calls `console`.

## Invariants

1. `statement` is non-empty.
2. `questionIds` contains zero or more project-local IDs and is stored once on
   the Hypothesis.
3. Assumptions are plain text and have no nested lifecycle.
4. Status is one of `proposed`, `accepted`, `refuted`, or `inconclusive`.
5. `confidenceLevel`, when present, uses exactly the five settled values.
6. No status or confidence value requires an accepted Finding.
7. Finding reverse relationships are derived from Findings and preserve the
   Finding-to-Hypothesis direction.
8. Soft-deleted Hypotheses are absent from normal reads and runtime assembly.
9. The runtime projection is assembled, not persisted.

# Hypothesis — Investigation Domain Design

## Summary

Hypothesis is one of the three record types owned by the
[Investigation capability](./investigation-design.md). It represents a proposed
explanation or claim that may address one Question, several Questions, part of
an answer, or connect Findings across related Questions.

Hypothesis is not a separate capability and is not nested under one Question.
It has no standalone service, runtime projection, store, database, startup
factory, or import alias. Callers create and access Hypotheses through the
single `InvestigationRuntime`.

## Outcomes

Investigation can use a Hypothesis to:

- create and edit a durable proposed explanation;
- associate it with zero, one, or many Questions;
- record a simple current assessment and evidentiary direction;
- locate related Findings and Questions through runtime filters; and
- soft-delete it so ordinary reads treat it as absent.

A Hypothesis does not test itself, calculate confidence, require evidence
before a status change, or enter Knowledge directly.

## Hypothesis model

`Hypothesis` is the only public representation of this record:

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
  readonly id: string;

  /** Zero or more Questions to which this proposition is relevant. */
  readonly questionIds: readonly string[];

  readonly statement: string;
  readonly rationale?: string;

  /** Plain-text assumptions; empty means none were recorded. */
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

`questionIds` may be empty while a Hypothesis is being framed and supports one
or many IDs without a join entity. Assumptions are plain strings with no IDs,
statuses, approval, individual confidence, or independent lifecycle.

There is no numeric confidence field because no current implementation purpose
requires one. If a later concrete use needs one, it should be optional, named
`confidenceScore`, documented as uncalibrated, and must not replace
`confidenceLevel`.

## Status and confidence semantics

| Status | Meaning |
|---|---|
| `proposed` | Under consideration and not yet resolved. |
| `accepted` | Currently treated as the best-supported explanation. |
| `refuted` | Available evidence is considered sufficient to reject it. |
| `inconclusive` | Evaluated, but evidence supports neither acceptance nor refutation. |

Status and confidence are explicit caller assessments. Investigation does not
infer either from Finding counts, force a transition sequence, or require an
accepted Finding before a Hypothesis can be created or reassessed.

`confidenceLevel` describes evidentiary direction; `status` records the current
conclusion. One is not automatically forced from the other.

Deletion is not a Hypothesis status. It sets `deletedAt`, and ordinary
Investigation reads then treat the Hypothesis as absent.

## Relationships

Hypothesis owns `questionIds`. It does not store Finding IDs; Findings own
`hypothesisLinks` and their optional relationship meanings.

```ts
const questions = (
  await Promise.all(
    hypothesis.questionIds.map((questionId) => investigation.getQuestion(questionId))
  )
).filter((question): question is Question => question !== null);
const findings = await investigation.listFindings({ hypothesisId });
```

Each returned Finding contains the matching `FindingHypothesisLink`. Its
optional relationship retains the Finding-to-Hypothesis direction; `supports`
means the Finding supports the Hypothesis.

Questions obtain the reverse Hypothesis relationship with:

```ts
const hypotheses = await investigation.listHypotheses({ questionId });
```

This provides traversal without a `RuntimeHypothesis`, a Finding reverse array,
or recursively embedded objects. Deleted related records are absent from
ordinary reads, and a reverse filter for a deleted target returns an empty
list. No cascade or link rewrite is required.

## Investigation runtime functions

The Hypothesis portion of the single runtime is:

```ts
interface InvestigationRuntime {
  createHypothesis(request: CreateHypothesisRequest): Promise<Hypothesis>;
  updateHypothesis(
    id: string,
    request: UpdateHypothesisRequest
  ): Promise<Hypothesis>;
  getHypothesis(id: string): Promise<Hypothesis | null>;
  listHypotheses(filter?: HypothesisFilter): Promise<Hypothesis[]>;
  deleteHypothesis(id: string): Promise<void>;
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

interface HypothesisFilter {
  readonly questionId?: string;
  readonly status?: HypothesisStatus;
}
```

Creation starts in `proposed`. `updateHypothesis` is a direct,
last-write-wins mutation that may change content, Question IDs, status, or
confidence. It adds no evidence gate or status-transition engine.

Hypothesis methods share the Investigation store, Logger, actor/clock context,
and validation boundary. Authored mutations run serially; get/list operations
run concurrently.

## Endpoints

The single Investigation endpoint registrar exposes:

| Method | Path | Queue | Runtime method |
|---|---|---|---|
| `POST` | `/hypotheses/create` | serial | `createHypothesis` |
| `POST` | `/hypotheses/update` | serial | `updateHypothesis` |
| `GET` | `/hypotheses/get?id=...` | concurrent | `getHypothesis` |
| `GET` | `/hypotheses/list?questionId=...&status=...` | concurrent | `listHypotheses` |
| `DELETE` | `/hypotheses/delete?id=...` | serial | `deleteHypothesis` |

There is no `/hypotheses/runtime` endpoint. In-process consumers already hold
`InvestigationRuntime`; HTTP consumers locate related Findings through the
filtered Finding list endpoint.

## Persistence

The central `SQLiteInvestigationStore` creates this table together with the
Question and Finding tables on its one connection:

```sql
CREATE TABLE IF NOT EXISTS inv_${prefix}_hypotheses (
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

CREATE INDEX IF NOT EXISTS inv_${prefix}_hypotheses_recent
  ON inv_${prefix}_hypotheses(status, updated_at DESC)
  WHERE deleted_at IS NULL;
```

There is no Finding reverse column and no Hypothesis-specific database
connection. SQLite row mapping is private implementation detail; `Hypothesis`
remains the only exported record type.

## Logging

Hypothesis events use the shared Logger under
`investigation.hypotheses.*`. Mutation logs include operation, Hypothesis ID,
actor ID, prior/next status, confidence level, Question/assumption counts,
outcome, and duration. Logs do not contain the statement, rationale, or
assumption text.

## Research integration

Research receives one `InvestigationRuntime`, calls `getHypothesis`, resolves
its `questionIds` through `getQuestion`, and calls
`listFindings({ hypothesisId })` for related Findings. Research may snapshot
those canonical objects; Investigation does not define or persist a separate
runtime Hypothesis.

## Invariants

1. `Hypothesis` is the only public Hypothesis representation.
2. `statement` is non-empty.
3. `questionIds` contains zero or more project-local IDs and is stored once on
   the Hypothesis.
4. Assumptions are plain text with no nested lifecycle.
5. Status uses exactly `proposed`, `accepted`, `refuted`, or `inconclusive`.
6. `confidenceLevel`, when present, uses exactly the five settled values.
7. No status or confidence requires an accepted Finding.
8. Finding relationships are exposed by filtered Investigation queries and
   preserve Finding-to-Hypothesis direction.
9. Soft-deleted Hypotheses are absent from normal Investigation reads.

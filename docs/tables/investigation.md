# Investigation

Four tables: what the project is trying to find out, what it proposes, what it
has established, and the working conversation that moves between them.

`questions` · `hypotheses` · `findings` · `researchThreads`

**The first three relate in two ways, and they are not the same kind of thing.**

```text
question   ←── relatedTo ───→  hypothesis
question   ←── relatedTo ───→  finding
hypothesis ←── evidence ────→  finding     carrying a bearing

thread     ←── mode ────────→  a question, or a hypothesis, or neither
thread     ←── findingIds ──→  finding
```

A question's relationship to material is bare — it is related or it is not, and
there is nothing further to say about it. A finding's relationship to a claim is
a judgement, so it carries one. A thread's relationship to all three is bare
again: it is working on this.

**Every row holds its own view of every relationship it is in**, so reading one
from either side is a field on a row somebody already has rather than a query.
There is no link table.

---

## `questions`

`app/src/lib/capabilities/questions/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { questionStatusValidator, relatedItemValidator } from "$questions/types/question";
import { actorValidator } from "$shared/types/actor";

/**
 * The unit of inquiry: what the project is trying to find out.
 *
 * **`text` is plain and `notes` are blocks.** The question is one sentence and
 * it is the label lists, breadcrumbs, and search results render; the surrounding
 * context — what has been ruled out, the screenshot that prompted it — is
 * genuinely rich.
 *
 * **`relatedTo` is material, not answers.** A hypothesis proposing one and a
 * finding that bears on the question sit in the same list, because from the
 * question's side they are the same relationship: this is relevant. How settled
 * a hypothesis is, is its own `assessment`.
 *
 * **`parentId` rather than a list of children**, because decomposition is the
 * one relationship here that is not many-to-many: a question has exactly one
 * parent, since a decomposition producing two parents is two questions. A
 * pointer gives "my parent" as a field and "my children" as an indexed read,
 * where a list would give only the second. An absent value sorts before every
 * id, so the roots are their own contiguous key range.
 *
 * `revision` is the stale-form check: `notes` are edited in a form over minutes,
 * which no transaction covers.
 */
export const questionsTables = {
  questions: defineTable({
    projectId: v.id("projects"),
    text: v.string(),
    notes: v.array(blockValidator),
    status: questionStatusValidator,
    relatedTo: v.array(relatedItemValidator),
    /** Threads working on this question. */
    researchThreadIds: v.array(v.id("researchThreads")),
    /** One parent, absent at the root. The tree need not be balanced or complete. */
    parentId: v.optional(v.id("questions")),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  })
    .index("by_project", ["projectId"])
    .index("by_parent", ["projectId", "parentId"])
};
```

`app/src/lib/capabilities/questions/types/question.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * Where a question stands. Three values describing the state of the *work*
 * rather than what was learned — conclusions are findings, not a status.
 *
 * **There is no `parked`.** A question nobody intends to pursue is deleted:
 * keeping it in a state meaning "we are not doing this" fills the list with
 * things that look like work and are not, and the honest signal is its absence.
 * `open` already covers a question that is waiting.
 */
export const questionStatusValidator = v.union(
  v.literal("open"),
  v.literal("investigating"),
  v.literal("answered")
);

export type QuestionStatus = Infer<typeof questionStatusValidator>;

/**
 * One thing related to a question.
 *
 * **An id and nothing else.** There is no label, because the relationship has no
 * grades — a hypothesis or a finding is relevant to a question or it is not, and
 * a vocabulary here would invent distinctions nobody asked to record. It also
 * needs no attribution and no `revision`: an edge with no editable content has
 * nothing two people can disagree about.
 *
 * A union of objects rather than a kind and a loose string, so each id is
 * checked against the table it names.
 */
export const relatedItemValidator = v.union(
  v.object({ kind: v.literal("hypothesis"), id: v.id("hypotheses") }),
  v.object({ kind: v.literal("finding"), id: v.id("findings") })
);

export type RelatedItem = Infer<typeof relatedItemValidator>;
```

---

## `hypotheses`

`app/src/lib/capabilities/hypotheses/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import {
  hypothesisAssessmentValidator,
  evidenceValidator
} from "$hypotheses/types/hypothesis";
import { actorValidator } from "$shared/types/actor";

/**
 * A proposed answer, stated so that evidence can bear on it.
 *
 * **`notes` rather than a rationale.** The text is the working record — why the
 * claim is being considered, how it has been tested, what would invalidate it,
 * how it will be tested next. "Rationale" names only the first of those.
 *
 * **`projectId` is stored directly rather than reached through a question**,
 * which is what keeps an unattached hypothesis inside every project query rather
 * than stranded outside them. A hunch arrives before the question it belongs to
 * is articulated.
 *
 * **`assessment` is stored, never derived** from `evidence`. A count of
 * supporting versus refuting findings is not a judgement — three weak findings
 * do not outweigh one decisive one — and a column computed from them would
 * assert a confidence nobody chose.
 *
 * `confidence` is optional for the same reason: an untested claim has none to
 * report, and a default would be a fabricated number. Moving back to `untested`
 * clears it rather than keeping one that no longer stands for anything.
 */
export const hypothesesTables = {
  hypotheses: defineTable({
    projectId: v.id("projects"),
    statement: v.string(),
    notes: v.array(blockValidator),
    assessment: hypothesisAssessmentValidator,
    /** 0–1, and only once there is an assessment to attach it to. */
    confidence: v.optional(v.number()),
    /** Findings bearing on this claim. */
    evidence: v.array(evidenceValidator),
    /** Questions this claim is relevant to. */
    relatedTo: v.array(v.id("questions")),
    /** Threads testing this claim. */
    researchThreadIds: v.array(v.id("researchThreads")),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};
```

`app/src/lib/capabilities/hypotheses/types/hypothesis.ts`

```ts
import { v, type Infer } from "convex/values";
import { actorValidator } from "$shared/types/actor";

/**
 * The judgement on a claim.
 *
 * Five values splitting into three states of *work* — `untested`, `testing`,
 * done — and three *verdicts* once done. One field rather than two, because a
 * verdict implies the work happened, so most of the combinations a second field
 * would allow are nonsense.
 *
 * **`testing` is why work in progress does not read as nobody having started**,
 * and **`inconclusive` is a real outcome**: it records that the work was done
 * and did not settle the question, which `untested` would erase.
 */
export const hypothesisAssessmentValidator = v.union(
  v.literal("untested"),
  v.literal("testing"),
  v.literal("supported"),
  v.literal("refuted"),
  v.literal("inconclusive")
);

export type HypothesisAssessment = Infer<typeof hypothesisAssessmentValidator>;

/**
 * What one finding says about this claim.
 *
 * **`neutral` is not "unknown".** It records that the evidence was assessed and
 * moves neither way, which leaving the finding unattached would make
 * indistinguishable from nobody having looked.
 */
export const bearingValidator = v.union(
  v.literal("supports"),
  v.literal("refutes"),
  v.literal("neutral")
);

export type Bearing = Infer<typeof bearingValidator>;

/**
 * One finding bearing on this claim.
 *
 * **The bearing lives here and nowhere else.** A finding's own `evidenceFor` is
 * a bare id, so the judgement has one home and cannot disagree with a second
 * copy — and reading it from the finding's side costs nothing extra, because the
 * hypothesis has to be fetched to render its statement anyway.
 *
 * **This edge carries attribution and a `revision`** where a `relatedTo` entry
 * does not, because it has editable content: who judged this finding to refute
 * the claim, and when that was last reconsidered, are facts about the
 * relationship rather than about either end.
 *
 * `note` is a sentence of justification. Anything longer is a finding.
 */
export const evidenceValidator = v.object({
  findingId: v.id("findings"),
  bearing: bearingValidator,
  note: v.optional(v.string()),
  createdBy: actorValidator,
  updatedBy: actorValidator,
  revision: v.number(),
  updatedAt: v.number()
});

export type Evidence = Infer<typeof evidenceValidator>;
```

---

## `findings`

`app/src/lib/capabilities/findings/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { findingSourceValidator } from "$findings/types/finding";
import { actorValidator } from "$shared/types/actor";

/**
 * Something established, written down with what establishes it.
 *
 * **`body` is blocks rather than document rows.** A finding has no page, no
 * margins, and no side-by-side layout; it is read inline wherever it is cited.
 * It is a list rather than one block because a block holds no newlines and a
 * finding is a writeup — a claim, the evidence, a caveat.
 *
 * **`title` is a separate column** precisely so a list, a link, and a search
 * result get a line without loading a writeup to print it.
 *
 * **`sources` sit on the row and carry their own excerpt.** The citation is part
 * of the finding, and the copy is what keeps it checkable after the page it came
 * from changes.
 *
 * **Both back-references are bare ids.** `evidenceFor` says a judgement exists
 * on that hypothesis without repeating it, and `relatedTo` has nothing to repeat.
 *
 * There is no snapshot and no change-set log: a finding has no edit history, and
 * `revision` is the stale-form check rather than a pointer into one.
 */
export const findingsTables = {
  findings: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    body: v.array(blockValidator),
    sources: v.array(findingSourceValidator),
    /** Hypotheses this finding bears on. The bearing is on theirs. */
    evidenceFor: v.array(v.id("hypotheses")),
    /** Questions this finding is relevant to. */
    relatedTo: v.array(v.id("questions")),
    /** Threads this finding was drafted out of. */
    researchThreadIds: v.array(v.id("researchThreads")),
    createdBy: actorValidator,
    updatedBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};
```

`app/src/lib/capabilities/findings/types/finding.ts`

```ts
import { v, type Infer } from "convex/values";
import { resourceRefValidator } from "$shared/types/resource";

/**
 * Where something came from, and what it said when it was read.
 *
 * **Each variant carries its own copy.** Pages change and get taken down, files
 * get replaced, and a citation that is only a pointer degrades into an
 * unfalsifiable claim the moment its target moves. `excerpt` and `capturedAt`
 * are what keep a finding checkable years later — which is also why what the
 * *source said* is stored verbatim while what the *author typed* is trimmed.
 *
 * **One `resource` variant covers everything the project holds.** An uploaded
 * file, a connection, a document, another finding — all of them are a
 * `ResourceRef`, so citing a file is not a special case of citing a resource.
 *
 * `manual` exists so a finding can cite a conversation, a phone call, or prior
 * knowledge rather than forcing it into a fake URL.
 */
export const findingSourceValidator = v.union(
  v.object({
    kind: v.literal("resource"),
    ref: resourceRefValidator,
    /** A page, a cell, a timestamp — where in it. */
    locator: v.optional(v.string()),
    excerpt: v.optional(v.string())
  }),
  v.object({
    kind: v.literal("url"),
    url: v.string(),
    title: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    /** Required: an excerpt with no date is a copy of nothing in particular. */
    capturedAt: v.number()
  }),
  v.object({
    kind: v.literal("message"),
    /** Any conversation. `threads.kind` says which of the three owns it. */
    threadId: v.id("threads"),
    /** Local to its thread: messages are not rows. */
    messageId: v.string(),
    excerpt: v.optional(v.string())
  }),
  v.object({ kind: v.literal("manual"), note: v.string() })
);

export type FindingSource = Infer<typeof findingSourceValidator>;
```

---

## `researchThreads`

`app/src/lib/capabilities/research-threads/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { researchModeValidator } from "$research-threads/types/research-thread";
import { actorValidator } from "$shared/types/actor";

/**
 * The working conversation: pull material together, test a claim, and turn what
 * holds up into a finding.
 *
 * **The conversation is not here.** `threadId` names it and the messages are
 * `threadParts`; this row holds only what makes the conversation *research*.
 *
 * **A thread has no `status`.** It is not a unit of work — that is `agentTasks`
 * — and how settled the thing it works on is, is that thing's own `status` or
 * `assessment`.
 *
 * **No `personaId`.** A persona chat is a conversation with a chosen identity;
 * this is a conversation with a fixed job. Adding one later is an optional
 * field, which no row has to migrate for.
 *
 * `findingIds` is the thread's side of the finding edge: `mode` has no finding
 * variant, so without it that edge would read from one end only.
 */
export const researchThreadsTables = {
  researchThreads: defineTable({
    projectId: v.id("projects"),
    threadId: v.id("threads"),
    title: v.string(),
    mode: researchModeValidator,
    /** Findings drafted out of this thread. */
    findingIds: v.array(v.id("findings")),
    createdBy: actorValidator,
    updatedAt: v.number()
  })
    .index("by_thread", ["projectId", "threadId"])
    .index("by_project", ["projectId", "updatedAt"])
    .index("by_question", ["projectId", "mode.questionId", "updatedAt"])
    .index("by_hypothesis", ["projectId", "mode.hypothesisId", "updatedAt"])
};
```

`app/src/lib/capabilities/research-threads/types/research-thread.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * What the thread is working toward, holding what it is working on.
 *
 * **One field rather than a mode beside two optional ids.** Three fields would
 * allow `question` with no question, `discover` with a hypothesis, and both ids
 * at once — states nothing can render and every reader has to defend against.
 * The union makes all three unrepresentable.
 *
 * Per-variant field names, like `Actor`, so each id is a real `v.id` checked
 * against the table it names.
 *
 * **`discover` is a job, not an absence.** It is how questions get found in the
 * first place, so a discover thread producing a finding is the ordinary case
 * rather than a loose end.
 */
export const researchModeValidator = v.union(
  v.object({ kind: v.literal("discover") }),
  v.object({ kind: v.literal("question"), questionId: v.id("questions") }),
  v.object({ kind: v.literal("hypothesis"), hypothesisId: v.id("hypotheses") })
);

export type ResearchMode = Infer<typeof researchModeValidator>;
```

**The dotted index paths are real.** A `v.object`'s field paths include
`` `${key}.${nested}` `` and a `v.union`'s are the union of its members', so
`mode.questionId` both type-checks and indexes. A discover thread has neither
path, and absent sorts before every id — so the unanchored threads form their
own contiguous block at the head of both anchor indexes rather than turning up
under a question.

Four indexes on a table that will never be large. The anchor indexes read the
thread's own field rather than the copy on the row at the other end.

---

## Both ends of every edge

| edge | where it lives | what it carries |
| --- | --- | --- |
| question ↔ hypothesis | `questions.relatedTo` · `hypotheses.relatedTo` | an id |
| question ↔ finding | `questions.relatedTo` · `findings.relatedTo` | an id |
| hypothesis ↔ finding | `hypotheses.evidence` · `findings.evidenceFor` | a bearing, on the hypothesis's side only |
| question ↔ thread | `questions.researchThreadIds` · `researchThreads.mode` | an id |
| hypothesis ↔ thread | `hypotheses.researchThreadIds` · `researchThreads.mode` | an id |
| finding ↔ thread | `findings.researchThreadIds` · `researchThreads.findingIds` | an id |

The anchor is the one edge here that is not many-to-many: `mode` names at most
one question or hypothesis, while either of those can carry many threads. The
finding edge is a list on both sides like the first three.

Writing an edge patches two rows in one mutation, which is atomic — so the two
entries cannot half-apply. The one thing to keep in step is that both exist, and
that is a single write path rather than a reconciliation.

The bearing is deliberately not mirrored. Storing it twice would create two
copies of one judgement that can disagree, and reading it from the finding's side
requires the hypothesis anyway.

---

## Where a row can grow

`questions.notes`, `hypotheses.notes`, and `findings.body` are block arrays with
no ceiling; `findings.sources` grows with citations. None is split into parts — a
bound on any of them is a decision about how long a writeup may be, set where the
value is accepted.

`relatedTo`, `evidence`, `evidenceFor`, `researchThreadIds`, and `findingIds`
grow with connections. Entries are small, and a row with a hundred of them is a
row somebody should have split.

`researchThreads` has no unbounded field: its conversation is `threadParts`.

---

## Files

```text
app/src/lib/capabilities/questions/
├── overview.md
├── schema.ts
└── types/{types.md, question.ts}   QuestionStatus, RelatedItem

app/src/lib/capabilities/hypotheses/
├── overview.md
├── schema.ts
└── types/{types.md, hypothesis.ts} HypothesisAssessment, Bearing, Evidence

app/src/lib/capabilities/findings/
├── overview.md
├── schema.ts
└── types/{types.md, finding.ts}    FindingSource

app/src/lib/capabilities/research-threads/
├── overview.md
├── schema.ts
└── types/{types.md, research-thread.ts}  ResearchMode
```

One table each, so `schema.ts` is a file rather than a directory.

### Registering them

```js
// app/svelte.config.js
      $findings: "src/lib/capabilities/findings",
      $hypotheses: "src/lib/capabilities/hypotheses",
      $questions: "src/lib/capabilities/questions",
      "$research-threads": "src/lib/capabilities/research-threads",
```

```json
// app/src/convex/tsconfig.json
      "$findings/*": ["../lib/capabilities/findings/*"],
      "$hypotheses/*": ["../lib/capabilities/hypotheses/*"],
      "$questions/*": ["../lib/capabilities/questions/*"],
      "$research-threads/*": ["../lib/capabilities/research-threads/*"],
```

```ts
// app/src/convex/schema.ts — the fragment list appears twice
import { findingsTables } from "$findings/schema";
import { hypothesesTables } from "$hypotheses/schema";
import { questionsTables } from "$questions/schema";
import { researchThreadsTables } from "$research-threads/schema";
```

**Imports it does not define:** [`$content/types/block`](content.md),
[`$shared/types/actor`](shared.md#actor),
[`$shared/types/resource`](resource-sets.md#the-vocabulary).

## Related

[all tables](README.md) · [threads](threads.md) · [shared types](shared.md) ·
[knowledge](knowledge.md)

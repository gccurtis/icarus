# Build order

Seven passes, four tables each. Review a pass, build it, move on.

This document is about **tables**. Where a pass also needs non-table work — an
algorithm, an evaluator — it is listed separately under *Also needs*, so the
table review stays a table review.

The ordering rule is **dependency, then usefulness**: nothing is built before what
it references, and among the options at each step, the one that makes the app
demonstrably do something comes first.

| Pass | Tables | Delivers |
| --- | --- | --- |
| 1 | `projects` `users` `activity` `documents` | A project with members; documents you can create and list |
| 2 | `resourceSnapshots` `changeSets` `slideDecks` `spreadsheets` `nameVariables` | Editing that merges and undoes |
| 3 | `externalFiles` `templates` `commentThreads` `comments` | Uploads, starting points, discussion |
| 4 | `questions` `hypotheses` `findings` `researchLinks` | The research graph |
| 5 | `messages` `researchThreads` `personas` `personaThreads` | Conversation |
| 6 | `resourceSets` `latticeVersions` `latticeNodes` `latticeLevelIndexes` | Search that works |
| 7 | `latticeEdges` `latticeChanges` `derivedOutputs` `agentTasks` | Generated content and agents |

Then a [pass 8 and beyond](#pass-8-and-beyond): `automations`, `connectors`,
`analyses` — later passes rather than dropped work, each waiting on something
outside the model.

## Content blocks grow with the passes

[`ContentBlock`](../data-models/content/content-block.md) is one type from the
first pass that has a body, and each owner accepts a **widening subset** of its
variants. Nothing is rewritten — the union grows a member, and owners that should
accept it start accepting it.

| Pass | Variants available | Unlocked by |
| --- | --- | --- |
| 2 | `text` — paragraph, heading, list, quote, code | change sets |
| 2 | `formula` | formula evaluation |
| 3 | `image`, `table`, `embed` | `externalFiles` |
| 7 | `prompt` | `derivedOutputs` |

This is the reason prompt blocks stay in the union rather than becoming their own
thing. A [prompt block *is* a text
block](../data-models/content/content-block.md#prompt-blocks) with a derived
output behind it — same atoms, same display, same marks. Splitting it out would
mean a second text editor with its own marks and offsets, then reconciling the
two forever. Keeping it in the union means pass 7 adds a variant and nothing
existing changes.

---

## Pass 1 — Foundation

**Tables:** `projects` · `users` · `activity` · `documents`

Everything else is scoped by a project and attributed to an actor, so these come
first regardless of what is most interesting.

`activity` is here rather than later because every subsequent pass writes to it.
Adding it at the end means retrofitting writes into six capabilities built
without it.

`documents` arrives with **no body** — title and metadata only. That looks
strange and it is the honest consequence of the
[leader-head design](general-resources.md). The pass still ends somewhere real:
a list of named documents you can create, rename, and delete.

**Review:** the [`Actor`](../data-models/core/actor.md) union, since it is
embedded in nearly every table after this. Project membership roles.

## Pass 2 — Editing

**Tables:** `resourceSnapshots` · `changeSets` · `slideDecks` · `spreadsheets` ·
`nameVariables`

**Also needs:** formula evaluation — stateless, no tables, but a spreadsheet
without it is a grid of text.

Five tables, because `nameVariables` belongs beside formula and costs almost
nothing. It [evaluates
nothing](../data-models/data/name-manager.md#it-evaluates-nothing) and depends on
nothing — values arrive already computed and are validated for shape only. The
dependency runs the other way: formula asks the name manager to resolve any name
that is not one of its built-ins.

The hard pass and the one that proves the design. Change sets, snapshot folding,
the [conflict checks](../processes/change-conflicts.md), and consolidation — with
concurrency coming from [Convex's
serializable mutations](README.md#there-are-no-unique-indexes) rather than a
version field.

Decks and workbooks come along nearly free: the snapshot and change-set machinery
is generic over `resourceType`, so once documents work, the other two are their
body types and nothing else. Building them here rather than later is what
*proves* the machinery is generic — if they need special cases, better to find
out now than after three more passes depend on it.

**Review:** the [conflict check ladder](../processes/change-conflicts.md), and the
retention numbers in
[`revisions.yaml`](../../app/configuration/revisions.yaml). The rebase window is
guesswork until real editing sessions exist.

## Pass 3 — Files and collaboration

**Tables:** `externalFiles` · `templates` · `commentThreads` · `comments`

Uploads with extension-based kind routing and text extraction. Extraction matters
beyond this pass — it is what pass 6 indexes.

Comments need stable block addressing, which pass 2 settled. Templates need
resource bodies to copy, which pass 2 also settled.

**Review:** the `ext-` kind table and extraction states. Comment anchoring is
best-effort by design — [`path` plus
`quote`](../data-models/collaboration/comment.md) — and that trade is worth
re-examining before it ships.

## Pass 4 — Research

**Tables:** `questions` · `hypotheses` · `findings` · `researchLinks`

Four independent objects and the many-to-many graph between them. No conversation
yet — findings are written directly.

Findings are a [resource kind](../data-models/special-resources/resource-set.md),
so this pass is a prerequisite for pass 6: without it, half of what retrieval
should index does not exist.

**Review:** the [bearer/subject](../data-models/research/research-link.md)
direction, and whether `bearing` needs values beyond supports/contradicts/neutral.

## Pass 5 — Conversation

**Tables:** `messages` · `researchThreads` · `personas` · `personaThreads`

One `messages` table serving research threads and persona chats, with `ThreadRef`
naming the owner. Multi-participant from the start —
[`prompt`/`response` plus
`author`](../data-models/core/message.md#several-people-in-one-thread).

Personas carry the five-section definition. `agentTasks` is deliberately *not*
here: a task is a thread too, but it also needs tool execution, and this pass
should land conversation without dragging that in.

**Review:** the persona definition sections, and whether a persona's `scope`
should be settable before resource sets exist in pass 6.

## Pass 6 — Search that works

**Tables:** `resourceSets` · `latticeVersions` · `latticeNodes` ·
`latticeLevelIndexes`

**Also needs:** windowing, embedding, clustering, and descent — see
[clustering](../processes/lattice-clustering.md) and
[retrieval](../processes/lattice-retrieval.md). Four tables, but most of the
work is not in them.

`resourceSets` leads because scoping is defined over resource kinds, and by now
every kind that can be a lattice source exists: documents, decks, workbooks,
files, findings. Building it earlier would have meant scoping over kinds with no
rows.

**Build the exact clustering path first.** Clustering picks between two modes by
pool size: small pools compare every pair, large pools project with PCA, bucket
into IVF cells, and compare only within nearby cells before reranking at full
dimensions. They produce the same clusters. Doing exact first gives a
known-correct oracle to test the approximate path against — otherwise PCA and
clustering are being debugged simultaneously with nothing to compare to.

**Review:** `maxClusterPool`, which is where exactness stops being affordable, and
the [scope-after-descent
limitation](../processes/lattice-retrieval.md#the-known-limitation).

## Pass 7 — Generated content and agents

**Tables:** `latticeEdges` · `latticeChanges` · `derivedOutputs` · `agentTasks`

`derivedOutputs` is what powers **prompt blocks** — a block in a document that
holds generated text and can refresh it against current inputs. It needs
retrieval, so this is the earliest it could land.

Edges complete the lattice's within-level networks, and `latticeChanges` gives it
an explainable history. `agentTasks` brings tool execution and completes the
thread family started in pass 5.

**Review:** whether prompt-block shaping behaves as
[described](../data-models/knowledge/derived-output.md#where-the-shaping-comes-from)
once it is real, and agent task tool grants.

---

## Pass 8 and beyond

Not cut — just last, because each one waits on something outside the model.

**`automations`** — one trigger, one action. Cheap to add, but scheduling
infrastructure is its own problem and nothing depends on it.

**`connectors`** — needs real external integration: OAuth, webhook endpoints,
provider-specific sync. The largest non-model surface here, and everything it
produces is an `externalFile`, which pass 3 already handles.

**`analyses`** — needs the relational builtins an [analysis compiles
to](../data-models/data/analysis.md#it-compiles-to-one-formula): `JOIN`, `WHERE`,
`GROUP`, `AGGREGATE`, `SORT`. Pass 2's evaluation is arithmetic, cell references,
and name lookup, which is a much smaller thing.

`nameVariables` is **not** deferred — it moved into pass 2, since it evaluates
nothing and is what formula resolves names against.

## Related

[storage](README.md) · [general resources](general-resources.md) ·
[data models](../data-models/) · [processes](../processes/)

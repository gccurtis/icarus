# Merge order

The order to bring `convex-implementation` into `main`, and why the obvious
answer — a topological sort of the tables — does not exist.

Derived from the built schemas, not from the plan. Every edge below is a real
`v.id("…")` in `src/lib/capabilities/*/schema.ts`.

## A strict topological sort is impossible

`Actor` is embedded in nearly every table — `createdBy`, `updatedBy`, `actor`,
`author`, `origin` — and it hard-references two tables:

```ts
v.object({ kind: v.literal("user"),  userId: v.id("users") }),
v.object({ kind: v.literal("agent"), taskId: v.id("agentTasks") }),
```

So **24 of 32 tables depend on `agentTasks`**, and `agentTasks` carries
`origin: Actor` and `personaId`, while `personas` carries `createdBy: Actor`.
That is a cycle, and it is not a modelling error — an agent task is authored by
something, and the thing that authors it may be another agent task.

Cutting one edge makes it a DAG: **`taskId` stays `v.string()` until
`agentTasks` exists, then tightens.** That is exactly what the build did
(Task 31), and it is why `automationId` and `connectorId` are still strings —
pass 8 has not happened.

**This is the whole reason the merge order is the build order.** Not because the
passes were sequenced well, but because the Actor edge has to be deferred and
everything else follows from where you choose to defer it.

## The hard graph, with that edge deferred

Three levels. This is what Convex enforces — a push fails if a level is missing.

| Level | Tables |
| --- | --- |
| 0 | `projects` `users` |
| 1 | `activity` `changeSets` `commentThreads` `derivedOutputs` `externalFiles` `findings` `hypotheses` `latticeChanges` `latticeLevelIndexes` `latticeNodes` `latticeSources` `latticeVersions` `memberships` `messages` `nameVariables` `personas` `questions` `researchLinks` `resourceSets` `resourceSnapshots` `settings` `templates` |
| 2 | `agentTasks` `comments` `documents` `latticeEdges` `personaThreads` `researchThreads` `slideDecks` `spreadsheets` |

**The graph is nearly flat, and that is the useful finding.** Twenty-two tables
need nothing but `projects` and `users`. The complete set of ordering constraints
beyond level 0 is seven edges:

```text
templates      → documents, slideDecks, spreadsheets
commentThreads → comments
latticeNodes   → latticeEdges
personas       → agentTasks, personaThreads
messages       → personaThreads
questions      → researchThreads
hypotheses     → researchThreads
```

Everything else can be merged in any order at all. **The schema is not the
constraint — reviewability is.** So the sequence below is chosen to make each
tranche independently arguable, not to satisfy the graph.

## Soft edges the schema does not enforce

Three places hold an id as `v.string()` on purpose. Each is a polymorphic
reference where `v.id` would either be wrong or would defeat the design.

| Field | Points at | Why it is a string |
| --- | --- | --- |
| `changeSets.resourceId`, `resourceSnapshots.resourceId` | documents / slideDecks / spreadsheets | [The pair `(resourceType, resourceId)` is the key](general-resources.md). A `v.id` union would make the change-set machinery branch on resource type, which is the one thing it must not do |
| `researchLinks.bearerId` / `subjectId` | findings / hypotheses / questions | The edge is deliberately polymorphic; the kind travels beside the id |
| `Actor.automationId` / `.connectorId` | pass 8 | Those tables do not exist |

These do not constrain merge order, but they are what a reviewer should check by
hand, because nothing else will.

## Review order

Types before tables, then tables by subject, with AI, templates, and connectors
last. Sizes are source / test lines so a stage's cost is visible before opening
it. `main` already has `access` and `settings`.

### Stage 0 — everything that is not a table

Nothing here declares storage. It is the vocabulary every table is written in,
and it is the only chance to argue about the model without a table in the way.

| Capability | Holds | Lines |
| --- | --- | --- |
| `shared/types` | `actor` `mention` `resource` `page-setup` `style-set` `set-expression` | 231 / 256 |
| `content/types` | `block` `format` `value` — **the content block union** | 404 / 468 |
| `revisions/types` | `change` (the five ops, paths, targets) `body` | part of 1454 / 1984 |

### Stages 1–8

| # | Stage | Tables | Lines |
| --- | --- | --- | --- |
| 1 | **access reconciliation** | `users` `projects` `memberships` | 254 / 120 |
| 2 | **revisions** — the machinery, no resources yet | `resourceSnapshots` `changeSets` | 1454 / 1984 |
| 3 | **general resources** | `documents` `slideDecks` `spreadsheets` | 1283 / 1105 |
| 4 | **data** | `nameVariables`, `formula` (no table) | 982 / 975 |
| 5 | **collaboration** | `activity` `commentThreads` `comments` | 1067 / 1438 |
| 6 | **research** | `questions` `hypotheses` `findings` `researchLinks` `researchThreads` | 2302 / 2732 |
| 7 | **knowledge** | `resourceSets` `latticeVersions` `latticeSources` `latticeNodes` `latticeLevelIndexes` `latticeEdges` `latticeChanges` | 3991 / 4819 |
| 8 | **intelligence and agents** | `messages` `personas` `personaThreads` `agentTasks` `derivedOutputs` | 2818 / 3545 |
| 9 | **special resources** | `externalFiles` `templates` | 1174 / 1543 |

Total: 16,078 source lines and 18,985 test lines across 26 capability
directories.

## Moving templates and files late costs three deferred edges

The order above is a review-convenience choice and it is the right one, but it
inverts three real schema edges. Each is fixed the same way `Actor.taskId`
already is — hold the reference as `v.string()`, tighten when the table lands.
The pattern is established and tested; what matters is that the ledger is
explicit rather than discovered at push time.

| Edge | Breaks | Deferral |
| --- | --- | --- |
| `documents.templateId`, `slideDecks.templateId`, `spreadsheets.templateId` → `templates` | stage 3 pushes before stage 9 | `v.optional(v.string())` until templates lands |
| `ImageBlock.source.fileId`, `ImageBlock.display.fileId` → `externalFiles` | stage 0 defines a union referencing a stage 9 table | `v.string()`, or land the image variant with stage 9 |
| `PromptBlock.derivedOutputId` → `derivedOutputs` | stage 0 references a stage 8 table | `v.string()`, or land the prompt variant with stage 8 |

**The last two are why the content block union grew across passes rather than
arriving whole.** The union is a *type*, so it belongs in stage 0 — but as a
*validator* two of its members name tables that do not exist yet.

Those are separable concerns, and separating them is the answer: **discuss the
whole union in stage 0, merge it in three pieces.** Deciding whether the model is
right is one conversation; what the schema will accept on a given day is another.

## Not built — pass 8 and beyond

Three tables in the data models have no implementation on this branch. Each was
deferred because it waits on something outside the model, and the reasons are in
[build-order.md](build-order.md#pass-8-and-beyond).

| Table | Waiting on |
| --- | --- |
| `analyses` | The relational builtins an analysis compiles to — `JOIN`, `WHERE`, `GROUP`, `AGGREGATE`, `SORT`. Pass 2's formula evaluation is arithmetic, cell references, and name lookup, which is a much smaller thing |
| `connectors` | OAuth, webhook endpoints, provider-specific sync. Everything a connector produces is an `externalFile`, which stage 9 already handles |
| `automations` | Scheduling infrastructure. Nothing depends on it |

`Actor.automationId` and `Actor.connectorId` are `v.string()` for this reason,
and `resourceSets` resolves a `connector` ref through
`externalFiles.origin.connectorId` rather than through a table that does not
exist.

## What to check per table

The build's own review found defects in four recurring shapes. A reviewer's time
is best spent on these rather than on structure, which lint already covers.

1. **Does `projectId` lead every index?** One deployment holds every project. The
   build found three capabilities where it did not, and one — `memberships` —
   where leading with `userId` instead *is* the authorization.
2. **Do the refusals disclose?** "Not found" and "not yours" must be
   indistinguishable, or the refusal confirms the row exists.
3. **Would the test pass against a broken implementation?** Two of the last three
   passes' findings were tests asserting their own fixture back.
4. **Does the document contradict the code?** Cheaper to catch here than to
   trust later.

## Related

[storage](README.md) · [build order](build-order.md) ·
[decisions](../superpowers/decisions/2026-08-16-convex-implementation.md)

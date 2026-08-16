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

## Suggested tranches

Sizes are source / test lines, so a tranche's cost is visible before opening it.
`main` already has `access` and `settings`.

| # | Tranche | Tables | Lines | Why here |
| --- | --- | --- | --- | --- |
| 1 | **access reconciliation** | `users` `projects` `memberships` | 254 / 120 | Renames `subject`→`authSubject` and adds fields. Touches shipped code, so it is the only tranche that can break what exists |
| 2 | **attribution** | `activity` | 231 / 256 + 230 / 242 | `shared` (Actor, no table) then `activity`. Everything after this writes to the log |
| 3 | **content primitive** | — | 404 / 468 | `content` declares no table. It is the block union every body composes, and reviewing it alone is the only chance to argue about blocks without a table in the way |
| 4 | **revisions** | `resourceSnapshots` `changeSets` | 1454 / 1984 | **The hard one, and independent of the resource tables.** `shift`, the conflict ladder, read/submit/consolidate. Review this before anything that stores a body |
| 5 | **general resources** | `documents` `slideDecks` `spreadsheets` `templates` | 1902 / 1966 | Thin once 4 lands — metadata rows plus body validators. `templates` comes with them because they reference it |
| 6 | **data** | `nameVariables` | 457 / 577 + 525 / 398 | `name-manager` and `formula`. Evaluates nothing; formula depends on it and not the reverse |
| 7 | **files** | `externalFiles` | 555 / 682 | Unlocks the image/table/embed block variants added in tranche 3 |
| 8 | **collaboration** | `commentThreads` `comments` | 837 / 1196 | Needs stable block ids from 4 |
| 9 | **research** | `questions` `hypotheses` `findings` `researchLinks` | 1853 / 2165 | Four independent objects and the many-to-many edge |
| 10 | **conversation** | `messages` `personas` `personaThreads` `researchThreads` | 1770 / 1987 | One `messages` table serving three thread kinds |
| 11 | **sets** | `resourceSets` | 534 / 756 | Needs every resource kind to exist to be worth scoping over |
| 12 | **knowledge** | `latticeVersions` `latticeSources` `latticeNodes` `latticeLevelIndexes` `latticeEdges` `latticeChanges` | 3457 / 4063 | **21% of the branch.** Worth splitting further at review time — ingest, clustering, and retrieval are separable |
| 13 | **generated + agents** | `derivedOutputs` `agentTasks` | 1497 / 2125 | Last, and then `Actor.taskId` tightens from `v.string()` to `v.id("agentTasks")` — the deferred edge closing |

Total: 16,078 source lines and 18,985 test lines across 26 capability
directories.

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

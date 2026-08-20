# Tables

What the Convex schema holds. One document per group; every table is defined
once, in full, with the file it belongs in.

**This directory is authoritative, and this is a rebuild.** Whatever tables and
shared types exist on `main` are replaced by what is written here — not merged
with, not reconciled against, not migrated toward. These tables have been
reviewed and settled; where `main` disagrees, `main` is what changes. Delete what
conflicts and build these.

**Everything is declared in one `defineSchema`.** A Convex schema has no ordering
requirement and reference cycles are legal, so no table waits on another and no
id is held as a string to break a cycle.

| Group | Tables | |
| --- | --- | --- |
| [access](access.md) | `users` `projects` `memberships` | ✅ |
| [revisions](revisions.md) | `resourceSnapshots` `changeSets` | ✅ |
| [resources](resources.md) | `documents` `slideDecks` | ✅ |
| [spreadsheets](spreadsheets.md) | `spreadsheets` `sheetCells` | ✅ |
| [knowledge](knowledge.md) | `latticeNodes` `latticeEdges` `latticeSources` `latticeChanges` `derivedOutputs` | ✅ |
| [threads](threads.md) | `threads` `threadParts` | ✅ |
| [agents](agents.md) | `personas` `personaThreads` `agentTasks` | ✅ |
| [templates](templates.md) | `templates` `templateVersions` | ✅ |
| [resource sets](resource-sets.md) | `resourceSets` | ✅ |
| [connections](connections.md) | `connectors` `connections` | ✅ |
| [external files](external-files.md) | `externalFiles` | ✅ |
| [data](data.md) | `formulas` `variables` `dataBackReferences` | ✅ |
| [investigation](investigation.md) | `questions` `hypotheses` `findings` `researchThreads` | ✅ |
| [collaboration](collaboration.md) | `commentThreads` `comments` `activity` | ✅ |

Thirty-five tables. There is no `messages` table and no `settings` table: a
`threadParts` row holds many messages, and settings are a JSON string on
`projects` and `users`.

**Three tables own a conversation and none of them stores one.** A persona
chat, an agent task, and a research thread each hold a `v.id("threads")`, which
is the one id space they share — so a branch point and a citation name a thread
without naming which kind it is.

## Three documents that declare no tables

| | |
| --- | --- |
| [shared types](shared.md) | `Actor` `PageSetup` `StyleSet`, and an index of where every other `$shared/types/` file is defined |
| [content](content.md) | `ContentBlock` and its parts — the one primitive every body, message, and comment holds |
| [spreadsheet revisions](spreadsheet-revisions.md) | what `resourceSnapshots` and `changeSets` hold for a spreadsheet, which is not what they hold for the other two |

`shared` and `content` have no `schema.ts` and appear in no schema fragment.

## Two rules every table follows

**Every index leads with `projectId`.** One deployment holds every project, so a
read that forgets the predicate reads everyone's rows. Leading with it makes the
scoped read the cheap one and an unscoped read something written on purpose.

Five tables are outside it. `users`, `projects`, and `memberships` decide what a
project *is*. `templates` and `templateVersions` belong to a person rather than a
project — a template is carried into whichever project wants one — so they lead
with `userId` and `templateId` instead.

`threads` declares no index at all: it is reached only by the id its owner
holds. It still stores `projectId`, so a row fetched by an id that arrived from
a link is checkable against the caller's project without a second read.

**An id pointing at another table is `v.id`**, except where the reference is
polymorphic — `(kind, id)` pairs where the kind names the table. Those stay
`v.string()` permanently, because a union of id types would make every reader
choose a branch to render one list.

## Schemas are a directory, one file per table

A capability with more than one table gets `schema/`:

```text
knowledge/schema/
├── schema.md                 what these tables are, together
├── lattice-nodes.ts
├── lattice-edges.ts
├── …
└── tables.ts                 knowledgeTables — the only thing convex/schema.ts imports
```

**A capability with exactly one table keeps `schema.ts` at its root.** A
directory holding one file and its document is worse than the file.

This needs `"schema"` added to `ALLOWED_DIRS` in
`app/scripts/lint/capabilities/rules.mjs`.

## Where a row can grow past the limit

A Convex document caps at 1 MiB and a patch rewrites the whole document. These
carry something unbounded, and each says how it is handled:

| Table | Field | |
| --- | --- | --- |
| `resourceSnapshots` | `body` | `part` splits it across rows |
| `resourceSnapshots` | a spreadsheet body's `rows` | `part`, with `rowPartCounts` in part 0 as the directory |
| `threadParts` | `messages` | `part`, plus a message cap in configuration |
| `changeSets` | `ops` | a delete carries what it removed, so it inverts. Left as is |
| `templates`, `templateVersions` | `body` | written whole and read whole. Left as is |
| `variables` | `value` | a ceiling set where the value is accepted, not a part scheme |
| `questions`, `hypotheses`, `findings` | `notes`, `body`, `sources`, and the relation lists | ceilings set where the value is accepted |
| `formulas` | `usedBy` | grows with the places holding one formula. Each entry is small |
| `comments` | `blocks` | a ceiling set where the remark is accepted |

## Related

[data models](../data-models/) · [processes](../processes/)

# Storage

What actually exists in Convex. Table names, indexes, and how the objects
described elsewhere map onto rows.

## Three views, and why they are separate

**[Data models](../data-models/)** say what a thing *is*. A document is a title,
page setup, styles, and rows of content blocks. That description is about the
domain and it stays true regardless of where it is kept.

**[Revisions](../data-models/revisions/)** say how a thing *changes* — head plus
change sets, rebasing, consolidation, retention.

**Storage** — this directory — says what *rows exist*. It is the synthesis, and
it is needed because the first two do not add up to an obvious answer.

The clearest case: `Document` in the data models has no `blocks` field, and there
is no table where a whole document sits. Reading one means a `documents` row, a
`resourceSnapshots` row, and a range of `changeSets` rows. Nothing in either of
the other views says that outright, and someone writing a query needs it said
outright.

## Everything is by project

Every table below carries `projectId` and indexes on it. There are two
exceptions and they are both global by nature: `users`, which is an account
rather than project content, and deployment-wide `personas` and `templates`,
which carry an optional `projectId` and mean "available everywhere" when it is
absent.

Tables reached through an already-scoped parent — `comments` by thread,
`hypotheses` by question, `messages` by chat — still store `projectId` anyway. A
query that has to join upward to check access is a query that will eventually
forget to.

## What is not a table

**Content blocks.** Blocks are embedded values inside the object holding them.
There is no `blocks` table and there never will be.

They do carry [ids](../data-models/README.md#ids-inside-a-resource), and those
are not Convex ids — they are short strings unique within one resource, used to
address a block inside a body that is stored as a whole. An id is not a row.

The same is true of every nested type in the models: rows, slide elements, sheet
cells, windows, style sets, page setup, marks, atoms. If it does not appear in the
inventory below, it lives inside something that does.

## Schema fragments

[`schema.ts`](../../app/src/convex/schema.ts) composes the deployment schema from
one fragment per capability, and it owns the list and nothing else. A capability
declares its own tables in its own `schema.ts`, so adding one does not mean
editing a file describing every other capability's storage.

Two fragments exist today — `access` and `settings`. The tables below are grouped
by the fragment each will belong to.

## Table inventory

### core

| Table | Holds | Key indexes |
| --- | --- | --- |
| `projects` | Name, description, archival, revision. The isolation boundary. | none — reached by `db.get` from a membership |
| `users` | Accounts. Global, not project-scoped. | `by_auth_subject` **unique** |
| `memberships` | One per (user, project): that user's own token for it, and their role. | `by_user_and_token`, `by_user_and_project` |
| `messages` | Turns in a thread. Role, blocks, author, tool calls, sources. | `by_thread`, `by_project` |

**`projects` has no index**, and that is deliberate: a project is never listed
globally, which would be the one query in the schema with no tenant predicate.

**`memberships.by_user_and_token` leads with `userId`, not `token`.** A
token-first index would resolve any token to its project regardless of who
presented it; with the user first, a copied URL lands in someone else's key range
and finds nothing. That lookup **is** the authorization, and it is why membership
is a table rather than an array on the project — you cannot index into an
embedded array. See
[project](../data-models/core/project.md#membership-is-a-table-and-the-token-is-why).

There is no `ownerId` on a project. Ownership is the membership whose `role` is
`owner`, and a stored copy could disagree with the row it copies.

**There is no `chats` table.** A thread has no object of its own — the
[research thread](../data-models/research/research.md),
[agent task](../data-models/ai/agent-task.md), or
[persona thread](../data-models/ai/persona-chat.md) row *is* the thread, and
`messages.by_thread` is `(thread.kind, thread.id)`.

Nor do those rows carry a thread pointer. Their `_id` is the key messages index
on, so the link is the index. This is the same relationship
[content blocks](../data-models/core/message.md#threads-exist-only-to-serve-their-consumer)
have with resources — messages are a table only because conversations grow
without bound, not because a thread is a thing.

### resources

| Table | Holds | Key indexes |
| --- | --- | --- |
| `documents` | Title and template origin. **No body, no revision.** | `by_project` |
| `slideDecks` | Title and aspect ratio. No body. | `by_project` |
| `spreadsheets` | Title only. No body. | `by_project` |
| `resourceSnapshots` | Materialized bodies at a revision, roled `base` / `leader` / `checkpoint`. | `by_resource_role` |
| `changeSets` | One accepted mutation each: ops, revision, baseRevision, tier. | `by_resource_revision` **unique**, `by_resource_tier` |
| `externalFiles` | Uploads, connector pulls, generated files, web captures. | `by_project`, `by_connector_external` |
| `connectors` | External system config, credential pointer, sync cursor. | `by_project` |
| `templates` | Resource skeletons with named slots. | `by_project` |
| `resourceSets` | Lazily-resolved set expressions over resources. | `by_project` |

See [general resources](general-resources.md) for how the first five work
together, and why the bodies are not on the resource rows.

`by_connector_external` is `(connectorId, externalId)` — how a re-sync matches a
remote file to the row it already created instead of duplicating it.

### data

| Table | Holds | Key indexes |
| --- | --- | --- |
| `nameVariables` | Named project variables — the shared vocabulary for formulas and analyses. | `by_project_nameKey` **unique**, `by_project_order` |
| `analyses` | Saved chart and table definitions: inputs, joins, shelves, filters, display. | `by_project` |

Formula has no table. An expression is text on the block holding it, evaluated on
demand — see [name manager](../data-models/data/name-manager.md#what-is-not-here).

### knowledge

| Table | Holds | Key indexes |
| --- | --- | --- |
| `latticeNodes` | Windows at level 0, clusters above. Centroid, merged windows, parent. | `by_project_clustered`, `by_project_level`, `by_parent`, `by_tier_source`, vector on `centroid` |
| `latticeEdges` | Full-dimensional weighted links within a level. | `by_from_level`, `by_to_level` |
| `latticeLevelIndexes` | Per level: PCA basis, IVF centroids, threshold, k. Derived. | `by_project_level` **unique** |
| `latticeVersions` | One per project: embedding model, level count, readiness. | `by_project` **unique** |
| `latticeChanges` | Node sets produced per source change, with the cause. | `by_project` |
| `derivedOutputs` | Prompt, scope, declared inputs, the one generated block. | `by_project` |

`by_project_clustered` serves two readers at once: the [clustering
pass](../data-models/knowledge/knowledge-lattice.md#not-everything-clusters-and-that-is-load-bearing)
asks it for work remaining, and
[retrieval](../processes/lattice-retrieval.md#the-frontier) asks it for the
frontier. They are the same set.

`latticeLevelIndexes` is entirely derived and can be dropped and rebuilt, which
is what makes retuning `pcaDims` or the cell count a rebuild rather than a
migration.

### research

| Table | Holds | Key indexes |
| --- | --- | --- |
| `questions` | The question text, rich notes, status, parent. | `by_project`, `by_parent` |
| `hypotheses` | A claim, its assessment and confidence. No question field. | `by_project` |
| `findings` | The durable writeup, with sources carrying their own excerpts. | `by_project` |
| `researchLinks` | The many-to-many edges: a bearer bears on a subject, with `bearing`. | `by_bearer`, `by_subject`, `by_bearer_subject` **unique** |
| `researchThreads` | Mode and anchor. Is itself a thread. | `by_project`, `by_question` |

All are top-level and independent — each references the others and none is
subordinate. That independent purpose is why they are tables while a thread is
not.

`researchLinks` carries every question↔hypothesis, question↔finding, and
hypothesis↔finding relationship, which is why none of the three rows hold
foreign keys to each other. `by_bearer` is `(bearerKind, bearerId)` and
`by_subject` is `(subjectKind, subjectId)`, so both directions are one indexed
read.

`bearing` lives on the link rather than the finding. That is what lets one
finding support one hypothesis and contradict another — impossible while it was a
field on the finding itself.

### ai

| Table | Holds | Key indexes |
| --- | --- | --- |
| `personas` | Five-section definition, scope, tools, model binding name. | `by_project` |
| `personaThreads` | A conversation with a persona, and what it branched from. Is itself a thread. | `by_persona`, `by_project` |
| `agentTasks` | Title, prompt, status, plan, result. Is itself a thread. | `by_project_status`, `by_persona` |
| `automations` | One trigger, one action, last-run summary. | `by_project` |

**No `providers` or `modelBindings` tables.**
[Intelligence](../processes/intelligence.md) is configuration, not content — it
lives in [`app/configuration/`](../../app/configuration/), and a persona's
`modelBinding` is a name resolved against it.

### collaboration

| Table | Holds | Key indexes |
| --- | --- | --- |
| `commentThreads` | An anchor into any object, plus resolved state. | `by_project`, `by_target` |
| `comments` | Blocks, author, mentions. | `by_thread` |
| `activity` | Append-only log: actor, verb, target, with labels frozen in. | `by_project` |

`commentThreads.by_target` is `(targetType, targetId)` — a comment anchors to any
object by kind and id, which is why [kinds are
namespaced](../data-models/special-resources/external-file.md#kind-is-derived-from-the-extension)
across every domain.

## There are no unique indexes

Convex indexes are not unique, and it has no unique constraint. Every table above
marked **unique** describes an *invariant the mutation maintains*, not something
the database enforces.

That is safe, and the reason is worth stating because it is what the whole
concurrency story rests on: **Convex mutations are serializable transactions with
optimistic concurrency control.** A mutation that reads the current maximum
revision and inserts one above it either commits against the state it read, or
has its read set invalidated by a concurrent write and is re-run automatically
against the new state.

So the pattern is read-then-insert inside one mutation, and the isolation does
the rest. No version field, no retry loop, no compare-and-swap primitive —
`changeSets` gets its
[revision guarantee](../data-models/revisions/change-set.md#revision-is-an-index)
this way, and so do `users.by_auth_subject`, `latticeVersions.by_project`, and
`nameVariables`.

What this does mean is that uniqueness has exactly one enforcement point per
invariant. A second code path inserting without the check breaks it silently, so
these writes belong behind one function each.

## Project scoping

Every table holding project content carries `projectId` and indexes on it. The
project is the isolation boundary and every query filters by it.

The exceptions are the tables reached through a parent that is already scoped —
`comments` by thread, `hypotheses` by question, `messages` by thread,
`personaThreads` by persona. They still store `projectId`, because a query that
has to join upward to check access is a query that will eventually forget to.

## Related

[build order](build-order.md) · [data models](../data-models/) ·
[revisions](../data-models/revisions/) · [processes](../processes/) ·
[general resources](general-resources.md)

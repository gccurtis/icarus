# Resource Sets

A way of naming a group of resources — for retrieval scope, for generation
inputs, for anything that needs to say *these* rather than everything.

Named "resource set" rather than "context" because context already means a
model's window, a conversation's history, and the surrounding situation. This is
none of those.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the project's saved sets, as expressions |
| `resolve` | query | what an expression selects **right now** |
| `create` | mutation | names an expression, returning its id |
| `revise` | mutation | replaces one, against the revision the author read |

Registered in
[`src/convex/capabilities/resourceSets.ts`](../../../convex/capabilities/resourceSets.ts),
all four built from `projectQuery` / `projectMutation`.

There is no `remove`. A set is pointed at by other sets, by a persona's scope,
and by every prompt block that names it, so deleting one has to decide what those
become — and that decision waits until something actually holds those references.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `resourceSets` | one row per set: its name and the expression that selects its members |

## A set is an expression, resolved when used

The central decision, and the reason this is a model rather than an array field.

`{ op: "project" }` means *the resources in this project*, and a document created
tomorrow is in it. An id list captured today would not be — it would silently
mean "the project as it was", and every set anyone made would start decaying the
moment they saved it.

So nothing here stores a member list, and
[`resolve`](api/resolve/resolve.md) writes nothing at all. What it returns is a
snapshot: what the set meant at that moment. A consumer that needs to remember
what it actually saw records the refs and their revisions in its own row. **The
set stays lazy; the consumer captures.**

## Union, difference, and no intersection

Both operators are needed because the useful expressions are subtractive:
`difference(project, kind("document"))` is the natural way to say a real thing,
and without difference it has to be written as an enumeration that stops being
true as soon as anything is added.

`union` takes a list rather than a pair, so combining five kinds is one node
rather than four nested ones.

**Intersection is not a primitive.** `A ∩ B` is `difference(A, difference(A, B))`,
and an operator for it would be a third way to write what two already cover. The
identity is asserted in the tests instead. If real expressions turn out to need
it constantly it can be added, on evidence.

## A connector expands to its files

A `connector` ref does not mean the connector row. It means the files that
connector brought in, resolved lazily, so a set scoped to a Drive connector picks
up whatever the last sync added. Scoping to a source is what people actually
want: "answer from the material in our Notion", not "answer from a credential
record".

`connectors` does not exist until pass 8, and this does not wait for it: the
files are what a set selects either way, so
[`connectorFiles`](api/resolve/connector-files.ts) reads `externalFiles.origin.connectorId`
and will not change when the table arrives. The ref's id is a `v.string()` for
the same reason `Mention` carries one — `v.id` names a table the schema must
declare — and it tightens in the task that creates `connectors`.

## Findings are resources; questions and hypotheses are not

Settled in [`$shared`](../shared/types/resource.ts), which owns the kind union
because three capabilities answer to it. A finding is durable project content
with a body that gets cited and indexed. A question is what we do not know, and
retrieving over it would return the asking rather than an answer. Messages are
outside both — a message worth keeping is promoted to a finding, and the
promotion is the editorial act worth indexing.

## What resolution does not curate

**Superseded files are members.** A new version of a file is a new row and the
old one stays readable; which of them a surface shows is
[that surface's decision](../external-files/api/list/list.md), and a set is a
selection mechanism rather than a better place to make it. A consumer that must
not see both folds the chain by `supersedes`.

**A global template is in no project's set.** A row is a member when its
`projectId` is the caller's, which is one rule for every kind and makes reaching
another project's material impossible by construction. A template belonging to
every project is held by none.

## Capability Invariants

- **A refusal is "not found", never "forbidden"** for a set in another project,
  and a *ref* to another project's resource is dropped rather than refused —
  both so that a caller learns nothing from the answer.
- **A cycle fails, naming the sets in it.** Two sets referencing each other is a
  configuration mistake rather than a meaningful expression. The refusal carries
  the loop as a field, because whoever has to break it needs to know which sets
  are in it.
- **References are checked when resolved, never when saved.** The only complete
  check is at resolution — a cycle takes two writes to make, and what a set
  selects depends on rows that change afterwards — so a check at write time would
  suggest a guarantee that does not exist.
- **Attribution is built from the scope**, never accepted as an argument.
- **Every refusal is thrown as `ResourceSetsError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Deferred to later passes

| Today | When | Becomes |
| --- | --- | --- |
| a `connector` ref carries a `v.string()` id | pass 8 | `v.id("connectors")`, resolving through the same files |
| nothing consumes a resolution | pass 6–7 | lattice retrieval scopes by one, and derived outputs record what they resolved |

## Related

[resource set](../../../../../docs/data-models/special-resources/resource-set.md) —
the model this implements ·
[knowledge lattice](../../../../../docs/data-models/knowledge/knowledge-lattice.md) —
what a scope restricts ·
[personas](../personas/overview.md) — the first thing to carry an expression

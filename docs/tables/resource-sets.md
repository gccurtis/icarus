# Resource sets

One table, and the vocabulary three other tables borrow from it.

`resourceSets`

A set is stored as the **rule that selects its members**, never as the members.
An enumerated list captured on save would mean "the project as it was", and every
set anyone made would start decaying the moment it was written. A selection is
resolved when it is used, so a document created tomorrow is already inside
`{ select: "project" }`.

---

## `resourceSets`

`app/src/lib/capabilities/resource-sets/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { resourceSelectionValidator } from "$shared/types/resource-selection";
import { actorValidator } from "$shared/types/actor";

/**
 * A named group of resources.
 *
 * **`revision` is not Convex's concurrency control.** Convex serializes two
 * mutations in flight already, so that case is covered. This catches the one
 * serializability cannot see: somebody read the set an hour ago, left the editor
 * open, and submitted against a row that has since moved.
 *
 * One index. A project holds few enough sets that they are listed whole, and
 * every other read reaches a set by id.
 */
export const resourceSetsTables = {
  resourceSets: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    selection: resourceSelectionValidator,
    createdBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};
```

---

## What a selection is

### The vocabulary

`app/src/lib/capabilities/shared/types/resource.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * What a project holds and works over — the kinds a selection can name and the
 * kinds retrieval can index.
 *
 * **A finding is one of them.** It is durable project content with a body, it is
 * cited, and "answer from our findings only" is an obvious thing to want. A
 * question and a hypothesis are the project's *open threads* rather than its
 * material, so neither is here: retrieving over a question would return the
 * asking rather than an answer.
 *
 * **A template is not one of them.** A template is what makes a resource, and is
 * not itself project content — it belongs to a person rather than a project, and
 * putting it in a scope would offer people the skeleton in place of the thing.
 *
 * **Messages are outside it deliberately.** A conversation is working material,
 * and a message worth keeping is promoted to a finding — the promotion is the
 * editorial act worth indexing, not the raw transcript.
 *
 * **An open string, prefix-matched, not a closed union.** Naming a kind names
 * every subkind under it: `externalFile` is every uploaded file and
 * `externalFile::image` is the pictures. A closed union cannot express a space
 * that grows with every integration without making each one a schema change.
 * The base kinds:
 *
 * ```text
 * document  slides  spreadsheet  externalFile  connection  finding
 * ```
 *
 * with subkinds after `::`. The cost is honest and worth stating: nothing
 * validates the string, so a typo in a kind is a silent miss rather than a
 * rejected write.
 *
 * No list of base kinds is exported. Naming them in an array invites reading an
 * open space as closed, which is the one thing the open string exists to avoid.
 */
export const resourceKindValidator = v.string();

export type ResourceKind = Infer<typeof resourceKindValidator>;

/** The delimiter between a kind and its subkinds. */
const SUBKIND = "::";

/**
 * Whether `kind` falls under `pattern` — segment-wise prefix matching, to any
 * depth.
 *
 * **Segments, not raw string prefixes.** `externalFile::doc` must not match
 * `externalFile::document`, and a `startsWith` would say it does. Comparing
 * segments also means arbitrary depth costs nothing — the comparison never knows
 * how many levels there are, so a subkind can have a subkind.
 */
export const kindMatches = (pattern: ResourceKind, kind: ResourceKind): boolean => {
  const patternSegments = pattern.split(SUBKIND);
  const kindSegments = kind.split(SUBKIND);

  return (
    patternSegments.length <= kindSegments.length &&
    patternSegments.every((segment, index) => segment === kindSegments[index])
  );
};

/**
 * A specific resource, with its kind beside its id.
 *
 * The kind is stored rather than looked up, because a selection has to resolve
 * without probing every table to discover what each id is — and because a kind
 * with its subkind should be readable without opening the row it names.
 */
export const resourceRefValidator = v.object({
  kind: resourceKindValidator,
  /** A string permanently: several tables answer to it. */
  id: v.string()
});

export type ResourceRef = Infer<typeof resourceRefValidator>;
```

### The selection

`app/src/lib/capabilities/shared/types/resource-selection.ts`

```ts
import { v, type Infer } from "convex/values";
import { resourceKindValidator, resourceRefValidator } from "$shared/types/resource";

/**
 * Terms that carry no id, and therefore mean something in any project.
 *
 * This is the whole of what makes a selection portable, which is why it is a
 * type rather than a rule somebody has to remember: a template variable's
 * default is one of these, so a template landing in a new project resolves
 * against that project instead of the one it was authored in.
 */
const projectTerm = v.object({ select: v.literal("project") });

const kindsTerm = v.object({
  select: v.literal("kinds"),
  kinds: v.array(resourceKindValidator)
});

export const portableTermValidator = v.union(projectTerm, kindsTerm);

/**
 * Terms bound to one project — ids, and ids reached through another set.
 *
 * `setId` is an ordinary self-reference: `v.id("resourceSets")` is a tagged
 * string, so it needs the table's *name* and not its validator. Following one
 * reads another row, whose selection may name a third, without limit.
 */
const resourcesTerm = v.object({
  select: v.literal("resources"),
  refs: v.array(resourceRefValidator)
});

const setTerm = v.object({
  select: v.literal("set"),
  setId: v.id("resourceSets")
});

/**
 * One way of naming resources.
 *
 * **`select` rather than `op`.** A term is not an operation — it says what it
 * picks out, and borrowing the word would read as one of the five change ops
 * every time it appeared.
 *
 * `kinds` takes a list, so "documents and decks" is one term rather than two
 * wrapped in a third. Each entry is prefix-matched, so one entry can name a
 * whole family — `externalFile` reaches every subkind beneath it.
 */
export const setTermValidator = v.union(projectTerm, kindsTerm, resourcesTerm, setTerm);

export type SetTerm = Infer<typeof setTermValidator>;

/**
 * Everything in `include`, minus everything in `exclude`.
 *
 * **Two flat lists rather than a tree.** A tree of unions and differences would
 * need a validator that names itself while it is being constructed, which a
 * Convex validator cannot do — it is a runtime value, not a type — so it would
 * have to be unrolled to a fixed depth. Two lists have no self-reference at all,
 * so nothing anywhere is depth-limited.
 *
 * What a single row cannot say directly, a named set says instead:
 *
 * | wanted | written as |
 * | --- | --- |
 * | `A − (B − C)` | name `B − C`, exclude it |
 * | `(A − B) ∪ (C − D)` | name each half, include both |
 * | `A ∩ B` | name `project − B`, exclude it |
 *
 * Each one is a selection convoluted enough to deserve a name a person can read,
 * so the escape hatch is also the better authoring.
 */
export const resourceSelectionValidator = v.object({
  include: v.array(setTermValidator),
  exclude: v.array(setTermValidator)
});

export type ResourceSelection = Infer<typeof resourceSelectionValidator>;

/** A selection a template can carry between projects. */
export const portableSelectionValidator = v.object({
  include: v.array(portableTermValidator),
  exclude: v.array(portableTermValidator)
});

export type PortableSelection = Infer<typeof portableSelectionValidator>;
```

---

## Two rules the table cannot state

**An empty `include` selects nothing.** It is the only reading under which
excluding from it behaves, which makes a set with no include terms a row that can
never mean anything. A Convex validator has no minimum array length, so this is a
stored-form check where the selection is accepted, next to the one that keeps a
name from being blank.

**A set can reach itself.** `A` includes `B`, `B` includes `A`. Nothing about the
stored shape prevents it, and the cycle is refused when the selection is
resolved — which is why a set's name is required: the refusal has to name the
set that closed the loop.

---

## Where else a selection appears

The same question is asked in four places, which is why the type lives in
`shared` rather than here:

| | |
| --- | --- |
| `resourceSets.selection` | what the set means |
| `derivedOutputs.scope` | optional — absent means the whole project |
| prompt blocks | `scope`, optional until a template fills it |
| `personas` | the scope an agent works over |

Each holds the selection **inline** rather than an `Id<"resourceSets">`. A field
holding an id could not express a private, unnamed scope without a hidden row to
create, delete, and filter out of every list; a field holding a selection covers
both, because naming a set is one term inside it:

```ts
{ include: [{ select: "set", setId: marketing }], exclude: [] }
```

A set that is later deleted leaves a `setId` that resolves to nothing and
contributes nothing, which is the same call already made for `templateId` on the
three resources.

---

## A kind and its subkind live in different places

The base kind is what the *table* is — nothing stores it, because a row in
`externalFiles` is an `externalFile` and the column would hold the same value
every time. What each row stores is its **subkind**, and the full kind is the two
joined:

```text
externalFiles.subkind = "image"    →  externalFile::image
connections.subkind   = "text"     →  connection::text
```

Which is also what makes a selection cheap to resolve: the prefix of
`externalFile::image` names the table to read, and the remainder is what to match
its `subkind` column against.

---

## Files

```text
app/src/lib/capabilities/resource-sets/
└── schema.ts                       resourceSetsTables

app/src/lib/capabilities/shared/types/
├── resource.ts                     ResourceKind, ResourceRef
└── resource-selection.ts           SetTerm, ResourceSelection, PortableSelection
```

One table, so `schema.ts` is a file rather than a directory.

**Imports it does not define:** `$shared/types/actor`.

## Related

[all tables](README.md) · [templates](templates.md) · [knowledge](knowledge.md)

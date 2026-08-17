# Resource set

A way of naming a group of resources — for retrieval scope, for generation
inputs, for anything that needs to say *these* rather than *everything*.

Named "resource set" rather than "context" because context already means too
many things: a model's window, a conversation's history, the surrounding
situation. This is none of those. It is a set of resources.

```ts
interface ResourceSet {
  projectId: Id<"projects">;
  name: string;
  description?: string;
  expression: ResourceSetExpression;
  createdBy: Actor;
  revision: number;
  updatedAt: number;
}

interface ResourceSetExpression {
  include: Selector[];
  exclude: Selector[];
}

type Selector =
  | { kind: "project" }
  | { kind: "resourceKind"; resourceKind: ResourceKind }
  | { kind: "resource";     ref: ResourceRef }
  | { kind: "set";          setId: string };

interface ResourceRef {
  kind: ResourceKind;
  id: string;
}

/** Open, not a closed union. Base kinds today: */
type ResourceKind = string;   // "document" | "slides" | "spreadsheet"
                              // "externalFile" | "finding"
                              // "connector" | "template" | …
```

## Two flat lists, not a tree

**Any tree of unions and differences normalizes to one include set and one
exclude set.** Unions merge into the include side, differences into the exclude
side, and nesting deeper never produces anything the two lists cannot already
say. So there is no `union` node, no `difference` node, and no recursion.

That also removes a limit nobody wanted: the tree form had to be unrolled to a
fixed depth, because a Convex validator is a value and cannot refer to itself.
Flattening makes depth meaningless rather than bounded.

**The real prize is a canonical form.** Under the tree, one set had many
spellings and none of them could be compared — two scopes that meant the same
thing were not equal to anything. Normalizing on write leaves exactly one
representation of each set, so two of them can be diffed:

| Rule | Effect |
| --- | --- |
| `project` appears in `include` | Drop every other include — it already covers them |
| A `resourceKind` appears in a list | Drop the `resource` selectors it matches from the same list |
| A selector appears in both lists | `exclude` wins; the include is dropped |
| Duplicate selectors | Collapse |

**An empty `include` resolves to nothing, not everything.** Everything is
`{ include: [{ kind: "project" }] }`, said out loud. An empty list is what an
unfinished form produces, and a default that silently meant "the whole project"
is how a scope somebody meant to narrow leaks the lot.

## The kind is an open string

`ResourceKind` is not a closed union, because a connector is a provider *and* a
version rather than one thing, and integrations keep arriving. Subkinds are
written with `::` — `connector::google-docs::v1`,
[`external::image`](external-file.md#kind-is-derived-from-the-extension) — and
matching is segment-wise prefix matching to any depth, so `connector` selects
every provider and `connector::google-docs` selects every version of one.

Segments rather than raw string prefixes, so `connector::google` does not match
`connector::googlesheets`. The cost is honest: an open string is not validated,
so a typo in a kind is a silent miss rather than a rejected write. A closed union
would catch that and would make every new integration a schema change.

## An expression, not a list

The central decision. A set is stored as an expression that is **resolved when
used**, not as an enumerated list of ids.

`{ kind: "project" }` means *the resources in this project*, and a document
created tomorrow is in it. An id list captured today would not be — it would
silently mean "the project as it was", and every set anyone made would start
decaying the moment they saved it.

That is the whole reason this is a model rather than an array field. Lazy
evaluation is what makes a saved scope stay correct.

## Subtraction is what makes it useful

The useful expressions are subtractive. "Everything in the project except the
documents" is the natural way to say a real thing, and without an exclude side it
has to be written as an enumeration that stops being true as soon as anything is
added.

```text
{ include: [{ kind: "project" }],
  exclude: [{ kind: "resourceKind", resourceKind: "document" }] }
```

Intersection is not a primitive. `A ∩ B` is `A` minus everything not in `B`, and
a third operator would be a second way to write what these two lists already
cover. If real expressions turn out to need it constantly it can be added, on
evidence.

## Selectors

`{ kind: "resourceKind" }` is the per-kind catch-all: all documents, all external
files. Same laziness as `project`, one level down — and because kinds are
[segment-matched](#the-kind-is-an-open-string), `external` selects every file
without naming the families under it.

`{ kind: "resource" }` is the explicit case — one specific thing, named by a
`ResourceRef`. The kind is stored beside the id rather than looked up, because a
set has to be resolvable without probing every table to find out what each id is.

Both appear in either list, and that is the whole vocabulary: a set is what these
select, minus what they exclude.

## A connector expands to its files

A `connector` ref in a set does not mean the connector document. It means **the
files that connector brought in** — resolved lazily, so a set scoped to a Drive
connector picks up whatever the last sync added.

This is why `connector` is a resource kind here despite not being content
itself. Scoping to a source is what people actually want: "answer from the
material in our Notion", not "answer from a credential record".

## References between sets

`{ kind: "set" }` lets one set build on another, so a broadly useful scope is
defined once and narrowed in several places. It resolves at use time, so nesting
happens during resolution rather than in the stored shape.

Resolution must detect cycles. Two sets referencing each other is a
configuration mistake rather than a meaningful expression, and the resolver
fails naming them rather than recursing.

## Where sets are used

**[Knowledge lattice](../knowledge/knowledge-lattice.md) retrieval.** A search
is scoped to a set, restricting which nodes are eligible by their source. No set
supplied means the whole project — the sensible default and the common case.

**[Prompt blocks](../content/content-block.md#prompt-blocks).** A block's `scope`
limits what its refresh may draw on.

**[Derived outputs](../knowledge/derived-output.md).** The declared inputs a
generation runs against.

In each case the expression may be written inline rather than referencing a saved
set — `{ kind: "set" }` is what connects the two, so there is one mechanism and
not a separate inline and saved form.

The type lives in the shared vocabulary rather than with this table, because a
persona's scope, a prompt block's, and a derived output's inputs are the same
question — and whichever table was built first would be an odd place for the
others to import from.

## Resolution is a point in time

Resolving produces a concrete list of `ResourceRef`. That list is a snapshot: it
is what the set meant at that moment, and it is not stored on the set.

Where a consumer needs to remember what it actually saw — a derived output
explaining its output — it records the resolved refs and their revisions itself,
in its own `inputsAt`. The set stays lazy; the consumer captures.

## Findings are resources; questions and hypotheses are not

A [finding](../research/finding.md) is a resource kind. It is a durable piece of
project content with a body, it is cited, it is indexed by the
[lattice](../knowledge/knowledge-lattice.md), and "answer from our findings only"
is an obvious thing to want to scope to.

[Questions](../research/question.md) and
[hypotheses](../research/hypothesis.md) are not. They are the project's open
threads rather than its material — a question is what we do not know, and
retrieving over it would return the asking rather than an answer.

## Every lattice source is a resource kind

The kinds a [lattice node](../knowledge/knowledge-lattice.md) can come from are a
subset of these, never anything else. That is the invariant that makes scoping
total: anything retrieval can index, a scope can select.

It runs one way only. `template` and `connector` are resource kinds that are not
lattice sources — a template is a skeleton and a connector is configuration, and
neither has content worth retrieving in its own right.

**Messages are deliberately outside both.** A conversation is working material,
and indexing it would fill retrieval with half-formed reasoning and abandoned
turns. A message worth keeping is
[promoted to a finding](../research/finding.md), which gives it a title, sources,
and a place in the graph — and that promotion is the editorial act the lattice
should be indexing, not the raw transcript.

## What is not a resource

[Agent tasks](../ai/agent-task.md), [personas](../ai/persona.md),
[automations](../ai/automation.md), comments, and activity. Resources are what a
project holds and works over; these are how the work gets done.

## Related

[knowledge lattice](../knowledge/knowledge-lattice.md) ·
[derived output](../knowledge/derived-output.md) ·
[content block](../content/content-block.md#prompt-blocks) ·
[connector](connector.md)

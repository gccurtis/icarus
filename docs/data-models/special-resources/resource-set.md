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
  expression: SetExpression;
  createdBy: Actor;
  updatedAt: number;
}

type SetExpression =
  | { op: "project" }
  | { op: "kind"; kind: ResourceKind }
  | { op: "resources"; refs: ResourceRef[] }
  | { op: "set"; setId: Id<"resourceSets"> }
  | { op: "union"; of: SetExpression[] }
  | { op: "difference"; from: SetExpression; remove: SetExpression };

interface ResourceRef {
  kind: ResourceKind;
  id: string;
}

type ResourceKind =
  | "document"
  | "slides"
  | "spreadsheet"
  | "externalFile"
  | "connector"
  | "template";
```

## An expression, not a list

The central decision. A set is stored as an expression that is **resolved when
used**, not as an enumerated list of ids.

`{ op: "project" }` means *the resources in this project*, and a document created
tomorrow is in it. An id list captured today would not be — it would silently
mean "the project as it was", and every set anyone made would start decaying the
moment they saved it.

That is the whole reason this is a model rather than an array field. Lazy
evaluation is what makes a saved scope stay correct.

## Union and difference

Both are needed because the useful expressions are subtractive. "Everything in
the project except the documents" is the natural way to say a real thing, and
without difference it has to be written as an enumeration that stops being true
as soon as anything is added.

```
difference(project, kind("document"))
```

Intersection is not a primitive. It is expressible — `A ∩ B` is
`difference(A, difference(A, B))` — and adding it as an operator would be a third
way to write things the two existing operators already cover. If real expressions
turn out to need it constantly it can be added, on evidence.

`union` takes a list rather than a pair so that combining five kinds is one node
rather than four nested ones.

## Catch-alls per kind

`{ op: "kind" }` is the per-kind catch-all: all documents, all external files.
Same laziness as `project`, one level down.

`{ op: "resources" }` is the explicit case — a handful of specific things,
each with its kind alongside its id. The kind is stored rather than looked up
because a set has to be resolvable without probing every table to find out what
each id is.

## A connector expands to its files

A `connector` ref in a set does not mean the connector document. It means **the
files that connector brought in** — resolved lazily, so a set scoped to a Drive
connector picks up whatever the last sync added.

This is why `connector` is a resource kind here despite not being content
itself. Scoping to a source is what people actually want: "answer from the
material in our Notion", not "answer from a credential record".

## References between sets

`{ op: "set" }` lets one set build on another, so a broadly useful scope is
defined once and narrowed in several places.

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
set — `{ op: "set" }` is what connects the two, so there is one mechanism and not
a separate inline and saved form.

## Resolution is a point in time

Resolving produces a concrete list of `ResourceRef`. That list is a snapshot: it
is what the set meant at that moment, and it is not stored on the set.

Where a consumer needs to remember what it actually saw — a derived output
explaining its output — it records the resolved refs and their revisions itself,
in its own `inputsAt`. The set stays lazy; the consumer captures.

## What is not a resource

Research objects — [questions](../research/question.md),
[hypotheses](../research/hypothesis.md), [findings](../research/finding.md) — are
not resource kinds, and neither are [agent tasks](../ai/agent-task.md) or
messages. Resources are the things a project holds; research objects are what it
concludes.

The lattice does index findings, so scoping retrieval to "findings only" is not
currently expressible. That is a known gap rather than a decision, and the fix is
either a kind here or a separate axis on retrieval — worth settling when the
lattice's own model is revisited.

## Related

[knowledge lattice](../knowledge/knowledge-lattice.md) ·
[derived output](../knowledge/derived-output.md) ·
[content block](../content/content-block.md#prompt-blocks) ·
[connector](connector.md)

# Derived output

Generated content that stays connected to what it was generated from. A summary
that updates when the findings change; a section of a report that regenerates
when its inputs move.

```ts
interface DerivedOutput {
  projectId: Id<"projects">;
  prompt: string;
  scope?: ResourceSetExpression;   // what retrieval may draw on
  inputs: DerivedInput[];
  block: ContentBlock;         // the generated content — exactly one
  state: "idle" | "generating" | "fresh" | "stale" | "error";
  error?: string;
  model?: string;
  inputsAt: InputRevision[];   // what the inputs were when this was generated
  latticeVersion?: number;
  refreshedAt?: number;
  createdBy: Actor;
  updatedAt: number;
}

type InputRevision =
  | { kind: "resource"; resourceType: ResourceKind; resourceId: string; revision: number }
  | { kind: "file"; fileId: Id<"externalFiles"> }
  | { kind: "finding"; findingId: Id<"findings"> };

type DerivedInput =
  | { kind: "file"; fileId: Id<"externalFiles"> }
  | { kind: "resource"; resourceType: "document" | "slides" | "spreadsheet"; resourceId: string }
  | { kind: "question"; questionId: Id<"questions">; includeFindings?: boolean }
  | { kind: "finding"; findingId: Id<"findings"> }
  | { kind: "lattice"; query: string; limit?: number };
```

## Output is one block

Exactly one [content block](../content/content-block.md), not a list. A derived
output fills a position in a resource — the position a [prompt
block](../content/content-block.md#prompt-blocks) occupies — and a position holds
one block.

Generation that produces a whole section is a different thing: that is authoring
a document, and it should produce a document. Allowing a list here would make
every consumer handle a variable-length insertion into a body it does not own.

It is a block rather than a string so generated content can be edited in place
with the same editor, which is what makes the prompt block arrangement work.

## Scope

`scope` is a [resource set](../special-resources/resource-set.md) expression
limiting what retrieval may draw on. Absent means the whole project.

It is an expression rather than a resolved list so it stays correct as the
project grows — "the connector-synced files" keeps meaning that after the next
sync. What each generation actually saw is captured separately, in `inputsAt`.

## Inputs are declared

`inputs` is the explicit set of things this output is derived from. It is not
inferred from the prompt and it is not "whatever the model happened to
retrieve".

Declaring them is what makes staleness computable: when an input changes, this
output becomes `stale`. Without a declared set there is no way to know what
would need to change for the output to be wrong, and every output would either
refresh constantly or never.

The `lattice` input is the exception, and it is a query rather than a set — "the
top passages about pricing" resolves differently over time by design. An output
with only lattice inputs is refreshed on request rather than on a change signal.

## Stale is not error

Five states, and the distinction between them carries weight. `stale` means the
content is still correct as of its last refresh and its inputs have since moved
— perfectly displayable, with a marker. `error` means the last attempt failed
and the shown content is whatever survived from before.

Neither clears `blocks`. An output that emptied itself on a failed refresh would
turn a transient provider outage into a hole in someone's report.

## Where the shaping comes from

A [prompt block](../content/content-block.md#prompt-blocks) references a derived
output and holds its own editable copy of the blocks. When someone edits that
copy, the edit is theirs — displayed immediately, stored on the block, not
written back here.

On the next refresh that edited content is passed to the generator as the shape
to preserve, so a refresh updates the facts without discarding the phrasing and
structure a person chose. The derived output keeps the canonical generated
version; the block keeps the presented one. Two copies, deliberately, because
they answer different questions: what the generator last produced, and what the
reader is looking at.

## Provenance for the current generation only

`inputsAt` records the revision of every input as it stood when this content was
generated, and `latticeVersion` records which lattice was queried.

This is what makes the output explicable. "Why does the summary say revenue
grew" is answerable by reading the source at the revision the generation
actually saw, rather than at the revision it has since become — without it, a
stale output is indistinguishable from a hallucination. It is also how staleness
is computed precisely rather than by timestamp: an input whose current revision
exceeds the one recorded here is what makes the output `stale`.

## Past generations are not kept

A refresh replaces the body wholesale, so keeping previous versions means storing
the whole thing again, every time. There is no op log to reconstruct from — the
generator does not emit edits, it emits a body.

Storing a partial history would be worse than storing none. A generation whose
inputs and prompt were not also captured cannot be trusted to show what it was
derived from, and capturing those means duplicating everything again. So the
current generation carries full provenance and prior ones are discarded.

Where a past state genuinely matters, it is because something *used* it — and
the thing that used it is what should have recorded what it read.

Nor is a derived output an undo target. It is a function of its inputs at their
current revisions, so reverting the edit that changed it is what restores it:
the [undo](../revisions/README.md#undo) produces a new change set, the inputs
move back, this output goes `stale`, and a refresh regenerates it. Undoing the
output directly would be undoing an effect rather than a cause.

## Related

[content block](../content/content-block.md#prompt-blocks) ·
[knowledge lattice](knowledge-lattice.md) ·
[revisions](../revisions/README.md) ·
[finding](../research/finding.md)

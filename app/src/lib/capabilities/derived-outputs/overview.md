# Derived Outputs

Generated content that stays connected to what it was generated from. A summary
that updates when the findings change; a paragraph of a report that regenerates
when its inputs move.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the project's outputs, without their content, each marked fresh or stale |
| `read` | query | one output whole, with its state folded |
| `create` | mutation | declares one: a prompt, its inputs, and what retrieval may draw on |
| `refresh` | mutation | asks for a generation, and returns what a generator needs |

Registered in
[`src/convex/capabilities/derivedOutputs.ts`](../../../convex/capabilities/derivedOutputs.ts),
all four built from `projectQuery` / `projectMutation`.

**Recording what a generation produced is not public.**
[`completeGeneration` and `failGeneration`](api/shared/shared.md) are registered
nowhere: a client that could write a body under an output's id could put anything
in somebody's report and have it dated as generated.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `derivedOutputs` | one row per output: the prompt, the declared inputs, the one generated block, and where those inputs stood when it was produced |

## The output is one block

Exactly one [content block](../content/overview.md), never a list. An output
fills the position a [prompt block](../content/types/block.ts) occupies, and a
position holds one block.

Generation that produces a whole section is a different thing: that is authoring
a document, and it should produce a document. A list here would make every
consumer handle a variable-length insertion into a body it does not own.

It is a block rather than a string so generated content is edited in place with
the same editor, which is what makes the prompt block arrangement work at all.

## Inputs are declared, and that is what makes staleness computable

`inputs` is the explicit set an output is derived from. It is not read off the
prompt and it is not "whatever the model happened to retrieve".

Without a declared set there is no way to say what would have to change for an
output to be wrong, so every output would either refresh constantly or never.
With one, `inputsAt` records where each input stood at generation time and
staleness is the comparison — **an input whose current revision exceeds the
recorded one**, never a timestamp. A row touched without producing a revision
changes nothing, which is exactly the case a `updatedAt > refreshedAt` check gets
wrong every time somebody opens a document.

The `lattice` input is the exception, and it is a query rather than a set: "the
top passages about pricing" resolves differently over time by design. It records
nothing, so an output with only lattice inputs never goes stale on its own and is
refreshed on request.

## Stale is not error, and neither empties the content

Five states. `stale` means the content is still correct as of its last refresh
and its inputs have since moved — perfectly displayable, with a marker. `error`
means the last attempt failed and what is shown is whatever survived from before.

**Neither clears `block`.** An output that emptied itself on a failed refresh
would turn a transient provider outage into a hole in somebody's report.

`stale` is computed on read rather than stored, because a stored one would need
every writer of every input to know which outputs to mark — a fan-out across
capabilities, over an index nothing else needs, which is the coupling a declared
input set exists to avoid.

## Where the shaping comes from

A prompt block holds its own editable copy of the text. When somebody edits it,
the edit is **theirs**: displayed immediately, stored on the block, and never
written back here. On the next [`refresh`](api/refresh/refresh.md) that edited
text goes to the generator as the shape to preserve, so a refresh updates the
facts without discarding the phrasing somebody chose.

**Two copies, deliberately.** This row keeps the canonical generated version and
the block keeps the presented one, because they answer different questions: what
the generator last produced, and what the reader is looking at.

The prompt is the other way round — it lives only here, and a copy on the block
would be a second prompt that can disagree about what produced the text.

## Past generations are not kept, and this is not an undo target

A refresh replaces the content wholesale and the generator emits a body rather
than ops, so keeping previous versions means storing the whole thing again every
time — and a generation whose inputs and prompt were not also captured cannot be
trusted to show what it was derived from. So the current generation carries full
provenance and prior ones are discarded.

**Nor is an output something to undo.** It is a function of its inputs at their
current revisions, so reverting the edit that changed it is what restores it: the
undo produces a new change set, the input moves back, this output goes stale, and
a refresh regenerates it. Undoing the output directly would be undoing an effect
rather than a cause.

## Capability Invariants

- **One block, and a list is refused.** The check is in the handler as well as at
  the door, because the block is parsed out of a model's answer.
- **`inputsAt` is read at completion, never reported by the generator**, and by
  the same function staleness compares against. Two readings of "what revision is
  this" that could disagree would make the comparison meaningless.
- **A row that cannot be read records nothing.** Another project's resource and a
  deleted one both drop out of `inputsAt` — and a recorded input that later drops
  out is what reads as movement.
- **Attribution is built from the scope**, never accepted as an argument.
- **A refusal is "not found", never "forbidden"** for an output in another
  project, because distinguishing them confirms somebody else's generated content
  exists.
- **Every refusal is a `DerivedOutputsError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` reaches a generator as a server fault it will retry forever.

## What staleness cannot see

A finding reached *through* a question is recorded as membership rather than by
revision, so revising that finding's writeup does not stale the output — a
finding declared directly does. The question input's own contribution is which
findings hang off it, and that is what moves.

## Deferred

| Today | When | Becomes |
| --- | --- | --- |
| `refresh` returns a request nothing runs | the intelligence capability | an action that generates and calls `completeGeneration` or `failGeneration` |
| `model` and `latticeVersion` are supplied by whoever completes a generation | same | filled from the binding and the lattice the retrieval actually queried |

## Related

[derived output](../../../../../docs/data-models/knowledge/derived-output.md) —
the model this implements ·
[content block](../content/overview.md) — the prompt block that presents one ·
[resource sets](../resource-sets/overview.md) — what `scope` is an expression of ·
[revisions](../revisions/overview.md) — where a resource's current revision comes from

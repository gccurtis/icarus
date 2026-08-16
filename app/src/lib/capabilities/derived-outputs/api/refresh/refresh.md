# API: `refresh`

Asks for a regeneration: marks the output `generating` and returns what a
generator needs.

Registered as `api.capabilities.derivedOutputs.refresh`, built from
`projectMutation`.

## Procedure Tree

```text
refresh(ctx, scope, id, shaping?)
├── requireOutput(ctx, scope, id)          ../shared/require-output.ts
├── ctx.db.patch(id, { state: "generating" })   refresh.ts
└── → GenerationRequest                    refresh.ts   prompt, scope, inputs, shaping
```

## Nothing is cleared while a generation runs

The content stands until a generation replaces it, so a reader keeps seeing the
last good version, marked as being worked on. The `error` goes, because it
described the attempt this one replaces — not because the content it left behind
is suspect.

## The shaping is passed through and stored nowhere

`shaping` is the prompt block's own copy: the text as somebody has edited it and
is reading it. It goes to the generator as the shape to preserve, so a refresh
updates the facts without discarding the phrasing they chose.

**Writing it onto the output would lose the canonical generated version**, which
is the other half of a deliberate pair. The output answers "what did the
generator last produce"; the block answers "what is the reader looking at". A
single copy cannot answer both, and the edit belongs to the person who made it.

The prompt is not an argument here for the opposite reason: it lives on the
output, and a caller supplying one would be generating from something other than
what the output says produced its text.

## What runs the generation is not here

A model call cannot run inside a mutation. This returns the request; whatever
executes it comes back through
[`completeGeneration` or `failGeneration`](../shared/shared.md).

A lattice-only output has no change signal to refresh it, so asking is the whole
mechanism it has — which is why this is a plain mutation anyone holding the
project can call rather than something only a staleness check triggers.

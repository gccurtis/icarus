# capabilities

The one crossing. A capability is what a view is allowed to ask, and the only
route from a surface to stored state.

**One directory per subject, and `index.ts` is the whole of what a panel
imports.** `$capabilities/resource` resolves to that file and to nothing deeper,
so which side of the boundary a capability answers from is its own business.

**None of them crosses anything yet.** Every one answers from the sample rows in
`cast.ts`, behind the `Read` handle in `read.svelte.ts` that a real read will
also return — so wiring one up is adding `api/` beneath it and changing the file
its `index.ts` asks, not editing the panels above it.

Two files at this root belong to no single capability:

| | |
| --- | --- |
| `read.svelte.ts` | the handle every capability answers with, and the call recording a review page reads |
| `cast.ts` | the sample rows they all draw from — one project, one set of people, so two panels never disagree about who someone is |

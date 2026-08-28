# representation

What the system knows, in one vocabulary, belonging to neither process.

| | |
| --- | --- |
| `data/` | every shape the system stores, and the pure functions over them |
| `store/` | what one of those shapes is when it is on disk |

**One vocabulary, declared once.** The last time it was declared twice — Convex
validators on one side, TypeScript on the other — the two disagreed about whether
a spreadsheet had a range target, and nothing caught it.

**Nothing here is a public surface and nothing here is constructed.** What a
browser may ask for is a capability; what holds a lifetime is built in
`runtime/`. The five remote functions that used to sit in `store/` were both of
those at once, which is why they are gone.

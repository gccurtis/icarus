# The Model

Objects with a lifetime. Definitional, like everything outside `runtime/`: this
tree says what an object *is* — its surface, its state, its methods — and never
builds one.

```text
model/
├── client/     one person's application state, for as long as their tab lives
└── server/     process resources: configuration, logging
```

A **capability** references stored data and is procedural, with nothing held
between calls. **Representation** declares what the system knows and touches no
process. A **model object** owns something that survives a call: a parsed
snapshot, an open log stream, what a person has open in front of them. That is
why `configuration` and `observability` are here rather than under
`capabilities/` — neither references stored data; each *is* a held resource.

**Nothing here is constructed here.** Each object's `constructor.ts` returns a
fresh one, and the only caller is `runtime/{client,server}/start*`, which composes
the graph and decides the order. An object never holds an instance of another; it
is handed what it depends on.

The written standard is
[`docs/model-directory/model-directory.md`](../../docs/model-directory/model-directory.md),
enforced by `scripts/lint/model/`. Both still describe the environment roots as
though they lived here; they moved to `runtime/`, and the rules about them are
unchecked until that standard is rewritten.

## The two halves are not symmetric

They look alike and are governed by one template, which makes the difference easy
to lose: **what varies is how many of each thing exists, and for how long.**

A client object belongs to one browser tab, and there is one per tab. A server
object belongs to the process, and there is exactly one. Nothing on the server
side is per-user — identity arrives per request as `Scope`, from
`runtime/server/scope.server.ts`, which is why that is a door of its own rather
than something reachable off an object.

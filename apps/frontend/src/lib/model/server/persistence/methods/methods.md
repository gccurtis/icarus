# Persistence Methods

`methods/` holds the execution behind the public surface. The definition is the
readable surface and delegates to these files, so reading `types.ts` tells you
what this object offers and reading a method tells you how it holds.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `forProject` | directory | [`for-project/`](for-project/for-project.md) | mutator | Answers with a project's database, opening it on first use |
| `close` | file | [`close.ts`](close.ts) | mutator | Closes every open database, settling rather than racing |

## Shape

`forProject` earned a directory: behind one call sit an id that has to be safe as
a directory name, a cache that stores promises rather than values, and the whole
acquisition of an embedded database. `close` is one file, because settling a list
of closes is one idea.

Opening and closing a single project live under `forProject` rather than beside
it. They exist because something asked for a project, and nothing else in the
object calls them — `close` reaches them through the `ProjectDatabase` that
`forProject` handed out, not by importing them.

## State Access

Methods receive `{ open, openProject, logger }` from the definition. `open` is
the map of in-flight and settled opens, and it is the one thing here that
carries the object's invariant: an entry is written before it is awaited, and
removed only by an eviction or by `close`.

`openProject` arrives as a dependency rather than being reached for, so caching,
eviction, and shutdown can be proven without an embedded PostgreSQL on disk.

## Shared Methods

Nothing has been promoted. The two public methods share the map itself, not any
step over it.

## Common Shape

```text
1. read or write the map under the project id
2. hand the caller a promise it can await, or a settled shutdown
3. report a failure in this object's own words, never the driver's
```

## Concurrency

`forProject` is synchronous up to the point it returns a promise, so the read of
the map and the write into it cannot interleave with another caller. Two callers
against an unopened project therefore share one open, and the second never sees
the map without an entry.

`close` clears the map before awaiting anything, so a `forProject` arriving
during shutdown opens a fresh database rather than receiving one that is already
closing. The composition root is what stops that from happening: shutdown is
one-way, and no request reaches the model after it begins.

# Observability Methods

`methods/` holds the execution behind the public surface. The definition is the
readable surface and delegates to these files, so reading `types.ts` tells you
what this object offers and reading a method tells you how it holds.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `close` | file | [`close.ts`](close.ts) | mutator | Flushes the root logger, then ends an owned stream |

Writing a record is not a method here. `logger` is a port the definition hands
out whole, and its four calls go straight to Pino — a file per level would
restate the library rather than explain anything.

## Shape

`close` is one file. Its two steps are a flush and an end, and their order is the
only thing worth knowing about them; a directory would spread three lines across
three files and hide that.

Reading configuration and opening a destination happen once, before an instance
exists, and belong to [`../constructor.ts`](../constructor.ts).

## State Access

The method receives `{ root, stream? }` from the definition. The absent stream is
the whole of the piped case, so a method cannot end a descriptor this process did
not open — there is nothing to reach for.

## Shared Methods

Nothing has been promoted. One public method cannot share anything with a second
one that does not exist.

## Concurrency

`close` is called once, by the composition root, after everything that writes has
already stopped.

**It is not written to be called twice, and nothing calls it twice.** Shutdown is
latched at the root, so a second `closeServerModel()` returns before reaching
this object. That is the guarantee this method rests on: a stream that has
already emitted `close` will not emit it again, so `endStream` awaiting a second
one would wait for an event that has already happened. If a second caller ever
becomes possible, this method needs a latch of its own before that caller ships.

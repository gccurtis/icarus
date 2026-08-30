# Commands Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. The definition is the
readable surface and delegates to these files, so reading `types.ts` tells you
what this object offers and reading a method tells you how it holds.

This is a list of **methods**, not a mirror of anything. Each entry is here
because `CommandsModel` means to offer it — with one exception, named below.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `enabled` | file | [`enabled.ts`](enabled.ts) | accessor | Whether a command applies right now |
| `run` | file | [`run.ts`](run.ts) | mutator | Runs a command, refusing an unknown or disabled one |
| `bindingsFor` | file | [`bindings-for.ts`](bindings-for.ts) | accessor | Every chord bound to one command |
| `chordOf` | file | [`chord-of.ts`](chord-of.ts) | accessor | Spells one gesture in the normal form |
| `hide` | file | [`hide.ts`](hide.ts) | mutator | Closes the bar |
| `toggle` | file | [`toggle.ts`](toggle.ts) | mutator | Shows the bar, or hides it |

`ids`, `bindings`, and `open` are exposed state rather than methods. The first
two are constants read straight off the instance; the third is the one reactive
field this object owns.

`chordOf` is the one method that takes no state. It is a pure spelling of its
argument, which is what lets the same function serve the dispatcher and — once
bindings are editable — the capture field that records a new one. A chord
captured one way and dispatched the other would otherwise be free to disagree.

## Not a method

[`registry.ts`](registry.ts) is the command table itself. No consumer calls it
by name; the constructor calls it once, and `enabled` and `run` reach what it
built through `shared/command.ts`.

It lives here rather than at the object root because the root holds what this
object **is** — its document, its index, its types, its state, and its
constructor — and everything it *does* lives below. A table of behaviour is
execution even when nothing calls it directly.

It is a file rather than a directory while one file tells the truth about it.
Restoring persisted bindings is the supporting flow that makes it a directory.

## Shape

A method is one file while one file tells the truth about it. It becomes a
directory when it owns supporting flow — then the directory and its entry file
share a name, and the entry's document carries the whole method tree.

Nothing here is a directory yet. Every method is a lookup, a predicate, or one
assignment.

## State Access

Methods receive `CommandsState` from the definition. They never import an
instance, because there is nothing at module scope to import.

`registry` and `bindings` are readonly on the state and no method assigns
either. `open` is the only mutable field, and only `hide` and `toggle` write it.

## Shared Methods

Two methods are promoted, and [`shared/shared.md`](shared/shared.md) states the
invariant each one holds. `command` resolves an id to its definition and refuses
an unknown one, for `enabled` and `run`. `setOpen` is the one writer for whether
the bar is showing, for `toggle`, `hide`, and the registry — which cannot import
either of the first two, because sibling methods do not reach each other.

A supporting method used by one public method stays under that method. It moves
to [`shared/`](shared/shared.md) when a second public method needs it **and** it
preserves an invariant spanning them. Two call sites wanting the same code is
duplication, not an invariant.

Sibling method directories never import one another. `shared/` is the only path
between them.

## Common Shape

Every method here is total and synchronous:

```text
1. Resolve what the id names, or refuse.
2. Read or assign one field.
3. Return.
```

There is no validation step, because the types do that work: `CommandId` is
derived from a frozen array and the registry is total over it, so the only way
to reach a refusal is to escape the type — a cast, or a chord restored from an
older build.

## Concurrency

Every method is synchronous and indivisible. Nothing awaits, so no method
re-reads state it started from, and no caller can observe this object
half-changed.

A command's `run` may reach into the workbench, which is synchronous for the
same reason. `run` therefore completes the whole effect before returning: the
tab list has already changed by the time the bar's next render reads it.

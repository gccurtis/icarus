# {{Object Name}} Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. The definition is the
readable surface and delegates to these files, so reading `types.ts` tells you
what this object offers and reading a method tells you how it holds.

This is a list of **methods**, not a mirror of anything. Each entry is here
because `{{ObjectType}}` means to offer it.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `{{simpleMethodName}}` | file | [`{{simple-method}}.ts`]({{simple-method}}.ts) | {{mutator / accessor}} | {{What it does}} |
| `{{complexMethodName}}` | directory | [`{{complex-method}}/`]({{complex-method}}/{{complex-method}}.md) | {{mutator / accessor}} | {{What it does}} |

## Shape

A method is one file while one file tells the truth about it. It becomes a
directory when it owns supporting flow — then the directory and its entry file
share a name, and the entry's document carries the whole method tree. Nesting
repeats: a supporting method with support of its own becomes a directory too.

The choice is made when a method is added and revisited when it grows. A
directory holding a single file claims a tree that is not there; a file holding
a tree hides it.

## State Access

Methods receive the instance state from the definition. They never import it,
because there is nothing at module scope to import — a method that reached for a
module-level value would be shared by every instance of this object.

{{Name the state or handle passed in, and anything a method is forbidden to
mutate directly.}}

## Shared Methods

{{Summarize what lives in shared/ and why, or state that nothing has been
promoted yet.}}

A supporting method used by one public method stays under that method. It moves
to [`shared/`](shared/shared.md) when a second public method needs it **and** it
preserves an invariant spanning them. Two call sites wanting the same code is
duplication, not an invariant, and promoting it early hides which method owns
the behavior.

Sibling method directories never import one another. `shared/` is the only path
between them.

## Common Shape

{{The pattern these methods follow — for example: validate the input, read
current state, compute the next value, assign it, return what the caller needs.
State it once here so each method document describes only what it does
differently.}}

```text
1. {{shared first step}}
2. {{shared second step}}
3. {{shared commit step}}
```

## Concurrency

{{What holds when two methods run against this instance at once: which are
synchronous and therefore indivisible, which await and can observe state a
caller changed mid-flight, and what a losing writer sees.}}

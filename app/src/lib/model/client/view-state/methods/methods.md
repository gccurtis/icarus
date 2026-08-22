# View State Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. Nine methods and four
shared modules, and every method is a free function taking `ViewStateData` first.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `open` | file | [`open.ts`](open.ts) | mutator | Open a target, or activate the tab already on it |
| `activate` | file | [`activate.ts`](activate.ts) | mutator | Move to a tab; an id naming none is ignored |
| `close` | file | [`close.ts`](close.ts) | mutator | Remove a tab, push the whole thing on the reopen queue, activate its left neighbour |
| `reopenClosed` | file | [`reopen-closed.ts`](reopen-closed.ts) | mutator | Put the most recently closed tab back, with the id and state it had |
| `showSubscreen` | file | [`show-subscreen.ts`](show-subscreen.ts) | mutator | Switch the centre; the rail follows and the inspection clears |
| `selectContext` | file | [`select-context.ts`](select-context.ts) | mutator | Move the rail to a view this subscreen offers |
| `inspect` | file | [`inspect.ts`](inspect.ts) | mutator | Open a lens, and record what it is about |
| `clear` | file | [`clear.ts`](clear.ts) | mutator | Nothing selected — the lens and the selection together |
| `resize` | file | [`resize.ts`](resize.ts) | mutator | Replace the active tab's frame with a patched copy |

`showing` is the tenth method on `ViewStateModel` and has no file here. It
compares two fields on the active tab and calls nothing, so it is answered in
[`definition.svelte.ts`](../definition.svelte.ts).

## Shape

Every one is a file. None owns supporting flow: the four things more than one of
them needs are in [`shared/`](shared/shared.md), and nothing else in the object is
long enough to split.

## State Access

`ViewStateData` as the first argument, imported as a **type** from
[`definition.svelte.ts`](../definition.svelte.ts), which is what keeps the
definition's import of these files from being a runtime cycle. Nothing here reads
module scope, so two instances cannot interfere.

Four methods write the strip — `tabs`, `activeId`, `closed`. The other five write
one tab, always `state.active`, and never reach for a tab by id. `nextId()` is
the definition's and is called only through `open`.

## Shared Methods

Four, and two of them are data rather than methods — see
[`shared/shared.md`](shared/shared.md).

| File | Callers | Invariant |
| --- | --- | --- |
| `keys.ts` | `inspect`, `show-subscreen`, `mint-tab`, `rails`, the types and the door | Every key names a file in the panel trees |
| `rails.ts` | `select-context`, `show-subscreen`, `mint-tab`, the definition's `context` getter | The rail position is one this subscreen offers |
| `mint-tab.ts` | the constructor, `open` | Every tab starts the same way |
| `target-key.ts` | `open` | One definition of "already open" |

## Two asymmetries that are deliberate

**`selectContext` throws; the `context` getter falls back silently.** The two
cases are different. A remembered context can *drift* out of range when a
subscreen changes — a templates tab switching mode swaps to a disjoint rail — and
a reset rail is harmless where a crash is not. A caller naming a view no screen
offers has made a mistake, and swallowing it would leave the panel blank with
nothing to explain why.

**`resize` takes `Partial<Frame>` and cannot reach `contextId`.** That is the
point of it being its own method over its own type: a drag can never move the
rail and a rail click can never resize a panel, structurally rather than by
convention.

## What refuses, and what does not

Four methods throw, and each rejects something a caller could not have meant:

| Method | Refuses |
| --- | --- |
| `close` | A singleton — not being on one *is* closing it |
| `showSubscreen` | A subscreen this screen does not have |
| `selectContext` | A view this subscreen's rail does not offer |
| `inspect` | A key that is neither `"empty"` nor a lens |

`activate` is the one that does not. The only caller that can produce an unknown
id is a click on a tab being closed in the same frame — a race, not a defect — so
it is ignored, and `activeId` never becomes something no tab answers to.

## Common Shape

```text
1. Find the tab this is about — the active one, or the one the caller named
2. Refuse what the vocabulary or the strip does not admit
3. Assign; a whole value where the field is a record, so no reader sees half of one
```

Step three is why `resize` replaces the frame rather than mutating it, and why
`close` reassigns `closed` rather than splicing it: a reader holding the old value
sees a consistent set rather than a half-applied change.

Two methods do more than assign, and both do it for the same reason — state that
belonged to what is no longer showing has to go. `showSubscreen` resets the rail
when the new subscreen does not offer the remembered view, and clears the
inspection and the selection outright. `clear` clears the selection with the lens,
because a lens showing nothing beside a selection that still names something is
two answers to what the person is looking at.

## Concurrency

Nothing here is asynchronous and nothing awaits, so no two methods can interleave
and each is indivisible. **The model never calls a capability**, which keeps it
testable without a network and puts an error where it can be seen.

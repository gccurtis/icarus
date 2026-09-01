# Workspace State Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. Twelve methods and nine
shared modules, and every method is a free function taking `WorkspaceStateData` first.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `open` | file | [`open.ts`](open.ts) | mutator | Open a target, or move the tab already on it to what the target asked for |
| `activate` | file | [`activate.ts`](activate.ts) | mutator | Move to a tab; an id naming none is ignored |
| `close` | file | [`close.ts`](close.ts) | mutator | Move to the left neighbour, then remove the tab and its view |
| `reopenClosed` | file | [`reopen-closed.ts`](reopen-closed.ts) | mutator | Invert the most recent `close` that has not come back, and move to it |
| `showSubscreen` | file | [`show-subscreen.ts`](show-subscreen.ts) | mutator | Switch the centre and say what it is about; the rail follows and the inspection clears |
| `selectContext` | file | [`select-context.ts`](select-context.ts) | mutator | Move the rail to a view this subscreen offers |
| `inspect` | file | [`inspect.ts`](inspect.ts) | mutator | Open a lens, and record what it is about |
| `clear` | file | [`clear.ts`](clear.ts) | mutator | Nothing selected — the lens and the selection together |
| `resize` | file | [`resize.ts`](resize.ts) | mutator | Replace the active tab's frame with a patched copy |
| `showing` | file | [`showing.ts`](showing.ts) | accessor | Whether the active tab is on a given centre right now |
| `undo` | file | [`undo.ts`](undo.ts) | mutator | Apply the inverse of the last op, and remember it for `redo` |
| `redo` | file | [`redo.ts`](redo.ts) | mutator | Apply the last undone op again |

`showing` is the only accessor in the set — it compares two fields and writes
nothing. It has a file anyway, because the definition being one call per method
is what makes that class readable: a body that did its own work there would be
the one place a reader has to stop and check.

## Two ways in to a centre, and one rule behind them

The shell has no subscreen switcher: a centre is changed by choosing something in
it. Two methods therefore land a tab on a centre, and both go through
[`landOn`](shared/land-on.ts) rather than assigning.

`showSubscreen` is a person moving inside a category they are already on — the
double click that chooses a persona is the same call that switches to the persona
centre, and passing no subject is how a library is returned to.

`open` sits above it and takes a whole `Target`. A target that names a centre
gets it whether or not the tab is already open, so a tab reached from another
category ends up in exactly the state it would have reached on its own: same rail
reset, same cleared inspection. **The shared module is the point**, not a
convenience — the alternative is two paths to one state, and two paths to one
state drift.

A target that names a subject and no centre is the narrower move, and it stays
narrow: `open` assigns `focus` and touches nothing else, because arriving at a
question inside a thread invalidates neither the rail position nor the
inspection. Routing it through `landOn` would throw away a position nothing had
made wrong.

## Three fields name a subject, and no method blurs them

`resourceId` is what a tab is *for*. Nothing writes it: `tab-list.mint` sets it
and it is `readonly` after, which is what makes two documents two tabs and one document
reached three ways one tab. Research is keyed the same way, so a thread is a tab.

`focus` is what the centre is currently *about*, and `landOn` and `open` are the
only writers. A permanent tab moves between personas all day without minting
anything.

`selection` is what is picked out *inside* the centre, and `inspect` and `clear`
are its writers. A persona is in focus while a tool in its list is selected.

## Shape

Every one is a file. None owns supporting flow: the things more than one of them
needs are in [`shared/`](shared/shared.md), and nothing else in the object is
long enough to split.

## State Access

`WorkspaceStateData` as the first argument, imported as a **type** from
[`definition.svelte.ts`](../definition.svelte.ts), which is what keeps the
definition's import of these files from being a runtime cycle. Nothing here reads
module scope, so two instances cannot interfere.

**No method here writes state directly.** Each one computes a `WorkspaceOp` and hands
it to [`perform`](shared/perform.ts), which applies it and appends it to the log.
That is what makes the log complete: a method that wrote through to `tab-list` or
`tab-views` would be a gesture with no record, and undo would step over it.

`undo` and `redo` are the two exceptions, and deliberately so — they call
[`apply`](shared/apply.ts) rather than `perform`, because replaying history is
not making history.

Six methods write one tab and reach for it as `state.tabs.activeId`, never by an
id they were given, which is what makes "no method edits a tab the person is not
looking at" a property of the directory rather than a convention.

## Shared Methods

Nine, and two of them are data rather than methods — see
[`shared/shared.md`](shared/shared.md).

| File | Callers | Invariant |
| --- | --- | --- |
| `defaults.ts` | `close`, `target-key`, the constructor, `mint-view`, the index | A category is permanent or it is not, and every tab starts the same width |
| `apply.ts` | `perform`, `undo`, `redo` | One op, one effect — the only place an op becomes a change |
| `perform.ts` | every mutator, `land-on` | Nothing changes without leaving a record |
| `landing.ts` | `land-on`, `open` | The `was` half of a landing is read once, the same way every time |
| `rails.ts` | `select-context`, `land-on`, `mint-view`, the definition's `context` getter | The rail position is one this subscreen offers |
| `compose.ts` | `open`, `reopen-closed`, the definition's read getters | A record and a view are read as one tab, in one place |
| `land-on.ts` | `show-subscreen`, `open` | A centre change takes its rail and its inspection with it |
| `mint-view.ts` | the constructor, `open` | Every tab starts the same way |
| `target-key.ts` | `open` | One definition of "already open" |

## Two asymmetries that are deliberate

**`selectContext` throws; the `context` getter falls back silently.** The two
cases are different. A remembered context can *drift* out of range when a
subscreen changes — a templates tab switching mode swaps to a disjoint rail — and
a reset rail is harmless where a crash is not. A caller naming a view no category
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
| `close` | A permanent category — not being on one *is* closing it |
| `showSubscreen` | A subscreen this category does not have |
| `selectContext` | A view this subscreen's rail does not offer |
| `inspect` | A key that is neither `"empty"` nor a lens |

`showSubscreen` refuses inside `landOn` rather than in its own body, so `open`
refuses the same thing for a target that names a centre on a tab that is already
open. One rule, both ways in — which is the reason the module exists at all.
`mintView` is the gap in that: it is the branch of `open` that does not go
through `landOn`, and [`shared/shared.md`](shared/shared.md) says so where the
check belongs.

Two do not refuse, and for one reason between them: the argument is a tab id
rather than a member of a vocabulary this object owns, so an unrecognised one is
a stale reference and not a mistake. `activate` is handed a tab that was closed
in the same frame — a race. `close` takes the same view of an id it cannot find.

`open` refuses nothing about identity, because there is nothing to refuse: a
`resourceId` this object has never seen is a tab it has not opened yet, which is
the ordinary case.

## Common Shape

```text
1. Find the tab this is about — the active one, or the one the caller named
2. Refuse what the vocabulary does not admit
3. Read the `was` half off the tab, and hand `perform` a whole op
```

Step three is why `resize` carries a whole frame on both sides rather than the
one edge that moved, and why `land` carries all five fields it writes: an op that
recorded only the difference could not be inverted without reading the state it
was inverting.

Two paths do more than assign, and both for the same reason — state belonging to
what the tab is leaving has to go with it. `landOn` resets the rail when the new
subscreen does not offer the remembered view, and clears the inspection and the
selection outright, because a lens about something off the screen is a panel that
cannot explain itself. `clear` clears the selection with the lens,
because a lens showing nothing beside a selection that still names something is
two answers to what the person is looking at.

## Concurrency

Nothing here is asynchronous and nothing awaits, so no two methods can interleave
and each is indivisible. **The model never calls a capability**, which keeps it
testable without a network and puts an error where it can be seen.

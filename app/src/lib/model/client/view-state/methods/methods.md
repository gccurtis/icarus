# View State Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. Ten methods and five
shared modules, and every method is a free function taking `ViewStateData` first.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `open` | file | [`open.ts`](open.ts) | mutator | Open a target, or move the tab already on it to what the target asked for |
| `activate` | file | [`activate.ts`](activate.ts) | mutator | Move to a tab; an id naming none is ignored |
| `close` | file | [`close.ts`](close.ts) | mutator | Remove a tab, push the whole thing on the reopen queue, activate its left neighbour |
| `reopenClosed` | file | [`reopen-closed.ts`](reopen-closed.ts) | mutator | Put the most recently closed tab back, with the id and state it had |
| `showSubscreen` | file | [`show-subscreen.ts`](show-subscreen.ts) | mutator | Switch the centre and say what it is about; the rail follows and the inspection clears |
| `selectContext` | file | [`select-context.ts`](select-context.ts) | mutator | Move the rail to a view this subscreen offers |
| `inspect` | file | [`inspect.ts`](inspect.ts) | mutator | Open a lens, and record what it is about |
| `clear` | file | [`clear.ts`](clear.ts) | mutator | Nothing selected — the lens and the selection together |
| `resize` | file | [`resize.ts`](resize.ts) | mutator | Replace the active tab's frame with a patched copy |
| `showing` | file | [`showing.ts`](showing.ts) | accessor | Whether the active tab is on a given centre right now |

`showing` is the only accessor in the set — it compares two fields and writes
nothing. It has a file anyway, because the definition being one call per method
is what makes that class readable: a body that did its own work there would be
the one place a reader has to stop and check.

## Two doors onto a centre, and one rule behind them

The shell has no subscreen switcher: a centre is changed by choosing something in
it. Two methods therefore land a tab on a centre, and both go through
[`landOn`](shared/land-on.ts) rather than assigning.

`showSubscreen` is a person moving inside a screen they are already on — the
double click that chooses a persona is the same call that switches to the persona
centre, and passing no subject is how a library is returned to.

`open` sits above it and takes a whole `Target`. A target that names a centre
gets it whether or not the tab is already open, so a tab reached from another
screen ends up in exactly the state it would have reached on its own: same rail
reset, same cleared inspection. **The shared module is the point**, not a
convenience — the alternative is two paths to one state, and two paths to one
state drift.

A target that names a subject and no centre is the narrower move, and it stays
narrow: `open` assigns `focus` and touches nothing else, because arriving at a
question inside a thread invalidates neither the rail position nor the
inspection. Routing it through `landOn` would throw away a position nothing had
made wrong.

## Three fields name a subject, and no method blurs them

`resourceId` is what a tab is *for*. Nothing writes it: `mintTab` sets it and it
is `readonly` after, which is what makes two documents two tabs and one document
reached three ways one tab. Research is keyed the same way, so a thread is a tab.

`focus` is what the centre is currently *about*, and `landOn` and `open` are the
only writers. A permanent tab moves between personas all day without minting
anything.

`selection` is what is picked out *inside* the centre, and `inspect` and `clear`
are its writers. A persona is in focus while a tool in its list is selected.

## Shape

Every one is a file. None owns supporting flow: the five things more than one of
them needs are in [`shared/`](shared/shared.md), and nothing else in the object is
long enough to split.

## State Access

`ViewStateData` as the first argument, imported as a **type** from
[`definition.svelte.ts`](../definition.svelte.ts), which is what keeps the
definition's import of these files from being a runtime cycle. Nothing here reads
module scope, so two instances cannot interfere.

Four methods write the instance's own fields — `tabs`, `activeId`, `closed` — and
they are the four that change which tabs exist or which one is in front:
`open`, `activate`, `close`, `reopenClosed`. Five write one tab, always
`state.active`, and never reach for a tab by id. `showing` writes nothing at all.
`nextId()` is the definition's and is called only through `open`.

That split is what makes "no method edits a tab the person is not looking at" a
property of the directory rather than a convention: the second group has no way
to name a tab that is not in front of them.

## Shared Methods

Five, and two of them are data rather than methods — see
[`shared/shared.md`](shared/shared.md).

| File | Callers | Invariant |
| --- | --- | --- |
| `keys.ts` | `inspect`, `select-context`, `show-subscreen`, `showing`, `land-on`, `rails`, the types and the door | Every key names a file in the panel trees |
| `rails.ts` | `select-context`, `land-on`, `mint-tab`, the definition's `context` getter | The rail position is one this subscreen offers |
| `land-on.ts` | `show-subscreen`, `open` | A centre change takes its rail and its inspection with it |
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
| `close` | A permanent screen — not being on one *is* closing it |
| `showSubscreen` | A subscreen this screen does not have |
| `selectContext` | A view this subscreen's rail does not offer |
| `inspect` | A key that is neither `"empty"` nor a lens |

`showSubscreen` refuses inside `landOn` rather than in its own body, so `open`
refuses the same thing for a target that names a centre on a tab that is already
open. One rule, both doors — which is the reason the module exists at all.
`mintTab` is the gap in that: it is the branch of `open` that does not go through
`landOn`, and [`shared/shared.md`](shared/shared.md) says so where the check
belongs.

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
3. Assign; a whole value where the field is a record, so no reader sees half of one
```

Step three is why `resize` replaces the frame rather than mutating it, and why
`close` reassigns `closed` rather than splicing it: a reader holding the old value
sees a consistent set rather than a half-applied change.

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

# Commands

## Description

Commands holds every action this application can perform without an argument,
the chords bound to them, and whether the command bar is showing — so that a
keystroke, a menu, and a list of actions all reach the same table instead of
each surface wiring its own.

Two shapes of consumer read it. The dispatcher looks one chord up and runs what
it finds; the command bar enumerates everything and renders each row with its
own enabled state.

## What a command is

**The zero-argument subset of things the application can do.**

That is the whole boundary, and it is what stops this becoming an RPC layer. A
keystroke cannot supply an argument, so anything needing one is a model method —
a command may wrap a method with a fixed argument, and two commands may wrap the
same method with different ones.

## Ownership Boundary

Commands owns:

- which commands exist, and what each one does;
- whether each applies right now;
- what is bound to what;
- whether the command bar is showing.

Consumers own:

- what a command is **called**. This object exposes stable ids, and the bar
  resolves each to a label and a description — the same split the rail and the
  workspace already make, and for the same reason: rewording or translating
  display copy must not change what a chord points at.
- what a chord **renders as**. `$mod` is stored once and shown as `⌘` or `Ctrl`
  by the surface that knows which machine it is on.
- reading the keyboard. This object never sees a `KeyboardEvent`; it is handed
  `ChordParts` and spells them.

## Lifetime

- **Instance:** one per client instance, which is one browser tab on one project
- **Constructed by:** `buildClientModel`, after the workbench, which it acts on
- **Released by:** nothing — this object holds nothing releasable

## Public Methods

| Method | Shape | Effect | Description | Document |
| ------ | ----- | ------ | ----------- | -------- |
| `enabled` | file | accessor | Whether a command applies right now | — |
| `run` | file | mutator | Runs a command, refusing an unknown or disabled one | — |
| `bindingsFor` | file | accessor | Every chord bound to one command | — |
| `chordOf` | file | accessor | Spells one gesture in the normal form | — |
| `hide` | file | mutator | Closes the bar | — |
| `toggle` | file | mutator | Shows the bar, or hides it | — |

A simple method has no document of its own.
[`methods/methods.md`](methods/methods.md) lists it, along with `registry.ts`,
which is not a method at all.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `ids` | `readonly CommandId[]` | Every command, in declaration order. What the bar lists |
| `bindings` | `readonly Record<Chord, CommandId>` | Chord to command — the direction dispatch reads |
| `open` | `readonly boolean` | Whether the command bar is showing |

Every field is readonly. Consumers read state and call methods; a writable field
hands this object's invariants to whoever holds a reference.

No field is a Svelte `Component` or a registry of them. This object exposes
stable keys and the view layer resolves them, so the model stays testable
without a DOM.

## Why `enabled` is separate from `run`

The tempting shape is one function that checks internally whether it should do
anything. It fails on the surface this object exists for: **a bar cannot grey
out what it cannot ask about.**

Disabled commands are shown greyed rather than hidden, so the bar teaches what
the application can do. With the check inside `run`, the only way to learn
whether a command applies would be to run it, and the list would become a menu
of items that silently do nothing.

`run` still refuses a disabled command, by throwing — the same way
`workbench.close` throws for a permanent tab. Every surface checks first, so
reaching that branch means a caller skipped the question.

## Neither half takes arguments

Both close over the state at construction:

```ts
"tab.close": {
  enabled: () => !state.workbench.active.permanent,
  run: () => state.workbench.close(state.workbench.activeId)
}
```

This is why enablement needs no context parameter. `enabled` reads
`workbench.active`, which is `$state`, so a `$derived` in the bar that maps
every id through it re-runs when the active tab changes. Live greying falls out
of runes rather than being wired.

The cost is that no predicate can be tested without a real workbench. The tests
build one rather than stubbing it, which is the honest version of that trade.

## Construction

```ts
export const createCommands = (workbench: WorkbenchModel): CommandsModel => ...;
```

Every call returns a fresh object.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `workbench` | BORROWED | Every command but one reads it, and three act on it |

**BORROWED** means the environment root constructed it and the root releases it;
this object must never close it.

**The registry is built after the state exists**, because `command-bar.open`
closes over the field it toggles. Every command body is a closure, so nothing is
actually read during construction — the order is written explicitly anyway, so
that a future command reading something eagerly fails in the file that caused it.

## Bindings

Defaults only. `bind`, `unbind`, persistence, and the editor that drives them
are designed and not built.

Three chords ship bound. `tab.close` deliberately ships unbound: `$mod+w` is its
obvious chord and browsers refuse to release that keystroke, so binding it by
default would ship a shortcut that does nothing on most machines. It stays
reachable from the bar, and `bindingsFor` returning nothing for it is a case the
bar has to render anyway.

**No chord is reserved.** The dispatcher calls `preventDefault` on everything it
matched. What a host reserves is a property of the environment — a browser tab
and a desktop shell holding one reserve different things — and this object has
no way to ask. When there is something to ask, the editor gains a warning rather
than a refusal.

## Terminal Behaviour

None. This object owns nothing releasable, holds no handle, and writes nothing
outside itself.

## Concurrency and SSR

- Every method is synchronous and indivisible. Nothing awaits.
- A command's `run` reaches the workbench, which is synchronous for the same
  reason, so the whole effect completes before `run` returns.
- This object touches no browser API at all — not even storage, until bindings
  persist. It is browser-only because the graph holding it is.
- Reads track correctly: `open` is `$state` behind a getter, so a component
  reading `commands.open` re-renders when it changes, and one reading
  `enabled(id)` re-renders when the workbench state that predicate touched
  changes.

## Invariants

- **Every id names a definition.** The registry is `Record<CommandId, Command>`
  and `CommandId` is derived from `COMMAND_IDS`, so a new command fails to
  compile until it does something.
- **An unknown id is refused.** `enabled` and `run` both throw rather than
  returning `false` or no-opping, because a caller holding an id for a command
  that does not exist has a defect that gets harder to find the further it
  travels.
- **A disabled command does not run.** The throw is a tripwire for a caller that
  skipped `enabled`, not a control path.
- **One gesture has one spelling.** `chordOf` fixes the modifier order and the
  key's case, so the binding map cannot hold two keys meaning the same chord
  with only one of them reachable.
- **Nothing here reads the keyboard.** `ChordParts` crosses the boundary, never
  an event.

## File Tree

```text
commands/
├── commands.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   ├── bindings-for.ts
│   ├── chord-of.ts
│   ├── enabled.ts
│   ├── hide.ts
│   ├── registry.ts
│   ├── run.ts
│   ├── toggle.ts
│   └── shared/
│       ├── shared.md
│       ├── command.ts
│       └── set-open.ts
└── test/
    └── unit/
```

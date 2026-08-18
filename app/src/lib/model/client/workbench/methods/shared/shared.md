# Shared Workbench Methods

Lives at `methods/shared/shared.md`.

Four steps, each preserving an invariant that spans the methods using it.

| File | Callers | Invariant it preserves |
| --- | --- | --- |
| [`target-key.ts`](target-key.ts) | `open`, `resolve-launcher` | One target, one key |
| [`adopt-target.ts`](adopt-target.ts) | `open`, `resolve-launcher` | One mint point |
| [`active-tab.ts`](active-tab.ts) | `frame`, `inspect`, `inspected-node`, `resize`, `select-context` | `active` is never undefined |
| [`assign-state.ts`](assign-state.ts) | `resize`, `select-context`, `update` | One write path into view state |

## `target-key`

**The whole definition of "already open."** A singleton keys on its screen, a
resource on its type and id, and a launcher on nothing — `undefined`, which is
why opening five launchers gives five tabs.

Two spellings of one target would be two tabs on one document, and it would fail
quietly: both tabs would attach the same runtime and neither would look wrong.

## `adopt-target`

**The only place a tab is minted**, which is what makes every invariant about a
tab hold by construction rather than by everyone remembering: `viewState.kind`
always matches the target, `frame` is always fully populated, and no tab ever
exists half-built for a reader to defend against.

Its `initialViewState` is a total switch rather than a `Record`, so a new screen
kind fails to compile here until it has a starting state.

## `active-tab`

The final `?? tabs[0]` is not a defence against `activeId` going stale — the
singletons make that impossible. It is what makes the return type non-optional,
so five callers do not each write a guard for a case the object rules out.

## `assign-state`

**The one write path into a tab's view state.** Three public methods route
through it, which is what makes "view state changes in exactly one place" a fact
about the code rather than a convention three methods happen to follow.

It is a procedure rather than three inline mutations because when persistence
returns, this is the single point that decides whether a change is worth a write.

`inspect()` is the documented exception: an inspection is not per-screen typed
and is never persisted, so routing it through here would mean widening this to
carry something it has no business knowing about.

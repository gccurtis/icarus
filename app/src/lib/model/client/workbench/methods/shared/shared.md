# Workbench Shared Methods

Lives at `methods/shared/shared.md`.

A method belongs here once a second public method needs it **and** it preserves
an invariant that spans them. It sits inside `methods/` rather than an
object-wide directory because it exists to serve those methods, and both call
trees stay visible through their imports.

Two methods wanting the same code is duplication. Promotion is a claim about an
invariant: something that must hold the same way wherever it is enforced, or the
object's state stops meaning one thing. Without that claim the method belongs in
the directory of the method that owns the behavior.

Sibling method directories never import one another, so this directory is the
only path between them.

## Methods

| Method | Invariant it preserves | Used by | File |
| ------ | ---------------------- | ------- | ---- |
| `activeTab` | `activeId` always names a tab in the list | `availableContexts`, `activeContext`, `selectContext`, `currentInspection`, `inspect`, `panels`, `resize` | [active-tab.ts](active-tab.ts) |
| `assignOptions` | Options are replaced, not mutated, and only what outlives the session persists | `update`, `selectContext`, `inspect`, `resize`, `open` | [assign-options.ts](assign-options.ts) |
| `persist` | The store is a whole current document or nothing | `open`, `close`, `activate`, `reorder`, `assignOptions` | [persist.ts](persist.ts) |

## Method: `activeTab`

Resolves the tab `activeId` names, and refuses when there is none.

```ts
export const activeTab = (state: WorkbenchState): Tab => ...;
```

**Preserves:** something is always open. A permanent tab cannot be closed, so an
`activeId` naming nothing means the tab list lost a tab it was promised.

**Fails when:** no tab carries `activeId`. The caller sees a thrown error naming
the id, which is the breach itself rather than a symptom of it. Returning
`undefined` would push the failure into whichever surface read it next, and by
then the cause is gone.

**Touches state:** reads `tabs` and `activeId`; assigns nothing.

## Method: `assignOptions`

Replaces a tab's options with the patch merged over them, and persists when the
patch touched something that outlives the tab's session.

```ts
export const assignOptions = (
  state: WorkbenchState,
  tab: Tab,
  patch: Partial<TabOptions>
): void => ...;
```

**Preserves:** two things at once. Options are replaced rather than mutated, so a
consumer holding an old options object cannot observe a later write through it.
And the line between persisted and session-only state is drawn in one place:
`inspection` names block ids and character offsets in a document that may have
changed since, `scrollTop` is the same case, and persisting either would mean a
write per keystroke-adjacent action.

A patch persists when it *names* `contextId` or `panels`, including when it
names one to clear it. Absence has to survive a reload too.

**Fails when:** never. The tab was resolved by its caller.

**Touches state:** assigns `tab.options`, and calls `persist`.

## Method: `persist`

Writes the whole workbench to storage.

```ts
export const persist = (state: WorkbenchState): void => ...;
```

**Preserves:** the store is always a complete current document. Whole rather than
incremental, so a store damaged by hand or written by an older build is repaired
by the next mutation rather than merged into.

Every tab goes out, including the permanent one. That tab is reconstructed rather
than restored, but the geometry a user dragged on it would otherwise be the one
panel size in the application that a reload forgot; replaying its ref costs
nothing because `open()` dedupes on kind and id.

**Fails when:** never — storage does not throw, by design. A blocked or full
store loses the next reload's tab list, which is not worth an exception in the
middle of a drag.

**Touches state:** reads `tabs` and `activeId` through `activeTab`; assigns
nothing on the instance. It writes to borrowed storage, which is the only effect
in this object that outlives the call.

## Demotion

A shared method that loses its second caller has lost the reason it is here. Move
it back into the directory of the method that still uses it. Leaving it means a
later reader takes it for a rule when it is only history.

# App Effects

Lives at `src/lib/views/app/effects/effects.md`. This is the one
document for the complete effect tree. Nested effect directories do not carry
their own Markdown files.

Every entry here is `.svelte.ts`.

## Effect Tree

```text
a keydown anywhere in the document        dispatch-commands.svelte.ts
├── read the event into ChordParts
├── spell it                              $model/client → chordOf
├── look the chord up in the bindings
└── check enabled, then run
```

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every effect appears here and is described under Lifecycles below.

<!-- generated:inventory:start -->
- [`dispatch-commands.svelte.ts`](dispatch-commands.svelte.ts)
<!-- generated:inventory:end -->

## Lifecycles

### `dispatchCommands`

- **Trigger:** a `keydown` on `window`, for as long as the frame is mounted.
- **Observed values:** `commands.bindings`, read per event rather than captured.
- **Writes:** nothing of its own. It calls `run`, and the command writes.
- **External resource:** one `window` listener. It is held, and released below.
- **General procedures:** `None`. `chordOf` is the model's, reached through
  `$model/client`.

#### Setup

```text
1. Add a keydown listener to window.
2. Ignore a repeat — a held key is one intent, not many.
3. Read ctrl-or-meta, alt, shift, and the key into ChordParts.
4. Spell the chord, and look it up in the bindings.
5. Return if nothing is bound: the gesture belongs to the page.
6. preventDefault, because a binding matched.
7. Return if the command is disabled; otherwise run it.
```

#### Cleanup

```text
1. Remove the keydown listener.
```

- **Rerun behavior:** the effect body does not depend on reactive state, so it
  sets up once. A binding change is seen because `bindings` is read inside the
  handler rather than closed over at setup.
- **Unmount behavior:** the listener is removed. Nothing else survives.
- **Remount safety:** safe. Each mount adds one listener and removes its own.

## Effect Invariants

- **The listener is on `window`, not on the frame.** A shortcut has to work
  wherever focus is, including in a panel that does not exist yet, and a
  keydown that never reaches the frame's subtree would be lost.
- **`preventDefault` fires only after a binding matched.** Calling it before the
  lookup would swallow ordinary typing.
- **A bound chord always takes the keystroke**, including one the browser wanted.
  What a host reserves is a property of the environment, and nothing here can
  ask it.
- **No `KeyboardEvent` crosses into the model.** This effect reads the event into
  `ChordParts`; the model spells and dispatches. That boundary is what keeps the
  command registry testable without a browser.

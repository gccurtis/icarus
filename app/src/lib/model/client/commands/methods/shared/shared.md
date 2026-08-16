# Commands Shared Methods

Lives at `methods/shared/shared.md`.

A method belongs here once a second public method needs it **and** it preserves
an invariant that spans them. It sits inside `methods/` rather than an
object-wide directory because it exists to serve those methods, and both call
trees stay visible through their imports.

Two methods wanting the same code is duplication. Promotion is a claim about an
invariant: something that must hold the same way wherever it is enforced, or the
object's state stops meaning one thing.

Sibling method directories never import one another, so this directory is the
only path between them.

## Methods

| Method | Invariant it preserves | Used by | File |
| ------ | ---------------------- | ------- | ---- |
| `command` | An id always names a definition, or the caller is told | `enabled`, `run` | [command.ts](command.ts) |
| `setOpen` | The bar's visibility has one writer | `toggle`, `hide`, `registry` | [set-open.ts](set-open.ts) |

## Method: `command`

Resolves the definition an id names, and refuses when there is none.

```ts
export const command = (state: CommandsState, id: CommandId): Command => ...;
```

**Preserves:** every id names something runnable. The registry is
`Record<CommandId, Command>` and `CommandId` is derived from `COMMAND_IDS`, so
this holds by construction for any caller inside the type. The refusal exists
for the callers outside it — a chord restored from an older build, or a cast.

Both callers need it for the same reason, which is what makes this an invariant
rather than a shared helper. `enabled` returning `false` for an id that does not
exist would report "this command does not apply here" about a command that does
not exist anywhere, and the bar would render a greyed row for nothing.

**Fails when:** the registry has no entry. The caller sees a thrown error naming
the id, which is the breach itself rather than a symptom of it.

**Touches state:** reads `registry`; assigns nothing.

## Method: `setOpen`

Assigns whether the bar is showing.

```ts
export const setOpen = (state: CommandsState, value: boolean): void => ...;
```

**Preserves:** the bar's visibility has one writer. Three callers reach it —
`toggle`, `hide`, and two commands in the registry — and the invariant is that
whatever closing the bar comes to mean, it means the same on every path.

Today that is one assignment, which makes this look like duplication avoidance
rather than an invariant. It is not: the bar will acquire state it has to forget
on close — a typed query, a highlighted row — and a second assignment site is
exactly how that ends up applied on one path and not the other. The registry
cannot import `hide` regardless, because sibling methods do not reach each
other, so the choice was between this and three bare assignments.

**Fails when:** never. It assigns a boolean.

**Touches state:** assigns `open`.

## Demotion

A shared method that loses its second caller has lost the reason it is here.
Move it back into the directory of the method that still uses it. Leaving it
means a later reader takes it for a rule when it is only history.

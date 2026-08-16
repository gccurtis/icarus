# Revisions Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`change.ts`](change.ts) | `opValidator` and the `Op` type, `opTargetValidator`, `resourceTypeValidator`, `ResourceKey` |
| [`body.ts`](body.ts) | `resourceBodyValidator` — the three resources' bodies, imported rather than declared |

The validators are the model and [`schema.ts`](../schema.ts) composes them, the
same way [activity](../../activity/types/types.md) does: the storage part is
`projectId`, the tiering, and the indexes, and none of that belongs to what an op
*is*.

## Only one legal pairing is in the validator

`target` says what kind of thing an op addresses, and not every kind takes every
op:

| Target | `set` | `insert` | `remove` | `move` | `text` |
| --- | :-: | :-: | :-: | :-: | :-: |
| `row`, `block`, `slide`, `element`, `section`, `sheet` | ● | ● | ● | ● | |
| `atom` | ● | ● | ● | | ● |
| `mark`, `chart` | ● | ● | ● | | |
| `cell` | ● | ● | ● | | |
| `merge` | | ● | ● | | |
| `field` | ● | | | | |

`field` is replaced, never reordered.

**The model's table gives `cell` no `insert`, and building spreadsheets showed
that cannot hold.** A cell that did not exist comes into being, and the op that
creates it has to invert to one that removes it — `set`'s inverse is a `set`, and
setting a key to nothing is not a value a keyed map can hold. So a cell follows
the same discipline as an ordered list's entry: `insert` creates, `remove`
destroys, `set` replaces. What stays true is the reason the table said otherwise
— a cell is never *moved*, because its address is its identity.

**`text` is the one the validator states**, as `v.literal("atom")`, because it is
the one that changes what the rest of the system may assume: an in-place string
edit on anything but a literal atom would put
[offset shifting](../../../../../../docs/processes/change-conflicts.md#shifting-offsets)
on a string whose length moves for reasons the ops do not state.

The rest would mean writing the union out once per target — twelve near-identical
members to say what one table says — so it is **an invariant `submit` enforces**,
in task 9, where the incoming set is checked anyway.

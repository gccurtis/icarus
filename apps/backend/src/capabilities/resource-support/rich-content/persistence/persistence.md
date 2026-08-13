# Rich Content Persistence

`persistence/` holds storage concerns only. It does not decide capability
behavior and does not admit requests. Transactions are started and coordinated
by [`runtime-api`](../runtime-api/runtime-api.md) entries; the store executes
what they ask for.

## Files

| File | Holds |
| ---- | ----- |
| `schema.ts` | The `rich_content` Kysely table type, and its registration on `BackendDatabase` |
| `stored-types.ts` | Rows exactly as stored, and the translations to and from the canonical types in [`types/`](../types/types.md) |
| `store.ts` | The table interface: one read, one conditional update, and two transactional replacements |

### The declaration-merging exception

`schema.ts` contains the one import specifier in this capability that reaches
past another capability's `index.ts`:

```ts
declare module "#persistence/types/database.js" { ... }
```

Declaration merging must name the module that *declares* `BackendDatabase`. A
`declare module` naming `#persistence` would augment the re-export rather than
the interface, and the table would not appear on the database type. Every other
reference to `BackendDatabase` in this capability — `store.ts` and the runtime
constructor — imports it from `#persistence` as normal.

## Tables

### Table: `rich_content`

One row per content object. It corresponds to `RawContent`, with identity and
revision lifted into their own columns so both can be used as predicates.

| Column | Type | Description |
| ------ | ---- | ----------- |
| `id` | `text` | The `RichContentId`. Primary key. |
| `revision` | `integer` | The current optimistic-concurrency version. Part of the predicate on every write. |
| `raw_content` | `jsonb` | The atoms and marks, as `StoredRawContent`. |
| `updated_at` | `timestamptz` | Time of the last successful write. Defaults to `CURRENT_TIMESTAMP`; set explicitly on compare-and-swap. |

**Indexes:** none beyond the primary key. Every query is by ID.

The table is created if absent by `initialize()`, called once from the runtime
constructor. That is the capability's only startup side effect.

## Stored Versus Canonical

`StoredRawContent` is `RawContent` without `id` and `version`, because both live
in their own columns and a duplicate inside the JSONB could disagree with them.
`storedRawContent()` performs that projection on every write.

Reads translate in the other direction, and the translation is not an identity.
`currentAtoms()` rewrites the retired `"hard-break"` atom discriminator as the
current `"line-break"`. Rows written before the rename still carry it, so the
stored shape admits `LegacyLineBreakAtom` and the canonical shape does not. A
row is therefore never handed out untranslated: `store.find` reassembles a
`RawContent` and returns that. A later successful mutation rewrites the row with
the current discriminator, so a row is upgraded when it is next edited rather
than by a migration.

## Store Operations

| Operation | Reads / Writes | Description |
| --------- | -------------- | ----------- |
| `initialize` | write | Creates `rich_content` if absent. Called once, from the runtime constructor. |
| `create` | write | Inserts one new row. Called by `create`. |
| `find` | read | Selects one row by ID and translates it to `RawContent`. Called by every method except `create`. |
| `compareAndSwap` | write | Updates one row where its revision still matches, returning whether it did. Called by the eight in-place mutators, through `commit`. |
| `replaceOneWithTwo` | write | In one transaction, conditionally deletes one row and inserts two. Called by `split`. |
| `replaceManyWithOne` | write | In one transaction, conditionally deletes several rows and inserts one. Called by `combineAsList`. |

## Concurrency

Every write carries a revision predicate.

`compareAndSwap` issues `UPDATE ... WHERE id = ? AND revision = ?` and reports
whether exactly one row changed. Two runtimes that read the same revision both
issue the update; PostgreSQL lets only the first affect a row, and the second
sees zero rows updated and is turned into `stale-version` by
[`commit`](../runtime-api/shared/shared.md). The loser cannot overwrite the
winner, and nothing partial is left behind.

It also refuses outright — with a plain `Error`, not a capability error — any
candidate whose version is not `expectedVersion + 1`. That is a programming
mistake in a runtime-api entry rather than a caller conflict, so it is not
something a consumer should catch.

`replaceOneWithTwo` and `replaceManyWithOne` use the same predicate on each
conditional delete, inside one transaction. A delete that matches no row throws
an internal `CasConflict`, which unwinds the transaction and is converted to
`false` at the boundary — so a failed multi-row replacement rolls back every
deletion and inserts nothing. The entry then raises `stale-version`. The store
never throws a `RichContentError` itself: it reports whether the predicate held
and lets the runtime-api entry decide what that means.

## Invariants

- Exactly one row exists per live content ID, and its `revision` column always
  equals the `version` of the content it holds.
- A revision advances by exactly one, and only one writer can advance it from
  any given value.
- No write happens without a revision predicate.
- A multi-row replacement is all-or-nothing.
- A row is never returned to the rest of the capability untranslated; the
  retired `"hard-break"` discriminator never escapes this directory.
- The store starts transactions only for the two replacement operations, and
  begins none of its own accord — every other transaction boundary would belong
  to a runtime-api entry.

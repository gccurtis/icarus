# Rich Content Persistence

Tables, not queries. The four operations every function shares live in
[`api/shared/revisions.ts`](../api/shared/shared.md), because they are one
concern — reading a content object at a revision and replacing it only if that
revision still holds — and splitting them into a storage layer would put half the
invariant in a file that could not state it.

| File | Holds |
| --- | --- |
| [`tables.ts`](tables.ts) | the Kysely table type, and its registration on `Database` |
| [`initialize.ts`](initialize.ts) | the DDL and the drift check |
| [`stored-types.ts`](stored-types.ts) | the stored shape, and the translations |

## The table

```sql
rich_content
  id           text primary key
  revision     integer not null
  raw_content  jsonb not null
  updated_at   timestamptz not null default current_timestamp
```

## `revision` is a column, not part of the document

Every mutation compare-and-swaps on it: `where revision = expected` is what makes
a concurrent write lose rather than overwrite. A value buried inside `raw_content`
could not carry that predicate.

## No `project_id`, and there never was one

The backend's version of this table had no project column either — which under
one user was invisible and under many meant content belonged to nobody. It was a
latent defect, not a decision.

A database per project fixes it for free. Scoping is structural: there is no
predicate to write and therefore none to forget, and a capability that failed to
scope could not leak across projects because there is no cross-project reach to
fail at.

## The retired discriminator

Older rows carry `"hard-break"` where the current type says `"line-break"`.
`currentAtoms` rewrites it on the way out, so **no caller ever sees one**.

That is a migration living at the read boundary rather than in a migration
script, deliberately: rewriting every row to rename one string would be a
table-wide write for something a three-line map handles on the way past. It can
be deleted once no row carries it, and nothing above `stored-types.ts` would
notice.

## Initialization verifies as well as creates

`createTable().ifNotExists()` is not a migration strategy — it creates when
absent and does nothing when present, so the first added column silently succeeds
against an outdated database and fails later at query time, far from the cause.

After creating, `initialize` introspects the columns actually present and throws
on any difference **in either direction**. A missing column is the obvious case;
an unexpected one is the direction that is easy to miss, because dropping a
column from `tables.ts` leaves the database exactly as it was and every query
keeps working until someone wonders what the column is for.

Real migrations replace this later. The check buys time, not correctness.

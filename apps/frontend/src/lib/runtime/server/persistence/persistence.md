# Persistence

One database **per project**, not one per process.

A project is its own PGlite directory. That is what makes project scoping
structural: no query carries a `project_id` predicate, no table carries the
column, and a capability that forgets to scope *cannot* leak across projects
because there is no cross-project reach to forget.

```text
data/projects/<projectId>/     one embedded PostgreSQL database
```

Under Postgres later this becomes a schema or a database per project. The
registry is the only code that changes.

## The registry caches promises, not values

Two requests for the same project arriving together must not each open PGlite
against the same directory. The second would race the first's schema
initialization, and **PGlite is single user/connection**, so the loser fails in
a way that reads like corruption. Storing the in-flight promise makes the second
await the first.

A failed open is evicted, so a transient failure does not poison that project for
the process's lifetime.

## Project ids become directory names

They are validated, and rejected rather than sanitized. A silently rewritten id
would open a *different* project's database — the worst outcome available for a
mistake this cheap to catch.

## Initializers

`INITIALIZERS` is the composition root for storage: the one place that knows the
full set of tables a project database holds. Each capability with a
`persistence/` exports one, and a capability absent from that list has no tables
however many it declares.

Each initializer creates its tables if absent **and then verifies them**.
`createTable().ifNotExists()` is not a migration strategy — it creates when
absent and does nothing when present, so the first added column silently
succeeds against an outdated database and fails later at query time, far from the
cause. Real migrations replace this; the check buys time, not correctness.

## Closing

Both `database.destroy()` and `pglite.close()` are needed. Destroy ends the
dialect's connection; close releases the WASM instance and its file handles, and
without it the directory stays locked against the next open.

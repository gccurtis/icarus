# supabase

The destination for database schema management. **Nothing here is active yet.**

The backend currently persists through SQLite (`better-sqlite3`), with one database file per
capability under `./data/` and per-project isolation by table-name prefix. That continues to work and
is not being replaced right now.

This directory exists because the storage transition is planned, and the architecture it lands in is
settled even though the transition is not scheduled. When it happens, this directory holds:

```text
config.toml     local Supabase project configuration
migrations/     SQL schema, functions, indexes, and policies
tests/          policy and database behaviour tests
seed.sql        local seed data
```

## Why it is empty

Creating `config.toml` starts a real twelve-container local stack and commits to port allocation, auth
settings, and which Supabase services run. None of that is decided, and an unconfigured stack is worse
than no stack — `supabase start` succeeds without a config file and silently brings up a default
project that is not Icarus.

## What has to be true before anything lands here

Two decisions, in order:

1. **Database-per-project or schema-per-project.** PostgreSQL cannot query across databases without
   FDW, and connection pools are per-database, so N projects means N pools. Schema-per-project keeps one
   pool and switches `search_path`. Supabase's local stack is a single PostgreSQL database and PostgREST
   exposes a configured schema list, so schema-per-project is the shape that fits the tooling.
2. **How project scope reaches a query.** Today `projectId` is static configuration
   (`etc/configuration.yaml`), captured once when each store is constructed at startup — so the process
   serves exactly one project. Requests carrying `userId` and `projectId` require project scope to move
   from construction time to call time.

Neither is blocked by anything here. Both are recorded in
[docs/directory-reorganization.md](../../../docs/directory-reorganization.md).

## What is being done instead, now

Access to persistence is being standardized and centralized behind a persistence capability, so that
the eventual swap changes one implementation rather than every capability. See
`src/capabilities/persistence/`.

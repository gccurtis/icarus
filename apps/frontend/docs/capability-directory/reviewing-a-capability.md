# Reviewing a Capability

The template exists so review is mechanical. Work down this list; each item is
answerable by opening one directory.

## Structure

1. `pnpm lint` passes. Every structural rule in this section is machine-checked;
   if lint is green, skip to the judgment items.
2. Directories present are only: `docs`, `types`, `api`, `persistence`, `test`.
   An unused directory is absent, not empty.
3. Every directory has a document named after it, and the capability root has
   `overview.md`. Exempt: `test/`, `docs/`, and nested procedure directories.
4. Every path named in a function's procedure tree resolves on disk.

## Documentation

5. `overview.md` states the boundary — what the capability owns and what
   consumers own — the public functions, the tables, and the invariants.
6. Each directory's document says what that directory is for. A document that
   restates its code has failed; a document that contradicts its code is worse
   than none.
7. `docs/` holds only material belonging to no single directory.

## Contract

8. `index.server.ts` exports the intended surface: procedures, public types, the
   error type. Nothing else.
9. `index.ts` re-exports remote functions and nothing else, and imports nothing
   but `.remote.ts` files. This is what keeps the server graph out of the browser
   bundle.
10. No file outside the capability imports past a door.
11. `types/` contains no Kysely row shapes.

## The public surface

12. Every function in `api/` is one the capability means to offer. The set is
    designed — it does not exist because something else has that shape.
13. Every entry takes `Scope` as its first parameter, and **no input type carries
    `projectId` or `userId`.** A scope field on an input is a client naming its
    own authority.
14. Every function with a `.remote.ts` validates what it receives. It is directly
    reachable by an untrusted browser, and `'unchecked'` means the capability is
    the only check.
15. Every function *without* a `.remote.ts` genuinely has no browser caller. An
    absent remote file is a claim, not an oversight.
16. Each `.remote.ts` exports exactly one remote function, named for its
    directory, and exports nothing else — a plain export throws at module load.
17. No function directory imports from another function directory. A procedure
    two functions need is promoted to `shared/`.

## Procedures

18. Procedures in `api/shared/` are used by more than one function, and each
    preserves a stated invariant. A single-caller procedure sitting in `shared/`
    belongs in its function's directory.
19. A supporting procedure with sub-procedures of its own is a directory, not a
    pile of sibling files.
20. Infrastructure is imported, not threaded: no procedure takes a logger,
    configuration, or a database as a parameter.
21. Every entry records its call through the shared instrumentation procedure.
    Skipping it means a browser-reachable call leaves no trace.

## Persistence

22. `persistence/` holds tables, not queries: `tables.ts`, `initialize.ts`,
    `stored-types.ts`. SQL lives with the function that runs it.
23. **No query carries a `project_id` predicate and no table carries the column.**
    A project is its own database. A predicate here means someone imported the
    wrong scoping model.
24. Data scoped to a user as well as a project carries `user_id` **in the primary
    key**, not merely as a column, so a write that omits it collides rather than
    landing in another user's row.
25. `initialize.ts` creates *and* verifies — it introspects the columns actually
    present and throws on drift. `ifNotExists()` alone silently accepts an
    outdated table.
26. `stored-types.ts` is distinct from `types/`, and a row is never handed to a
    consumer directly.
27. Transaction boundaries are started by `api/` entries.

## Tests

28. Each public function has coverage in `test/unit/`, mirroring the source
    directory it covers.
29. Each fixed defect has a file in `test/regression/`.
30. Performance, concurrency, and resource behavior the capability claims in its
    documents is tested in `test/non-functional/`.
31. Tests exercise real behavior. A test that asserts its own fixture back is
    worse than no test, because it reports success either way.

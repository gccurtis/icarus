# Reviewing a Capability

The template exists so review is mechanical. Work down this list; each item is
answerable by opening one directory.

## Structure

1. `pnpm lint` passes. Every structural rule in this section is machine-checked;
   if lint is green, skip to the judgment items.
2. Directories present are only: `docs`, `types`, `api`, `test`. An unused
   directory is absent, not empty.
3. Root files are only: `overview.md`, `schema.ts`, `errors.ts`. A capability
   that stores nothing has no `schema.ts`; one that states no refusals has no
   `errors.ts`.
4. Every directory has a document named after it, and the capability root has
   `overview.md`. Exempt: `test/`, `docs/`, and nested procedure directories.
5. Every path named in a function's procedure tree resolves on disk.

## Documentation

6. `overview.md` states the boundary — what the capability owns and what
   consumers own — the public functions, the tables, and the invariants.
7. Each directory's document says what that directory is for. A document that
   restates its code has failed; a document that contradicts its code is worse
   than none.
8. `docs/` holds only material belonging to no single directory.

## The public surface

**This is the section worth slowing down for.** Everything the deployment door
registers is reachable by anyone holding the deployment URL.

9. Every function in `api/` is one the capability means to offer. The set is
   designed — it does not exist because something else has that shape.
10. **Every registration is built from `projectQuery` or `projectMutation`.** A
    bare `query`/`mutation` means the function runs with no membership check at
    all, and needs a stated reason in `overview.md`.
11. Every registration declares an `args` validator. That validator is the
    security boundary — an absent or `v.any()` one accepts whatever arrives.
12. **No input type carries a project or a user.** A scope field on an input is a
    client naming its own authority; the gate consumes the token so a handler
    cannot name a project it was not given.
13. The kind is right: a `projectQuery` may not write, and a mutation that only
    reads is a subscription nobody gets.
14. No file under the capability imports `query`, `mutation`, or their internal
    forms. A capability holds handlers.
15. No function directory imports from another function directory. A procedure
    two functions need is promoted to `shared/`.

## Procedures

16. Procedures in `api/shared/` are used by more than one function, and each
    preserves a stated invariant. A single-caller procedure sitting in `shared/`
    belongs in its function's directory.
17. A supporting procedure with sub-procedures of its own is a directory, not a
    pile of sibling files.
18. Infrastructure is imported, not threaded. What varies with the caller arrives
    on `ctx`; nothing else is a parameter.

## Storage

19. A read or write lives with the function that runs it, promoted to `shared/`
    only when a second function runs it.
20. **Every index leads with `projectId`**, and every scoped table carries it.
    One deployment holds every project, so a read that forgets the predicate
    reads everyone's rows.
21. A stored shape is converted at the boundary, and is never handed to a
    consumer directly.
22. A read-then-write is safe because the mutation is one serializable
    transaction — check that it *is* one mutation, and not a read in a query
    followed by a write the caller sends back.

## Tests

23. Each public function has coverage in `test/unit/`, mirroring the source
    directory it covers.
24. Each fixed defect has a file in `test/regression/`.
25. Performance, concurrency, and resource behavior the capability claims in its
    documents is tested in `test/non-functional/`.
26. Tests exercise real behavior. A test that asserts its own fixture back is
    worse than no test, because it reports success either way.

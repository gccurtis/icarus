# Reviewing a Capability

The template exists so review is mechanical. Work down this list; each item is
answerable by opening one directory.

## Structure

1. `pnpm lint` passes. Every structural rule below is machine-checked; if lint is
   green, skip to the judgment items.
2. Directories present are only: `docs`, `types`, `runtime-objects`,
   `runtime-api`, `persistence`, `endpoints`, `test`. An unused directory is
   absent, not empty.
3. Every directory has a document named after it, and the capability root has
   `overview.md`. Exempt: `test/`, `wire/`, `docs/`.

## Documentation

4. `overview.md` states the boundary — what the capability owns and what
   consumers own — the runtime objects, the public API, and the invariants.
5. Each directory's document says what that directory is for. A document that
   restates its code has failed; a document that contradicts its code is worse
   than none.
6. `docs/` holds only material belonging to no single directory.

## Contract

7. `index.ts` exports the intended surface: runtime object types, constructors,
   public types, error type. Nothing else.
8. No file outside the capability imports past its `index.ts`.
9. `types/` contains no Kysely row shapes and no HTTP or Fastify shapes.

## Runtime

10. Every method on an exported runtime interface has exactly one `runtime-api`
    directory, and every directory has a matching method.
11. `definition.ts` methods are delegations only — no queries, no algorithms, no
    decoding.
12. `constructor.ts` is the only place that performs startup work.
13. Procedures in `runtime-api/shared/` are used by more than one method, and
    each preserves a stated invariant. A single-caller procedure sitting in
    `shared/` should move into its method's directory.
14. No method directory imports from another method directory.

## Persistence

15. `persistence/` contains storage only; no capability behavior, no admission.
16. Transaction boundaries are started by `runtime-api` entries, not by the
    store.
17. `stored-types.ts` is distinct from `types/`, and rows are never handed to a
    consumer directly.

## Endpoints

18. `register.ts` contains registration only.
19. `wire/` exists wherever the endpoint admits input, and rejects unknown keys,
    unknown discriminants, and out-of-range values before the runtime is called.
20. `endpoints/*/procedures/` exists only where the endpoint genuinely composes
    work the runtime object does not offer — and its document justifies that.
21. Expected conflicts are responses; unexpected failures throw.

## Tests

22. Each public method has coverage in `test/unit/`, mirroring the source
    directory it covers.
23. Each fixed defect has a file in `test/regression/`.
24. Each endpoint has a request in `test/bruno/`.
25. Performance, concurrency, and resource behavior that the capability claims
    in its documents is tested in `test/non-functional/`.

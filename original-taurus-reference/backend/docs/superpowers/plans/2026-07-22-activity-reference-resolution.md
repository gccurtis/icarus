# Activity reference resolution implementation plan

**Status:** implemented in the paired activity worktrees; verification and
review pending.

**Design:**
[Activity reference resolution](../specs/2026-07-22-activity-reference-resolution-design.md).

## Increment 1 — bounded reference resolvers in Omega

1. Add an Access safe-profile query scoped to target membership in the selected
   Project, with memory/SQLite-independent domain tests.
2. Add a thin User handler and `GET /users/:userID` in the selected-Project route
   group; test anonymous, unselected, member, departed/foreign, and missing
   cases.
3. Add `Get` to the Resource family contract and service, plus a metadata-only
   Document summary lookup and Document adapter implementation.
4. Expose `GET /resources/:kind/:resourceID`; test live, renamed, deleted,
   cross-Project, unknown-kind, and unavailable-kind behavior.
5. Update every changed non-test Go companion verbatim, architecture docs,
   backend guide, focused dev-test coverage, and a numbered change record.
6. Run `go test ./...`, focused `go test -race`, and `go vet ./...`.

## Increment 2 — real Overview Activity in Alpha

1. Replace `data/overview.ts`'s generated offset feed with an async API client
   over Omega's opaque cursor, preserving UI-friendly types at the boundary.
2. Add bounded User-profile and Resource-metadata lookup functions in the data
   layer.
3. Convert `ActivityFeed` to async initial/next-page loading with concurrency,
   empty, and error handling; remove the Activity Mock badge.
4. Resolve actors lazily with snapshot fallback and resolve targets before
   opening them.
5. Add optional `resourceKind` to serialized tabs and use it in `WorkSurface`
   before the legacy mock-catalog lookup.
6. Update source companions, discrepancy/backend-request/orientation status,
   and the Alpha change record.
7. Run `nix develop --command pnpm check`, `pnpm build`, and focused Playwright
   coverage against the paired Omega worktree.

## Handoff boundary

This branch stops after real Activity plus point reference resolution. It does
not replace Alpha's full localStorage Resource catalog, integrate Project
purpose, or merge the broader Quarterback/Slides work.

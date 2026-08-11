# Resource, Project purpose, and Activity implementation plan

**Goal:** implement the accepted deterministic Taurus Alpha backend requests on
`feature/backend-requests-audit`: Project purpose, a unified owner-routed
Resource lifecycle, semantic Project Activity, and aggregate Project
`updatedAt`.

**Design:**
[Resource, Project purpose, and Activity design](../specs/2026-07-21-resource-purpose-activity-design.md).

**Scope boundary:** do not implement AI generation, merge/rebase Quarterback or
Slides, create placeholder content families, or add download/export.

**Implementation outcome:** increments 1–5 are implemented on this branch. The
closeout commands and documentation status are recorded after verification;
the scope boundary above remains unchanged.

## Repository constraints

- Build one working vertical slice at a time; do not scaffold future family
  adapters.
- Every changed non-test `core/**/*.go` file must have its sibling `*.go.md`
  reproduce the source verbatim.
- Each implementation increment gets a numbered change record, with small
  follow-ups appended to the relevant record.
- Deterministic behavior uses unit, SQLite, transport, and race tests. No live
  provider call is needed for these workstreams.
- All Resource and Activity routes use the trusted selected Project from
  `access.Context`; Project IDs never come from request bodies/query parameters.

## Increment 1 — Project purpose and field-level authorization

### Files

- Modify `core/capability/access/project.go` and `project.go.md`.
- Modify `core/capability/access/memory.go` and `memory.go.md` only where whole
  Project values or update behavior require it.
- Modify `core/capability/access/project_test.go`.
- Modify `core/platform/storage/sqlite/sqlite.go`, `sqlite.go.md`, and
  `sqlite_test.go`.
- Modify `core/handlers/project/project.go`, `project.go.md`, and transport tests.
- Modify `docs/architecture/capabilities/access.md`, `docs/backend-guide.md`,
  and `dev-test/projects/*`.
- Add the increment's change record.

### Steps

1. Add `Purpose` to `access.Project`, a 1,000-rune limit, and
   `ErrInvalidPurpose`/empty-patch handling.
2. Add `Purpose *string` to `ProjectChanges`; normalize/trim it and distinguish
   omitted from explicit empty/clear.
3. Replace the blanket owner gate in `UpdateProject` with whole-request policy:
   owner may change all fields, edit may change purpose only, read may change
   nothing. Reject mixed unauthorized patches atomically.
4. Detect normalized no-ops and return the current Project without changing
   profile `UpdatedAt`.
5. Add the idempotent SQLite `purpose` migration and thread the field through
   create/read/list/update and the MemoryStore.
6. Add `purpose` to every Project JSON view and bind it in the existing PATCH.
7. Test owner/editor/read matrices, mixed patches, clear, rune limit, empty
   patch, no-op timestamp behavior, project isolation, SQLite restart, and HTTP
   status mapping.
8. Update companions, access architecture, backend guide, dev-test walkthrough,
   and the change record; run `go test ./...`, targeted race tests, and `go vet`.

### Commit boundary

This increment can commit independently: purpose persistence works before
Resource or Activity exists, and `updatedAt` still has its previous profile-only
wire meaning until the later composition increment.

## Increment 2 — Activity model, paging, and durable read store

### Files

- Add `core/capability/activity/activity.go`, `activity.go.md`, and tests.
- Add `core/capability/activity/memory.go`, `memory.go.md`, and tests if keeping
  the in-memory store separate improves clarity.
- Add `core/handlers/activity/activity.go` and `activity.go.md`.
- Modify `core/platform/storage/sqlite/sqlite.go`, `sqlite.go.md`, and tests.
- Modify `core/transport/transport.go`, `transport.go.md`, and tests.
- Modify `core/wiring/wiring.go` and `wiring.go.md`.
- Add `docs/architecture/capabilities/activity/README.md`.
- Add the increment's change record.

### Steps

1. Define the closed `Action` vocabulary, actor/Resource snapshots, Event,
   page request/result, cursor bounds, and stable errors.
2. Implement cursor encode/decode and deterministic
   `occurredAt DESC, id DESC` pagination as pure/testable behavior.
3. Define an Activity read Store with `List(projectID, page)` and
   `LatestByProjects(projectIDs)`; expose no public event append operation.
4. Add the `activity_events` SQLite table, Project/time index, and unique source
   identity. Use fixed-width sortable timestamps for keyset comparison.
5. Implement SQLite and in-memory reads, including empty lists, invalid cursor,
   exact tie ordering, batch latest lookup, and Project filtering in storage.
6. Add the Project-scoped `GET /activity` handler with default 8/max 100 and
   RFC3339 timestamps. Map malformed cursor/limit to 400.
7. Wire the read service and route. At this point the feed is valid but empty;
   the next increment adds the only production event producers.
8. Test cursor round trips/tampering, limit bounds, duplicate source identity,
   cross-Project isolation, deleted-style snapshots, restart persistence, and
   route authorization.
9. Update companions, architecture/backend docs, and the change record; run the
   full suite, race tests, and vet.

### Commit boundary

The empty feed is honest and useful as a completed query foundation. No fake
seed events or public test append route are added.

## Increment 3 — Document semantic facts and correct timestamps

### Files

- Modify `core/capability/document/document.go`, `document.go.md`, and tests.
- Modify `core/capability/document/memory.go`, `memory.go.md`, and tests.
- Modify `core/handlers/document/document.go` and `document.go.md`.
- Modify `core/platform/storage/sqlite/sqlite.go`, `sqlite.go.md`, and tests.
- Modify affected transport tests and dev-test Document/changeset scripts/docs.
- Modify `docs/architecture/capabilities/documents/README.md` and
  `docs/backend-guide.md`.
- Add the increment's change record.

### Steps

1. Define Document-owned semantic facts for created, edited, renamed, and
   deleted effects. Facts contain trusted actor snapshot, target snapshot,
   occurred time, and stable source identity—never arbitrary payload.
2. Pass trusted actor identity into Document create/delete/append methods and
   update every handler, internal caller, and test. Snapshot `User.Name` with
   email as the blank-name fallback; use a closed stable system actor for
   internal generated edits; do not expose a separate email in Activity.
3. Add Project-scoped `Documents.Rename`; trim/validate names, make normalized
   no-op rename return unchanged state, and add the store mutation.
4. Make accepted change-set append update `Document.UpdatedAt` at the same
   timestamp as the change set. Make background rebase preserve `UpdatedAt`.
5. Change SQLite create/rename/delete/append writes to explicit transactions
   that commit the canonical Document effect and exactly one
   `activity_events` row together. Reuse a private SQLite helper to map the
   closed Document fact; do not give handlers a generic event writer.
6. Keep Activity snapshots after Document deletion while deleting Document
   content/change sets normally.
7. Retain facts in the Document MemoryStore so domain tests prove one fact per
   accepted effect and none for invalid/conflicting/no-op work.
8. Add migration repair that raises current Document `UpdatedAt` to the newest
   retained change-set time where needed, without inventing Activity history.
9. Test atomic rollback when either canonical/event insertion fails, cross-
   Project not-found behavior, actor/target snapshots, restart survival,
   concurrent append ordering, and rebase timestamp stability.
10. Update companions and current-state docs; run the full suite, focused race
    tests, vet, and the deterministic Document dev walkthrough.

### Commit boundary

After this increment, direct `/documents` operations populate Activity and have
correct visible timestamps even though the unified Resource routes are not yet
exposed.

## Increment 4 — Unified Resource capability and Document adapter

### Files

- Add `core/capability/resource/resource.go`, `resource.go.md`, and tests.
- Add a composition-layer Document adapter under `core/wiring/` with its exact
  companion, keeping Resource independent of Document implementation types.
- Add `core/handlers/resource/resource.go`, `resource.go.md`, and tests as useful.
- Modify `core/capability/document/document.go`/companion and stores for the
  bounded summary page query.
- Modify `core/transport/transport.go`, `transport.go.md`, and transport tests.
- Modify `core/wiring/wiring.go`, `wiring.go.md`, and wiring tests if present.
- Add `docs/architecture/capabilities/resources/README.md`.
- Add `dev-test/resources/run.sh` and `manual.md`; update the dev-test index/run.
- Update `docs/backend-guide.md` and add the increment's change record.

### Steps

1. Define `Kind`, tagged identity, Summary, Actor, Page/Cursor, Family port,
   closed known-kind set, and errors for unknown/unavailable kinds, invalid
   names, bad cursors, and missing targets.
2. Freeze the provided Family set in `resource.New`; reject duplicate family
   kinds and expose sorted `AvailableKinds`.
3. Implement global keyset ordering
   (`updatedAt DESC, kind ASC, id ASC`), family-page merge, limit default/max,
   and strict cursor validation. Any family failure fails the catalog page.
4. Implement create/rename/delete dispatch with Project scope and actor passed
   only from the trusted handler. The service performs no second persistence or
   Activity append.
5. Add the bounded Document summary query and a composition adapter that maps
   common summaries/actors/errors to the Document owner.
6. Expose `GET/POST /resources` and
   `PATCH/DELETE /resources/:kind/:resourceID` in the Project-scoped route group.
   Owner/edit may mutate; read may only list.
7. Return `availableKinds` with the page. Unknown kinds map to 400; recognized
   unavailable kinds map to 409; foreign/missing targets map to 404.
8. Test that existing direct-created Documents appear under their exact IDs,
   unified create returns a fetchable Document, rename changes canonical
   Document state, delete removes it while Activity remains, paging has no
   gaps/duplicates across equal timestamps, and unsupported kinds create no
   records.
9. Update companions, architecture/backend docs, dev tests, and the change
   record; run the full suite, focused race tests, and vet.

### Commit boundary

This closes Alpha's metadata/lifecycle request for the currently available
Document family without claiming unsupported families or download/export.

## Increment 5 — Aggregate Project `updatedAt`

### Files

- Modify `core/handlers/project/project.go`, `project.go.md`, and tests.
- Modify `core/transport/transport.go`/companion only if constructor wiring
  changes there.
- Modify `core/wiring/wiring.go`, `wiring.go.md`.
- Modify SQLite migration/repair tests if the historical timestamp repair is
  not completed in Increment 3.
- Update access/activity architecture docs, backend guide, dev tests, and the
  relevant change record.

### Steps

1. Define a narrow handler-owned `ProjectActivityReader` with batched
   `LatestByProjects` and adapt Activity to it in wiring. Access remains unaware
   of Activity.
2. Replace the static Project JSON conversion with handler composition that
   returns `max(project profile UpdatedAt, latest Resource Activity time)`.
3. Batch one Activity latest query for `GET /projects`; use one-ID reads for
   create/update/current responses. Fail the response if required decoration
   fails rather than claim a stale aggregate timestamp.
4. Ensure purpose/name/icon/visibility update profile time, Resource mutations
   affect the composed value, membership/session changes do not, and rebase
   maintenance does not.
5. Backfill existing Project profile timestamps to at least their current
   Documents' repaired visible timestamps during migration, without creating
   synthetic events.
6. Test aggregate precedence, batch behavior, Project isolation, activity-store
   failure, concurrent Resource edits, and restart results.
7. Update companions/docs/change record and run all tests, race tests, and vet.

## Increment 6 — End-to-end closeout

### Verification

1. Run `go test ./...`.
2. Run `go test -race` for Access, Activity, Document, Resource, SQLite, and
   transport packages.
3. Run `go vet ./...`.
4. Run the gateway, Project, Document, Resource, and Activity dev-test suites.
5. Verify the SQLite restart path with purpose, a renamed/edited/deleted
   Document, retained Activity, and aggregate Project timestamp.
6. Verify read-role denial for every new write and cross-Project 404/isolation
   for every Resource and Activity target.
7. Run the repository companion-doc drift check if available; otherwise verify
   each changed companion's concatenated Go blocks against its source.

### Documentation closeout

- Update the inventory statuses from proposed to implemented only after the
  executable acceptance tests pass.
- Keep AI generation, Quarterback/Slides integration, unsupported families,
  and download/export explicitly open.
- Record actual final endpoint shapes and any implementation-time deviations
  from the design.

## Planned commit sequence

1. `Implement persisted Project purpose`
2. `Add Project Activity query foundation`
3. `Record atomic Document activity facts`
4. `Add unified Resource lifecycle`
5. `Compose aggregate Project timestamps`
6. `Verify Resource purpose and Activity integration`

Each commit remains reviewable and green. Do not squash the semantic increments
during development; they make it possible to evaluate or revert each backend
contract independently.

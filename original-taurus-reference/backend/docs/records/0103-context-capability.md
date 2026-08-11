# Context capability: definition, storage, and resolution (`core/capability/contexts`)

Design: [`docs/superpowers/specs/2026-07-27-context-capability-design.md`](../superpowers/specs/2026-07-27-context-capability-design.md).
A new capability, `core/capability/contexts`, promotes the include/exclude set
algebra that today lives privately in `document`'s `resolveBlockScope` into a
first-class, reusable, stored resource: a **context** — a project-scoped,
named set of resource references that can nest other contexts and resolve down
to the concrete leaf resources it represents.

## What changed

- **The definition-value model.** A context is a `Definition{Includes,
  Excludes []Ref}`, where `Ref{Kind, ID, Name}` names a resource by catalog
  identity (`Kind`+`ID`); `Name` is an optional display label resolution never
  trusts. A **stored context** (`Context`) persists `{name, includes,
  excludes}` under a project-scoped id; an **anonymous context** is the same
  bare `Definition`, built at refresh time and never written to the store. Both
  resolve through the identical path — `Context.Definition()` projects a stored
  row down to the value an anonymous one already is.
- **A deliberately dumb store.** `Store` (`InsertContext`, `ContextByID`,
  `ContextSummaries`, `UpdateContext`, `DeleteContext`) only ever holds the
  refs the user typed. It never copies resource content, never snapshots what a
  member resolves to, and is unaffected by edits/renames of the underlying
  resources — resolution is computed fresh every time, not cached on the row.
- **The `Contexts` service** (`New`, `Create`, `Get`, `List`, `Update`,
  `Delete`) validates and trims the name, normalizes both ref sets (trims each
  field, drops any ref left with a blank `Kind` or `ID`), and stamps
  id/timestamps — the CRUD surface behind the `/contexts` endpoints.
- **`Resolve(projectID, Definition) ([]Ref, error)`** is the single entry point
  for flattening a definition to its leaf refs, for both stored and anonymous
  contexts alike. It expands `Includes` and `Excludes` independently to leaf
  sets, then returns `Includes − Excludes`, deduped by `Kind`+`ID`
  (`originKey`), in include order, exclude-wins.
- **Leaf-level exclusion after full expansion.** Because subtraction happens
  on the *expanded* leaf sets rather than on the raw ref lists, excluding a
  leaf that only lives inside a nested context still removes it (include
  context `C = {d1, d2}`, exclude leaf `d1` → get `{d2}`), and excluding a
  whole nested context removes every leaf that context represents (include
  `{d1, d2, d3}`, exclude context `C = {d1, d2}` → get `{d3}`). This is the
  same algebra `resolveBlockScope` already used, moved down to the leaf level
  once expansion has happened.
- **Nesting and cycle-cutting.** A member with `Kind == KindContext` ("context")
  recurses into that context's own stored definition; any other kind is
  already a leaf. `expand` carries `visited map[string]bool`, the ancestor path
  of context ids above the current call; it is never mutated, only *copied*
  on each recursive step (the copy adds the context just entered), so a
  context on its own ancestor path is skipped rather than recursed into —
  which is what cuts a cycle like `A → B → A`, with `A`'s own leaves (`da`)
  and `B`'s own leaves (`db`) still coming through, just once each — while a
  single row's `Includes` and `Excludes` still expand independently of each
  other off the same copied path, since they feed a subtraction and must not
  poison one another (see Fix round 1 below for the bug this replaced).
- **`whole-project` via the `Catalog` port.** The reserved id
  `contexts.WholeProjectID` ("whole-project") expands to every leaf resource in
  the project by calling the injected `Catalog.AllResources(projectID)`.
  `Catalog` is satisfied over the resource catalog at composition; a `nil`
  catalog (the default from `New`, before `UseCatalog` is called) makes
  `whole-project` resolve to nothing rather than erroring. `whole-project` is
  both a resolvable id and an includable member, so "everything except X" =
  include `whole-project`, exclude `X`. Per the design, `Catalog` must never
  return context resources — `whole-project` is content, not organization.
- **Dangling context refs contribute nothing.** If a context member names an
  id the store no longer has (deleted out from under a reference, or simply
  mistyped), `expand` treats the store's `ErrNotFound` as "this member
  resolves to the empty set" rather than surfacing an error — resolution stays
  best-effort over membership that can drift.
- **`ResolveID(projectID, id) ([]Ref, error)`** resolves a stored context by
  id for the `/contexts/:id/resolved` endpoint; it is defined as resolving the
  one-member anonymous definition `{includes: [{context, id}]}`, so a stored
  context's resolution is identical in kind to resolving an anonymous
  reference to it — no separate code path.
- **Resolution is always computed live.** Nothing here caches a resolved leaf
  set anywhere. Because a member can itself be a connector or a nested context
  representing a changing set, every `Resolve`/`ResolveID` call walks the
  current membership from scratch.

## Interfaces added

- `Catalog interface { AllResources(projectID string) ([]Ref, error) }`
- `(*Contexts).UseCatalog(cat Catalog)`
- `(*Contexts).Resolve(projectID string, def Definition) ([]Ref, error)`
- `(*Contexts).ResolveID(projectID, id string) ([]Ref, error)`

`Contexts` gained a `catalog Catalog` field (alongside the existing `store` and
`now`), set only via `UseCatalog` and left `nil` by `New`.

## Verification

- Unit (`core/capability/contexts`, deterministic — pure set algebra, no
  intelligence, so a fake in-memory `Store` and a fake fixed-set `Catalog` are
  correct here): flat includes/excludes with a leaf exclude; a nested stored
  context with the exclude landing on a leaf inside it; excluding a whole
  nested context; a cycle (`A ⇄ B`) terminating and still yielding both
  contexts' own leaves in first-seen order; `whole-project` expansion via a
  fake `Catalog` minus one leaf; a dangling context reference contributing
  nothing. All pass, alongside the existing create/get/list/update/delete
  tests from the prior slice.
- `go build ./...` passes across the module.

## Settled

- Definition-value model shared by stored and anonymous contexts. ✓
- Leaf-level exclusion, computed after full expansion. ✓
- Nesting recursion with cycle-cutting via a copied ancestor-path visited-set. ✓
- `whole-project` expansion via the injected `Catalog` port, `nil`-safe. ✓
- Resolution always computed live, never cached on the record. ✓

## Fix round 1: path-based `visited` (shared-mutated map broke nested exclusion)

Code review caught a real correctness bug in the brief's original `expand`:
when a context member recursed, it threaded the **same** `visited` map into
both `row.Includes` and `row.Excludes`, mutating it in place
(`visited[r.ID] = true`) before either side expanded. Because `Includes` and
`Excludes` feed a subtraction, that shared mutation was observable: a context
id visited while expanding `row.Includes` was already marked visited by the
time `row.Excludes` needed to expand that same id, so the exclusion silently
expanded to nothing. Concretely, a stored context `C` with
`Includes = [ctxRef("X")]` and `Excludes = [ctxRef("X")]`, where `X = {x1,
x2}`, resolved to `{x1, x2}` instead of the empty set `X − X` the algebra
requires. `Resolve`'s own top-level call was unaffected (it already gives
`Includes` and `Excludes` two independent fresh maps), so the bug was latent
until a nested row itself both included and excluded the same nested context —
depth ≥ 2 from the top-level call.

**Fix:** `visited` is now a strictly read-then-copy ancestor path. `expand`
never mutates the map it was handed; on entering a context member it builds
`child`, a copy of `visited` plus that context's own id, and passes `child` to
both the `row.Includes` and `row.Excludes` recursive calls. Each side gets an
independent copy descending from the same ancestor path, so one side marking a
context visited can no longer suppress the other side's expansion of it, while
a genuine cycle (a context reappearing on its own ancestor path) is still cut
exactly as before — the `A ⇄ B` cycle test's result is unchanged. The
`err == ErrNotFound` comparison was also switched to `errors.Is(err,
ErrNotFound)` (added the `"errors"` import) as part of the same edit, for
correctness against wrapped errors from real `Store` implementations.

Two regression tests were added: `TestResolveNestedExcludeCollisionInsideRow`
(a stored context whose own `Includes` and `Excludes` both reference the same
nested context — asserts the empty result) and
`TestResolveIDResolvesStoredContext` (a direct test of `ResolveID`, which had
no dedicated test before). `go test ./core/capability/contexts/` passes all 10
tests (8 prior + 2 new), and `go build ./...` remains clean.

## SQLite store

`*sqlite.Store` (`core/platform/storage/sqlite`) satisfies `contexts.Store`
against a new `contexts` table (`project_id, id, name, creator_id,
includes_json, excludes_json, created_at, updated_at`, primary key
`(project_id, id)`) — the same shape and pattern as the `connectors` table
next to it. `Includes`/`Excludes` are stored as plain JSON-array columns via
`marshalRefs`/`unmarshalRefs`, unchanged from the definition-value model
above: the row holds only the refs the user typed, never a resolved or
cached leaf set. `InsertContext`, `ContextByID`, `ContextSummaries`,
`UpdateContext`, and `DeleteContext` follow the connector store methods'
house pattern exactly, including `scanContext` sharing the file's existing
`rowScanner` interface and mapping `sql.ErrNoRows` to `contexts.ErrNotFound`.

## Out of scope (documented future work, per the design doc)

1. Deep cascade — a change to a resource *inside* a referenced context
   triggering a refresh of dependent prompts.
2. Connectors as context-like (unifying connectors and contexts as the same
   shape).
3. Resource-family registration for `KindContext` so contexts appear in the
   unified resource catalog and picker.

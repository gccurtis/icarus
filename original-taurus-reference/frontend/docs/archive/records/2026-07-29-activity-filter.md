# 2026-07-29 — Activity gets a filter, and says what it searched

Fourth of five changes rebuilding the left rail's project-context set (plan:
[`docs/plans/2026-07-29-project-context-rail.md`](../../plans/2026-07-29-project-context-rail.md)).
The user asked for filtering on activity: a person from a dropdown, resources chosen by name in a
dialog (they can't be a dropdown — a project can hold hundreds), and "select all for a type".

## What Omega can and cannot do, and what that means on screen

`/activity` accepts `limit`, `cursor`, and `targetID` — **no actor or kind parameter**. But every
event carries `actor.id` and `target.kind` in its payload, so:

- **Exactly one resource** → the server path, `/activity?targetID=`. Exact, and it pages only that
  resource's events.
- **Anything else** (a person, a kind, several resources) → a client-side predicate over loaded pages.

The second case is honest only if the surface says so, so both callers render a scope line:

```svelte
{shown.length} of {events.length} searched{nextCursor ? '' : ' — the whole history'}
```

`3 matches` alone would imply the whole history had been searched. This states what was actually
looked at, and says explicitly when that happens to be everything. Nothing was faked and no backend
request was needed — the filter is complete in the limit, because paging keeps going.

## The semantics that had to be chosen

```ts
const targetNamed = filter.resourceIds.length > 0 || filter.kinds.length > 0;
if (!targetNamed) return true;
return filter.resourceIds.includes(event.target.id) || filter.kinds.includes(event.target.kind);
```

Dimensions AND, values within a dimension OR — except **`resourceIds` and `kinds` OR with each
other**, because both answer "which resource". Ticking "Q3 brief" *and* "all slides" means that
document or any deck; ANDing them would match nothing, since no resource is both. A test names that
case as the one that decides the design.

Per-group **All** adds the *kind*, not a snapshot of ids — so a document created later still matches
"all documents" — and selecting a kind drops any individually-named resource of that kind, which
would otherwise be invisible state showing as a second chip for one intent.

## Where it appears

**The rail's History lens** gets the full treatment: a `Filter…` button that becomes `Filtered · N`,
removable chips, the server path when it applies, and bounded auto-paging (`AUTO_PAGES = 4`,
`ENOUGH_MATCHES = 5`) so a filter chases its first matches instead of showing "no matches" beside a
`Load more` button. Bounded on purpose — unbounded auto-paging is a request storm on a project with
years of history.

**The Overview stage's Activity box** gets the same dialog and predicate behind one small button in
its eyebrow row. No chips (224px tall, the rows are what it is for), no server path (it caps and pages
by scroll, so `targetID` would buy nothing), and its filter is per-instance and unpersisted — a glance
box that reopened tomorrow still hiding most of the project's activity would read as broken.

## Two bugs the browser found

**The lens hung on "Loading history…".** The project-change `$effect` resets `filter`, and `loadFirst`
*reads* `filter` (for the `targetID` path) inside the effect's synchronous stack — a write to its own
dependency, so it re-ran forever. `untrack` around the body is load-bearing, not defensive, and the
comment in the source says so.

**A chip read "All document".** `kindMeta.label` is singular because it labels one resource; anything
naming a *set* needs the plural, and the plurals already existed as `RESOURCE_KINDS`' display labels.
`kindPluralLabel` in `features/shared/kinds.ts` reads them rather than adding a second table that
could disagree.

## Verification

`pnpm check` 0 errors / 0 warnings · `pnpm test` 416 → **434 passing** (18 new for the filter model:
semantics, the server-path shape, and chip clearing) · `verify-companions` OK on all five touched
sources · `pnpm build` clean · `pnpm exec playwright test e2e/context-rail.spec.ts` 3/3, the History
case now driving both filter paths (one resource, then a whole kind) and asserting the scope line.

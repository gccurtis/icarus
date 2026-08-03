# Structured Analytic flows

## Pull

The whole capability in one method. Order matters at two points, both marked.

1. **Load and capture the revision.** Everything below is against this revision;
   a concurrent edit loses the repair rather than corrupting the result.
2. **Resolve each input.** Name first, recorded `entryId` second — that order is
   the rename story. A name that still resolves wins even if the id moved,
   because the name is the selector.
   - name resolves, id matches or none recorded → `ok`
   - name resolves, id differs → `retargeted` (reported, not refused)
   - name does not resolve, id does → `renamed`
   - neither → `AnalyticPullError("input_not_found")`
3. **Reject a broken upstream.** An input that resolves to an entry with a
   resolution issue is `input_unresolved`, which is a different problem with a
   different fix than `input_not_found`.
4. **Heal, then compile — in that order.** ← *load-bearing.* Compiling the
   stored definition first would emit an expression naming an entry that no
   longer exists, so every renamed source would fail to evaluate. That is
   exactly what the repair exists to prevent.
5. **Persist the heal.** One revision-conditioned `UPDATE` that does not advance
   `revision`, write history, or touch `updated_at`. Losing it is fine.
6. **Snapshot and evaluate.** One snapshot for the whole analytic, so every
   input sees the same instant.
7. **Permute cells.** ← *load-bearing.* The compiled table names its columns by
   placement name but orders them keys-then-aggregates; a pull reports
   Rows-then-Columns. The permutation is by name, not position.
8. **Check the display's data half.** A chart needs a numeric measure. The
   structural half was settled at save.
9. **Build the receipt** from `observedDependencies`.

## The rename repair, in full

An input recorded `entryId: e-orders` for name `Orders`. Someone renames that
entry to `Sales Orders`.

```
metadata("Orders")        -> undefined
metadataById("e-orders")  -> { displayName: "Sales Orders", revision: 4 }
```

The input heals to `{ name: "Sales Orders", as: "Orders", entryId: "e-orders" }`.

**`as` is pinned to the old key.** An input's key is `as ?? name`, so healing a
name with no `as` would rename the handle that every field reference, join side,
and `ASTABLE` coercion points at. It would still compile — and a list-valued
input would then synthesize a column nothing referenced. A second rename does
not re-pin, because `as` already holds.

The revision does not move. Viewing a chart must not invalidate every open
editor's `expectedRevision`, and `updated_at` is untouched so a read does not
reorder the catalog.

`check` performs the same repair, for the same reasons.

## Save

Compile, then declare a formula entry under the name. **Nothing is evaluated**,
so it cannot fail on data — an analytic whose sources are broken today still
saves and starts working when they are fixed.

## Copy

Run a full pull, then declare a literal table from the resolved rows. The
inverse trade: it evaluates, so it can fail on data, and what it writes never
moves again.

Exact rationals become JSON numbers at this boundary — precision beyond a double
is lost, which is a reason to prefer `save` when the numbers matter.

## Create and update

Validate → **compile** → capture `entryId`s → write.

Compiling before storing is the point: a definition that cannot be lowered is
rejected once, here, rather than failing on every pull afterwards.

`entryId` is always overwritten from the project, never taken from the caller.
Honouring a supplied value would let a caller attach an arbitrary id to a name
that does not resolve, and the first pull would resolve the input to an entry the
name never referred to — then heal the stored name to match. A caller-directed
retarget through a field documented as a hint.

## Delete, purge

Delete archives the final snapshot at N, appends a tombstone at N+1, and removes
the current row — one transaction, both history rows sharing a timestamp so
retention treats them as one event.

Purge is legal only afterwards, and the store enforces that itself.

# Structured Analytic — supplementary changes

Changes to **other** capabilities that Structured Analytic wants, but which are
not required to ship it. Recorded here so the analytic design does not quietly
grow a workaround for something better fixed at its source.

> The Formula relational builtins (`ASTABLE`, `JOIN`, `GROUP`, `AGGREGATE`,
> `SORT`, `LIMIT`, `DISPLAY`) were previously listed here. They are now **in
> scope** — see [compilation.md](compilation.md) and Phase 1 of the
> implementation plan.
>
> The `#formula` barrel change was also listed here and is **no longer needed**:
> under compilation, Formula performs all arithmetic and the capability needs no
> rational helpers.

---

## 1 · Structured Data: propagate revisions to dependents

**Status: wanted, not required.**

### The problem

A Structured Data entry's `revision` advances when *that entry* is edited. It
does not advance when something it depends on changes.

```text
Orders          revision 12    ← someone appends rows, now revision 13
Total = SUM(Orders.amount)     ← revision 4, unchanged, value completely different
```

So `Total`'s revision is not a change signal. Anything that caches a value keyed
by revision — a pull receipt, a freshness check, a document snapshot — reports
"unchanged" while the number on screen has moved.

### Why the alternatives are worse

A value digest detects the change but cannot explain it: it says "different from
what you had" without saying what it was, why, or where to look. It is a boolean
nobody can act on, and it is why digests were removed from the pull receipt.

A revision is an **address** — a point in that entry's history you can go and
inspect. That property is only true if revisions actually move when values do.

### The change

When an entry's revision advances, advance the revision of every entry
transitively dependent on it, in the same transaction.

The dependency graph already exists. Formula computes symbolic and observed
dependencies (`0-platform/formula/dependencies.ts`), and the resolver tracks
which entries wait on which during its fixpoint passes (`waitingDependencies` in
`1-init/create/formula-name-resolver.ts`). What is missing is persisting that
edge set on the Structured Data side so a write can walk it without a full
resolve.

### Consequences to think through first

- **Write amplification.** Editing a widely-referenced table bumps many rows in
  one transaction. Bounded by the graph, but worth measuring.
- **Cycles.** Formula already rejects cyclic bindings (`cycle_error`), so the
  graph is a DAG — but the propagation walk needs its own guard rather than
  trusting that.
- **History volume.** Every capability now archives a snapshot per revision. A
  propagated bump writes history for an entry whose *authored* content did not
  change, which is arguably noise. That may argue for separating "authored
  revision" from "value revision", at which point receipts should carry the
  value revision.
- **It fixes a latent cache bug.** `buildSnapshot()` caches on a signature built
  from `id:revision:displayName:kind`. Today a derived entry's value can change
  without its revision moving, so that signature can miss a real change.
  Propagation makes the signature correct — a second, independent argument for
  this change.

### Effect here

`analytic.check` becomes a complete freshness signal instead of a reliable
*changed* detector and an imperfect *unchanged* one. Nothing in the analytic
design changes; a documented limitation disappears.

---

## 2 · Structured Data: nothing else

Recorded to close the question: the metadata read the analytic adapter needs
(`{ id, name, revision }` without evaluation) is served by the existing
`list()`, which returns rows straight from the store. It is a mapping in the
`1-init` adapter, not a capability change. The cost of `analytic.check` is a
table scan, not a resolve.

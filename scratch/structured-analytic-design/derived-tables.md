# Structured Analytic — becoming project data

**Status: in scope.** Two commands, `analytic.save` and `analytic.copy`. The
mechanism details are here; the runtime contract is in
[operations.md](operations.md#save-and-copy).

## Why this stopped being hard

An earlier draft of this page was about a dependency cycle: a live derived table
would need Structured Data to call Structured Analytic, which reads Structured
Data.

Compilation removed the problem entirely. A compiled analytic is an ordinary
Formula expression, so storing one is storing an ordinary formula-backed
Structured Data entry. The resolver evaluates it exactly as it evaluates every
other formula, with the fixpoint ordering, waiting-dependency tracking, and
`cycle_error` rejection that already exist. **Structured Data never learns that
Structured Analytic exists.**

Liveness comes free with it: the entry re-resolves whenever the snapshot is
rebuilt, because that is what formula-backed entries do.

The second thing that had to be solved was output naming, and moving filters to
a `WHERE` builtin solved it as a side effect — see
[compilation.md](compilation.md#research-findings-that-shaped-this). Because no
field name in compiled source needs to be a Formula identifier, `JOIN`
qualification and `GROUP`'s `as` produce readable columns like `Orders.region`
and `Total`. A saved entry has usable field names with no rename step.

## `analytic.save` — the live link

```text
compile the definition           → a FormulaExpression
declare a `variable` entry       → body = the compiled source, name = the given name
return { entryId, name, revision }
```

That is the whole implementation. No evaluation happens at save time, so it is
cheap and cannot fail on data.

What the caller gets is a named project value that:

- re-resolves against current data on every read;
- is referenceable from any formula, document, or other analytic;
- carries its display intent, because the body's outermost call is `DISPLAY` —
  so it is simultaneously a chart and a table, usable as either without
  conversion; and
- breaks exactly the way any other formula breaks if a source is renamed, which
  is a familiar failure rather than a new one.

### Two records of the same thing

Editing the analytic afterwards does **not** update the saved entry. The entry
holds a snapshot of the compiled source, not a reference to the analytic.

This is deliberate for the first version, and the alternative is worse than it
looks: republishing on every analytic edit means the analytic must track its own
links, which is a back-reference this design has otherwise avoided everywhere.
It also means an edit silently changes a value other formulas depend on.

So: **save is an export, not a subscription.** Saving again under the same name
is how you refresh it, and that is an explicit act. If a real need for automatic
republication appears, it wants its own design pass — the natural shape is a
recorded link plus an explicit `analytic.resync`, not an implicit write on every
update.

## `analytic.copy` — the deliberate freeze

```text
run a full pull                  → resolved rows
declare a `table` entry          → literal fields and rows
return { entryId, name, revision, rowCount }
```

Independent from that moment. A quarterly report that must *not* move later is a
copy on purpose, not a degraded save.

Copy costs a full evaluation and can fail on data (422) where save cannot.

## The writer port

One narrow port, implemented by an adapter in `1-init`, so the capability keeps
importing nothing from `#structured-data`:

```ts
interface StructuredDataWriter {
  declareFormula(input: {
    name: string;
    description?: string;
    body: string;
  }): Promise<{ id: string; name: string; revision: number }>;

  declareTable(input: {
    name: string;
    description?: string;
    fields: readonly string[];
    rows: readonly (readonly CellLiteral[])[];
  }): Promise<{ id: string; name: string; revision: number }>;
}
```

Structured Data's live display names are uniquely indexed case-insensitively, so
a taken name surfaces as a conflict the adapter maps to 409 `name_conflict`.

## Provenance is deliberately not tracked

A saved or copied entry does not record which analytic produced it, and is an
ordinary Structured Data entry among all the others.

That is the intended end state, not a gap. Recording provenance would buy "show
me what depends on this analytic" and an automatic `resync`, and both cost a
back-reference from Structured Data toward Structured Analytic — the exact
direction this design keeps out. The entry is a value in the project; how it got
there is not part of what it means.

# Name Manager

The project's named values. One place where a name means a value, so formulas,
analyses, and prompts all draw on the same vocabulary.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | one project's variables, in definition order |
| `define` | mutation | names a value, returning its id |
| `remove` | mutation | takes a name out of the vocabulary |

Registered in
[`src/convex/capabilities/nameManager.ts`](../../../convex/capabilities/nameManager.ts)
— **camelCase**, because Convex rejects a hyphen in a module path.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `nameVariables` | one row per name: both forms of it, the declared type, the value, and where it sits in definition order |

## It evaluates nothing

This is the decision the whole capability is shaped by. A variable holds a value
that arrived already computed: if a name should hold the result of a
computation, **the caller evaluates it and sends the result**.

Validation is therefore structural only —
[`canonicalValue`](api/define/define.md) checks that the payload is the kind that
was declared, and nothing here parses an expression or resolves a reference.
Declare `number`, send a function, and it is refused because it is not a number.

That is what keeps the dependency one-way:
[`formula`](../formula/overview.md) asks this for a name, and this asks formula
for nothing.

## Two forms of the name

`nameKey` is the lookup form — lowercased, whitespace removed — and it is what
the uniqueness invariant and its index are on. `name` is what the author typed
and what gets displayed.

Storing both is what makes `TargetMargin`, `targetmargin`, and `Target Margin`
one variable while a person still sees the casing they chose. Normalizing on
read would put the transformation in every lookup and leave no index able to
serve one.

## Every variable is a table, degenerately

[`asTable`](types/types.md) projects any value into one: a table is itself, a
record is one row with its fields as columns, a list is one column, a scalar is
one cell, and a function is refused because it is not an input. Analyses in
pass 8 read every variable through it, which is why an author never has to know
how something was declared before putting it on a shelf.

## Capability Invariants

- **`(projectId, nameKey)` is unique, and `define` is the only thing that says
  so.** Convex has no unique index; the read-then-insert inside one serializable
  mutation is the enforcement point, and a second write path would break it
  silently.
- **A name conflict is decided before the type and the value.** Behaviour, not
  ordering of convenience: an author correcting a typo in a value should not be
  told their value is malformed when the real problem is that the name is taken.
- **`definitionOrder` is a counter, not a clock.** Two variables defined in the
  same millisecond still have an order, and a list that reshuffles between reads
  is worse than an arbitrary but stable one.
- **A refusal is "not found", never "forbidden".**
- **Attribution is built from the scope**, never accepted as an argument.
- **Every refusal is thrown as `NameManagerError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a name conflict thrown
  as a plain `Error` arrives as a server fault and stops being a refusal.

## What is not here

**No redefinition.** A name is defined or removed; changing what one holds is
`remove` then `define`. An update would have to decide whether renaming into a
taken name is a conflict or a merge, and nothing needs it yet.

**No scoping below the project.** A name means one thing in a project. Sheet- or
document-local names would make resolution depend on where a formula sits, and
the same expression pasted elsewhere would silently mean something else.

## Related

[name manager](../../../../../docs/data-models/data/name-manager.md) — the model
this implements ·
[formula](../formula/overview.md) — the one capability that reads this ·
[storage](../../../../../docs/storage/README.md#there-are-no-unique-indexes) —
why uniqueness is a mutation's job

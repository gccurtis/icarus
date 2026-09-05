# Name manager

The project's named variables. One place where a name means a value, so
[formulas](../content/content-block.md#formula-blocks),
[analyses](analysis.md), and prompts all draw on the same vocabulary.

```ts
interface NameVariable {
  projectId: Id<"projects">;
  nameKey: string;             // lowercased lookup form — unique per project
  name: string;                // authored casing, shown as written
  declaredType: ValueType;
  value: VariableValue;
  definitionOrder: number;
  createdBy: Actor;
  updatedAt: number;
}

type ValueType =
  | "text" | "number" | "logic" | "date" | "null"
  | "list" | "record" | "table" | "function" | "range";
```

## Two forms of the name

`nameKey` is the lookup form — lowercased, whitespace-normalized — and it is
what the uniqueness check and its index are on. `name` is what the author typed, and it is what
gets displayed.

Storing both is what makes `TargetMargin`, `targetmargin`, and `Target Margin`
resolve to the same variable while a person still sees the casing they chose.
Normalizing on read instead would mean every lookup does the transformation and
no index can serve it.

## Uniqueness is a name conflict, checked first

`(projectId, nameKey)` is unique. Convex does not enforce uniqueness at the index
— see [storage](../../storage/README.md#there-are-no-unique-indexes) — so it is
the mutation that checks, protected by Convex's serializable transactions. A
second definition of a name is rejected.

**The conflict is decided before the type and value are validated.** This is
behaviour, not an implementation detail: redefining an existing name reports a
name conflict, rather than whichever schema fault its payload happened to
carry. An author correcting a typo in a value should not be told their value is
malformed when the real problem is that the name is taken.

## `definitionOrder`

A monotonically increasing number per project, used to list variables in the
order they were defined.

Creation time would nearly work and is subtly wrong — two variables defined in
the same millisecond have no order, and a list that reshuffles between reads is
worse than an arbitrary but stable one.

## Every value is a table, degenerately

The [analysis](analysis.md) capability treats every variable as a table, and the
name manager is what makes that possible:

| Declared as | As a table |
| --- | --- |
| `table` | itself |
| `record` | one row, its fields as columns |
| `list` | one column named for the variable, one row per element |
| `scalar` | 1 × 1, one column named for the variable |
| `function` | not usable as an input |
| `range` | not usable as an input until something resolves it |

So `TargetMargin` holding `42` is a one-row, one-column table whose single cell
is 42. This is why an author never has to know whether something was declared as
a list, a record, or a table before putting it on a shelf.

## A range is a reference, and it is stored as one

`range` names cells rather than holding them: `Outages!A1:D400` is what is stored,
and it is stored as written. Nothing here reads the grid it points at.

That is what keeps it a value rather than a live query. The name manager cannot
resolve it — resolving is evaluation, and this capability performs none — so a
caller that wants the cells asks the spreadsheet for them, exactly as a formula
asks this for a bare name. Validation is that the reference parses, and nothing
more: a range naming a sheet that no longer exists is stored, and the caller that
resolves it is the one that reports the failure.

The alternative was storing the resolved cells, which would go stale the moment
the grid changed and would make this the one variable that lies about what a
formula will get.

## It evaluates nothing

The name manager stores values. It does not compute them, and it has no
dependency on formula evaluation at all.

If a variable should hold the result of a computation, **the caller evaluates it
and sends the result.** What arrives is a value, and what is stored is that
value.

Validation is structural only: `declaredType` says what kind of thing this is,
and the payload has to match that shape. Declare `number` and send a function
call and it is rejected — not because the call is wrong, but because it is not a
number. No expression is ever parsed for meaning here, and nothing is resolved.

That is what keeps the two capabilities from depending on each other in a circle.

## Formula depends on this, not the reverse

Formula evaluation resolves a bare name by asking the name manager for it —
anything that is not one of its built-in functions. So formula needs this, and
this needs nothing.

Which means the name manager can be built at any point, including first. The
[build order](../../storage/build-order.md) places it beside formula evaluation
only because that is where it becomes useful, not because it is blocked until
then.

## What is not here

**No calculation graph, and no cached dependency order.** Evaluation stays
stateless: order is derived from the formulas at load, because persisting it
would mean a second representation that can disagree with the first.

The expression itself is not here either — it is a
[formula row](../../stage-0/0-foundation-design.md#formula--ids-and-immutability)
of its own, written in cell ids rather than addresses, and a
[block](../content/content-block.md#formula-blocks) holds a `formulaId` pointing
at it. That is storage for the expression, not for the evaluation; nothing about
it makes the evaluator stateful, and the dependency between the two capabilities
still runs one way — formula asks the name manager to resolve a bare name, and
the name manager evaluates nothing.

**No scoping beyond the project.** A name means one thing in a project. Sheet-
local or document-local names would mean resolution depends on where a formula
sits, and the same expression pasted elsewhere would silently mean something
else.

## Related

[analysis](analysis.md) ·
[content block](../content/content-block.md#formula-blocks) ·
[spreadsheet](../general-resources/spreadsheet.md)

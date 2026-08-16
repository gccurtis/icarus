# Name Manager Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`variable.ts`](variable.ts) | `valueTypeValidator`, `variableValueValidator`, `KIND_OF`, `NameVariable`, `VariableDefinition` |
| [`table.ts`](table.ts) | `asTable` — every variable projected into a table |

## The value union is content's, extended

A stored `42` and a computed `42` are the same value, so
`variableValueValidator` is built from
[`formulaValueValidator`](../../content/types/value.ts) rather than beside it,
adding the three shapes a formula cannot return: `list`, `record`, and
`function`. A second union whose `number` was not a formula's `number` would put
a conversion on every path between the two capabilities and a drift risk under
it.

## Two vocabularies meet in `KIND_OF`

An author declares `logic` and `null`; a value carries content's `boolean` and
`empty`. The mapping is stated once, and it is what makes the structural check a
single comparison rather than a switch.

## `asTable` lives here, not in `formula`

The projection is over a *variable*, and
[name-manager.md](../../../../../docs/data-models/data/name-manager.md#every-value-is-a-table-degenerately)
is where the table it implements is written. Its consumer is the analysis
capability in pass 8, which takes variables as inputs; formula in pass 2 wants
the value itself and never calls it.

A function refuses rather than projecting to an empty table: it is not an input
at all, and a caller that asked for one has a mistake rather than no rows.

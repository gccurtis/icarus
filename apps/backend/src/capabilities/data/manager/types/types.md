# Data Manager Types

`types/` holds the declaration model: the type algebra a caller authors, the
values that algebra admits, and the declaration that pairs them. It holds no row
shapes and no HTTP shapes — Data Manager persists nothing and serves no request,
and if it ever does, those shapes belong in `persistence/` and
`endpoints/*/wire/` rather than here.

Nothing in this directory validates. The types state what a valid declaration
looks like; [`runtime-api/define/`](../runtime-api/define/define.md) decides
whether an authored one is.

## Files

| File | Holds |
| ---- | ----- |
| `dates.ts` | The Gregorian date carrier, in its authored and canonical forms |
| `schema.ts` | The type algebra: scalar kinds, fields, and the four table subtypes |
| `values.ts` | The values that algebra admits, authored and canonical |
| `variables.ts` | A named declaration, and the catalog holding declarations |

The split between an *input* type and a *value* type runs through all four
files. An input is what a caller authors; a value is what Data Manager stores
after admitting it. They differ only where canonicalization adds or fixes
something — today, only `dayName`.

## Public Types

Every type below is re-exported through [`index.ts`](../index.ts).

### `NamedVariableInput` and `NamedVariable`

One declaration: a name, an explicit table shape, and a value of the shape that
type implies. Both are unions over the four table subtypes, so the type of
`value` follows from the `kind` of `type` without a cast.

A caller builds a `NamedVariableInput` and receives a `NamedVariable`. The
difference is that the returned one has been admitted: its name is trimmed, its
schema is validated, and its dates carry a derived `dayName`.

### `ValueType`, `TableType`, `ScalarType`, `Field`

The type algebra. A `Field` has a name and any `ValueType`, including another
table — which is how a table holds a nested table directly, and why admission is
recursive.

`TableType` is the four shapes a top-level variable may declare:
`ScalarTableType` and `ListTableType` carry one `field`; `RecordTableType` and
`GeneralTableType` carry a `fields` array. A variable whose value is a plain
number is a `scalar` whose one field is `{ kind: "number" }` — the scalar kinds
are field types, never variable types.

Scalar and list keep their field definition in storage even though the field
name is transparent in the resolved value:

```text
scalar { field: rate, value: 0.0825 }        -> 0.0825
list   { field: region, value: [n, s] }      -> ["north", "south"]
record { name: "Ada", active: true }         -> the complete record
table  [{ ... }, { ... }]                    -> the complete table
```

### `DataValue`, `DataRecord`, `DataInputValue`, `DataInputRecord`

The recursive value carriers. A value is a number, text, a boolean, a date, a
record, or an ordered list of values. Formula source, function source, and
references are all carried as text; the declared field type is what distinguishes
them, and that distinction is kept at declaration time so no later migration is
needed to recover it.

### `DateInput`, `DateValue`, and the Gregorian pair, `Calendar`

A date is a scalar in the table algebra with a record-shaped value, so callers
get named fields while Data Manager still knows the value is a date. An ordinary
record with `year`, `month`, and `day` fields stays an ordinary record; only a
field declared `{ kind: "date" }` receives date rules.

`GregorianDateInput` may omit `dayName`; `GregorianDateValue` always carries it,
derived rather than trusted. `GregorianDateTimeInput` and
`GregorianDateTimeValue` extend those with the complete time group —
`timeZone`, `hour`, `minute`, `second`, `millisecond` — which is admitted whole
or not at all, so the type stays unambiguous without optional fields.

`calendar` stays in the value as a discriminant even though `Calendar` has one
member. It makes the representation self-describing and is the extension point
for a second calendar: the carrier keeps its fields and the discriminant selects
the rules that validate them.

## Private Types

### `VariableCatalog`, `ReadonlyVariableCatalog`

The declaration map itself: authored declarations keyed by the lower-cased form
of their names, in definition order. `InMemoryDataManager` owns one and passes it
to each [`runtime-api`](../runtime-api/runtime-api.md) entry, which is the whole
reason the type is named.

It stays private because it is the storage decision, not the contract. Only
`define` receives the mutable `VariableCatalog`; the three accessors take
`ReadonlyVariableCatalog`, so a read path that tried to write would not compile.

### `NamedVariableBase`

The shared shape behind the two declaration unions, unexported even within the
capability. Naming it once keeps the eight union members from drifting apart;
exporting it would invite a consumer to build a declaration that satisfies no
member of either union.

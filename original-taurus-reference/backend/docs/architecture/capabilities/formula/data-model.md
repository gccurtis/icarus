# Formula data model

Formula has eight value kinds and one shared notion of shape. Scalars remain
strongly typed scalar payloads; lists, records, and tables use the same
immutable rectangular `Table` carrier. This gives every value a meaningful
`(fields, rows)` shape without pretending that scalar storage is physically a
table.

The source of truth is
[`value.go`](../../../../core/capability/formula/value.go); construction and
copying behavior is exercised by
[`value_test.go`](../../../../core/capability/formula/value_test.go).

## Value kinds and shapes

| Kind | Payload | Shape | Formula construction |
|---|---|---:|---|
| `null` | no payload | `1 × 1` | `null` |
| `number` | exact rational | `1 × 1` | integer, decimal, or exponent literal; arithmetic |
| `text` | UTF-8 string | `1 × 1` | double-quoted text literal |
| `logic` | boolean | `1 × 1` | `true` or `false` |
| `list` | field `value`, N rows | `1 × N` | `[item, ...]` |
| `record` | N ordered fields, one row | `N × 1` | `{field: value, ...}` |
| `table` | N ordered fields, M rows | `N × M` | `TABLE(...)`, a condition query, or a Go binding |
| `function` | parameter names, body, source | `1 × 1` | `FUNCTION(param, ..., body)` or `LAMBDA(...)` |

`Shape` names its dimensions `Fields` and `Rows`. `ROWS` and `COLUMNS` use this
uniform shape for every kind, so `ROWS(42)` and `COLUMNS(42)` are both `1`.
An empty list is `1 × 0`, an empty record is `0 × 1`, and `TABLE()` is `0 × 0`.

Cells may contain any Formula value, including another list, record, or table;
there is no homogeneous-column type rule in this increment.

## The shared table carrier

The internal relation is deliberately small:

```text
Table
├── fields []string       ordered, unique names
├── rows   [][]Value      every row has len(fields) cells
└── index  map[string]int exact field name → column position
```

The three structured kinds are views over that relation:

- a list fixes the sole field name to `value` and puts one item in each row;
- a record has exactly one row and preserves field declaration order;
- a table has arbitrary field and row counts; an evaluator only admits values
  that fit its configured limits.

`NewTable`, `RecordValue`, and `TableValue` reject an empty or invalid-UTF-8
field name, a duplicate field name, or a row whose width differs from the field
count. Field identity is case-sensitive. Records and tables preserve field
order, and tables preserve row order.

Construction copies the caller's field and row slices recursively. `Fields`,
`Rows`, `Field`, `Items`, and the structured accessors also return copies.
Consequently a caller cannot mutate a value by retaining or modifying a slice
or `big.Rat` pointer obtained from the API.

## Literals and construction

List literals evaluate each item in order and produce a one-field list:

```text
[1, "two", {active: true}]
```

Record field names are **identifiers** (an ASCII letter or `_`, then letters,
digits, or `_`) — the same names a dot can spell. A quoted string is not a legal
field name, so a name with a space is rejected at parse time (and, for values built
through the Go API, at construction). Record literals preserve source order and
reject duplicate names:

```text
{name: "Ada", displayScore: 92}
```

There is no dedicated table literal. `TABLE` turns records into a table, either
from variadic record arguments or from one list of records:

```text
TABLE({id: 1, name: "Ada"}, {name: "Bea", id: 2})
TABLE([{id: 1, name: "Ada"}, {id: 2, name: "Bea"}])
```

The first record establishes canonical field order. Later records may declare
those fields in another order, but must contain exactly the same field set.
See [Querying](querying.md#table-construction) for the complete behavior.

## Object-model operations

Formula treats a table as the full rectangular object, a record as one row,
and a list as one ordered column. The operations move between those shapes
without mutating the source:

| Operation | Shape effect |
|---|---|
| `table.field`, `table["field"]`, `table[field]` | table column to list |
| `table[index]` | one table row to record |
| `table[start:end]` | table to a row-sliced table |
| `record.field`, `record["field"]`, `record[field]` | record field to its cell value |
| `list[index]` | one list row to its cell value |
| `list[start:end]` | list to a row-sliced list |
| `record-or-table.{field, ...}` | projection preserving record/table kind |
| `record-or-table.{field op value, ...}` | zero-or-more matching rows as a table |
| `table!` | exactly one row promoted to a record |
| `table?` | zero rows become `null`; one row becomes a record |

Projection preserves row order and explicitly requested field order. A
condition query preserves the complete input schema and matching row order; it
returns a table even when its input is a record. Postfix `!` is the explicit
cardinality assertion for callers that require one record. All structured
results are newly materialized immutable values. The full indexing, slicing,
query, and error rules are in [Querying](querying.md).

Go consumers can construct values with `NullValue`, `NumberValue`, `TextValue`,
`LogicValue`, `ListValue`, `RecordValue`, and `TableValue`, then expose them
through request-scoped `Bindings`. `NumberValue` and `TextValue` return an error:
numbers must fit the default numeric bound and text must be valid UTF-8.

## Exact numbers

Formula source accepts base-10 integers, decimals, and exponent notation. The
parser bounds their decimal magnitude before constructing `math/big.Rat`, then
checks the reduced numerator and denominator against `MaxNumberBits`.
Arithmetic remains rational and no binary float is introduced; an operation
that would exceed the configured magnitude fails with `limit_exceeded` instead
of rounding. Unary signs are operators rather than part of the literal.

Examples of canonical results:

| Input or expression | Canonical number |
|---|---:|
| `1.2500` | `1.25` |
| `1e3` | `1000` |
| `-0` | `0` |
| `0.1 + 0.2` | `0.3` |
| `1 / 8` | `0.125` |
| `1 / 3` | `1/3` |

A reduced rational whose denominator contains only factors of 2 and 5 renders
as a terminating decimal with unnecessary trailing zeroes removed. Every other
rational renders as a reduced fraction. The public `NumberValue` constructor
also accepts exact rational spellings such as `1/3`, subject to the default
`MaxNumberBits`; Formula source obtains the same value with the expression
`1 / 3`.

`%`/`MOD` require integer operands. `^`/`POWER` require an integer exponent.
`ROUND` is exact decimal-place rounding and sends ties away from zero. The
operator and function rules are catalogued in
[Supported formulas](supported-formulas.md).

## Typed equality

`Value.Equal` is strict and deep:

- kinds must match; there is no coercion between text, logic, and number;
- rationals compare by mathematical value, not by source spelling;
- null equals null;
- lists, records, and tables compare field order, row order, and every cell
  recursively.

Infix `=` and `!=`, including those inside dot-curly conditions, use this
equality. Ordering comparisons are a separate number-only rule; an ordering
with `null` is false. See
[Condition queries](querying.md#condition-queries).

## JSON form

`Value` has a typed JSON representation. Every encoding includes `kind` and
`shape`; the encoder writes the payload selected by the kind:

```json
{
  "kind": "record",
  "shape": {"fields": 2, "rows": 1},
  "fields": ["ratio", "active"],
  "rows": [[
    {"kind": "number", "shape": {"fields": 1, "rows": 1}, "number": "1/3"},
    {"kind": "logic", "shape": {"fields": 1, "rows": 1}, "logic": true}
  ]]
}
```

Numbers are JSON strings so a consumer cannot round a repeating rational.
Decoding disallows unknown top-level fields, requires the payload selected by
the kind, rebuilds the rectangular invariant, and rejects a declared shape that
does not match the payload. Lists must have the sole field `value`; records must
have exactly one row. It also rejects a recognized payload field that is not
valid for the selected kind (for example, `number` beside a `null` kind),
invalid UTF-8 input, and trailing JSON after the value object.

This wire form is implemented, but no Formula HTTP endpoint or persistence path
uses it yet.

A `function` value is the exception: it is not serializable. Its encoding is a
display-only descriptor (`kind`, `params`, and `source`) with no body, and
decoding a `kind: function` is rejected — a function is never round-tripped. See
[functions](functions.md).

## What is not a value kind yet

There are no date/time, duration, currency, unit, error, reference,
domain-resource, or lazy/query-plan values. A table is an in-memory value, not a
persisted collection or globally addressable object. Null is a normal scalar
value; it does not imply SQL-style three-valued logic.

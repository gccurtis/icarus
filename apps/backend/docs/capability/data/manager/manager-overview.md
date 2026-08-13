# Data Manager Overview

## Description

Data Manager owns the backend's catalog of named variables.

It stores a variable's name, structural type, schema, and authored value so
that other capabilities can retrieve named data without owning a second name
catalog. Formula will eventually consume this catalog, but Formula parsing,
evaluation, and binding are outside Data Manager.

Tables are the general data shape. Scalars, lists, and records are explicit
table subtypes:

| Shape | Fields | Instances | Resolved value |
| ----- | ------ | --------- | -------------- |
| scalar | exactly one | exactly one | the field value |
| list | exactly one | zero or more | an ordered list of field values |
| record | zero or more | exactly one | the complete record |
| table | zero or more | zero or more | the complete table |

The shape is explicit rather than inferred. A scalar and a one-element list
both have one field and one instance, so cardinality alone cannot preserve the
author's intent.

## Status

The first Data Manager increment is implemented and composed into the backend
runtime. It keeps declarations in memory, so they are lost when that runtime
closes.

The implementation stores and retrieves declarations. It does not evaluate
formulas, validate lambda syntax, follow references, expose HTTP endpoints, or
maintain revision history.

The older documents under
[`src/capabilities/data/manager/docs`](../../../../src/capabilities/data/manager/docs/README.md)
describe a previous Structured Data build. They are inspirational material and
are not the contract for this capability.

## File Tree

- `data/manager/`
  - [`index.ts`](../../../../src/capabilities/data/manager/index.ts) — public exports
  - [`types.ts`](../../../../src/capabilities/data/manager/types.ts) — recursive schemas, values, dates, and declarations
  - [`errors.ts`](../../../../src/capabilities/data/manager/errors.ts) — stable domain error codes
  - [`manager.ts`](../../../../src/capabilities/data/manager/manager.ts) — runtime API, validation, and in-memory implementation
  - `runtime-constructors/`
    - [`manager.ts`](../../../../src/capabilities/data/manager/runtime-constructors/manager.ts) — runtime constructor
- [`main.ts`](../../../../src/main.ts) — constructs one Data Manager per backend runtime
- [`data-manager.test.ts`](../../../../test/data-manager.test.ts) — current capability behavior

## Dependency Ports

Data Manager has no direct capability dependencies.

Formula is a future consumer, not a dependency of Data Manager. Data Manager
exposes stored declarations; a separate composition boundary will translate
them into Formula values and perform evaluation.

## Runtime Objects

One `DataManager` is constructed per `buildRuntime()` call. Its implementation
owns an in-memory declaration map. It does not receive the database, web server,
registry, configuration, or observability runtime.

| Object | Description | File |
| ------ | ----------- | ---- |
| `DataManager` | Owns the runtime's unique named-variable catalog and enforces its structural invariants. | [`manager.ts`](../../../../src/capabilities/data/manager/manager.ts) |

## Public API

The first increment has an in-process API only.

| API | Kind | Owner / Transport | Description | File |
| --- | ---- | ----------------- | ----------- | ---- |
| `define(variable)` | runtime method | `DataManager` | Adds one validated named declaration. | [`manager.ts`](../../../../src/capabilities/data/manager/manager.ts) |
| `get(name)` | runtime method | `DataManager` | Retrieves a declaration when the name exists. | [`manager.ts`](../../../../src/capabilities/data/manager/manager.ts) |
| `require(name)` | runtime method | `DataManager` | Retrieves a declaration or raises a not-found error. | [`manager.ts`](../../../../src/capabilities/data/manager/manager.ts) |
| `list()` | runtime method | `DataManager` | Returns all current declarations in definition order. | [`manager.ts`](../../../../src/capabilities/data/manager/manager.ts) |

Retrieval returns the complete stored declaration. It does not return the
Formula-facing resolved value. This distinction preserves field names, schemas,
formula source, and reference source without loss.

## Ownership Boundary

Data Manager owns:

- the unique catalog of variable names;
- the declared scalar, list, record, and table shapes;
- field definitions and recursively nested schemas;
- authored literal, Formula, function, and reference values;
- structural validation between schemas and stored values;
- the rules for turning each table subtype into its resolved value shape.
- Gregorian date validation and canonicalization;

Data Manager does not own:

- Formula grammar, parsing, evaluation, diagnostics, or dependency tracking;
- proving that function source is a lambda;
- following references or detecting reference cycles in the first increment;
- HTTP request and response types;
- authorization or resource scope;
- display formatting;
- calendars other than Gregorian.

## Runtime Object Details

### Runtime Object: `DataManager`

`DataManager` is the sole authority for named variable declarations within one
backend runtime. Other capabilities use it through its public methods rather
than reading its internal storage directly.

The runtime validates and copies data at its boundary so a caller cannot mutate
a stored table by retaining an input or output object reference.

#### Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `variables` | `Map<string, NamedVariable>` | Stores declarations by their normalized names in definition order. |

#### Constructor Parameters

The constructor has no parameters. An eventual storage adapter can be
introduced without changing the variable algebra.

#### Construction Steps

```text
createDataManager()
  1. Construct one InMemoryDataManager with an empty name catalog.
  2. Return it through the DataManager interface.
```

## API Details

### API: `define`

`define` adds one declaration to the catalog. It stores Formula and function
source as authored strings and stores references as authored variable names.
It does not interpret any of those strings.

#### API Classification

- **Kind:** runtime method
- **Owner:** `DataManager`
- **Execution:** mutator
- **Transaction:** none

#### Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `variable` | `NamedVariableInput` | Complete name, structural type, schema, and value to store. Date input may omit `dayName`. |

#### Output

`NamedVariable`

Returns the canonical `NamedVariable`. A duplicate normalized name or an
invalid type/value shape raises a `DataManagerError` and leaves the catalog
unchanged.

#### Effects

- Adds one declaration to the current name catalog.
- Does not evaluate Formula or function source.
- Does not read or copy the target of a reference.

#### Procedure Tree

```text
define(variable)
  1. Validate and normalize the variable name.
  2. Verify that its normalized name is not already present.
  3. Validate its structural type recursively.
  4. Validate every value against its field type and cardinality.
  5. Copy the declaration into controlled storage.
  6. Return a safe copy of the stored declaration.
```

### API: `get`

`get` performs a name lookup without interpreting the stored value.

#### API Classification

- **Kind:** runtime method
- **Owner:** `DataManager`
- **Execution:** accessor
- **Transaction:** none

#### Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `name` | `string` | Variable name to retrieve. |

#### Output

`NamedVariable | undefined`

Returns a safe copy of the complete declaration, or `undefined` when the name
does not exist.

#### Effects

- None.

#### Procedure Tree

```text
get(name)
  1. Normalize the lookup name.
  2. Read the matching declaration.
  || no declaration exists
     2.a.1. Return undefined.
  3. Return a safe copy of the declaration.
```

### API: `require`

`require` is the strict retrieval form for consumers that cannot continue
without the named declaration.

#### API Classification

- **Kind:** runtime method
- **Owner:** `DataManager`
- **Execution:** accessor
- **Transaction:** none

#### Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `name` | `string` | Required variable name. |

#### Output

`NamedVariable`

Returns a safe copy of the complete declaration. A missing name raises a
`variable-not-found` error.

#### Effects

- None.

#### Procedure Tree

```text
require(name)
  1. Call get(name).
  || the result is undefined
     1.a.1. Raise variable-not-found.
  2. Return the declaration.
```

### API: `list`

`list` exposes the current declarations for capability consumers that need a
complete name view.

#### API Classification

- **Kind:** runtime method
- **Owner:** `DataManager`
- **Execution:** accessor
- **Transaction:** none

#### Inputs

None.

#### Output

`readonly NamedVariable[]`

Returns safe copies of all current declarations in definition order.

#### Effects

- None.

#### Procedure Tree

```text
list()
  1. Read every current declaration.
  2. Copy each declaration for the caller.
  3. Return the declarations.
```

## Value and Shape Model

### Scalar field types

```ts
export type ScalarType =
  | { readonly kind: "number" }
  | { readonly kind: "text" }
  | { readonly kind: "logic" }
  | { readonly kind: "date" }
  | { readonly kind: "formula" }
  | { readonly kind: "function" }
  | { readonly kind: "reference" };
```

- `number` stores a finite number.
- `text` stores a string.
- `logic` stores `true` or `false`.
- `date` stores a manager-validated Gregorian date object, optionally with
  time and time-zone fields.
- `formula` stores unparsed Formula source as a string.
- `function` stores an unparsed lambda Formula as a string.
- `reference` stores the name of another variable as a string.

Scalar means that the value occupies one field in one table instance. It does
not require the JavaScript value to be a primitive. A date is scalar in the
table algebra while deliberately using an intuitive record-shaped value.

Formula and function are separate types even though their initial storage is
identical. Their intended resolved behavior differs, and keeping the distinction
at declaration time avoids a later data migration.

A reference may name a variable that does not yet exist. This permits forward
references. Reference resolution, target-type checking, missing-target errors,
and cycle detection belong to the later Formula integration increment.

### Recursive field type

```ts
export interface Field {
  readonly name: string;
  readonly type: ValueType;
}

export type ValueType = ScalarType | TableType;
```

A field may contain any value type, including another scalar, list, record, or
table. This is how a table contains a nested table directly. A reference can be
used instead when repeating a large nested value would waste storage.

### Table subtypes

```ts
export type TableType =
  | {
      readonly kind: "scalar";
      readonly field: Field;
    }
  | {
      readonly kind: "list";
      readonly field: Field;
    }
  | {
      readonly kind: "record";
      readonly fields: readonly Field[];
    }
  | {
      readonly kind: "table";
      readonly fields: readonly Field[];
    };
```

Scalar and list retain their field definitions in storage. The field name is
schema information, but it is transparent in the resolved value:

```text
scalar { field: amount, instance: { amount: 42 } }
  -> 42

list { field: region, instances: [{ region: "north" }, { region: "south" }] }
  -> ["north", "south"]
```

Record and table resolution preserves their fields:

```text
record { name: "Ada", active: true }
  -> { name: "Ada", active: true }

table [{ name: "Ada", active: true }, { name: "Grace", active: false }]
  -> the complete table
```

This supports intuitive field operations later:

```text
customer.name
customers.name
customers[1].name
regions[1]
```

### Named variable

The input and canonical output are discriminated by their explicit table
shape:

```ts
export type NamedVariableInput =
  | NamedVariableBase<ScalarTableType, DataInputValue>
  | NamedVariableBase<ListTableType, readonly DataInputValue[]>
  | NamedVariableBase<RecordTableType, DataInputRecord>
  | NamedVariableBase<GeneralTableType, readonly DataInputRecord[]>;

export type NamedVariable =
  | NamedVariableBase<ScalarTableType, DataValue>
  | NamedVariableBase<ListTableType, readonly DataValue[]>
  | NamedVariableBase<RecordTableType, DataRecord>
  | NamedVariableBase<GeneralTableType, readonly DataRecord[]>;
```

Every top-level named variable has an explicit table subtype. A variable whose
authored type is number, text, logic, date, formula, function, or reference is a
`scalar` whose one field has that scalar type.

Variables and fields use trimmed ASCII identifiers matching
`[A-Za-z_][A-Za-z0-9_]*`. Variable lookup and conflicts are case-insensitive;
the manager retains authored casing. Fields retain their exact spelling, while
duplicate schema-field detection is case-insensitive. Record and table values
must use those exact retained field keys.

## Gregorian Dates

Date is a first-class `date` scalar type whose input and output value is shaped
like a record. Callers therefore receive intuitive named fields, but the
manager still knows that the value is a date and applies date-specific rules.

An ordinary record with fields named `year`, `month`, and `day` remains an
ordinary record. Only a field declared with `{ kind: "date" }` receives date
validation and canonicalization.

Only the Gregorian calendar is supported in the current design. The value still
includes an explicit string discriminant:

```ts
export type Calendar = "gregorian";
```

Keeping `calendar` in the value makes the representation self-describing and
provides the extension point for another calendar system. The shared carrier
can continue to use `year`, `month`, `day`, and time fields; the calendar
discriminant selects the rules used to validate those fields and derive values
such as `dayName`.

### Date-only value

```ts
export interface GregorianDateInput {
  readonly calendar: "gregorian";
  readonly dayName?: string;
  readonly day: number;
  readonly month: number;
  readonly year: number;
}
```

Example:

```ts
{
  calendar: "gregorian",
  dayName: "Wednesday",
  day: 12,
  month: 8,
  year: 2026
}
```

### Date-and-time value

```ts
export interface GregorianDateTimeInput extends GregorianDateInput {
  readonly timeZone: string;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}
```

Example:

```ts
{
  calendar: "gregorian",
  dayName: "Wednesday",
  day: 12,
  month: 8,
  year: 2026,
  timeZone: "America/Chicago",
  hour: 9,
  minute: 30,
  second: 0,
  millisecond: 0
}
```

Canonical output always contains the derived `dayName`:

```ts
export interface GregorianDateValue {
  readonly calendar: "gregorian";
  readonly dayName: string;
  readonly day: number;
  readonly month: number;
  readonly year: number;
}

export interface GregorianDateTimeValue extends GregorianDateValue {
  readonly timeZone: string;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

export type DateValue = GregorianDateValue | GregorianDateTimeValue;
```

When time is present, the complete time group is received, stored, and
returned. This keeps the type unambiguous without introducing optional fields
into the general table model.

`timeZone` uses an IANA zone name such as `America/Chicago`, preserving the
rules needed to understand local clock time.

For every `date` value, Data Manager:

- requires integer `year`, `month`, and `day` fields;
- requires the supported `calendar` value `"gregorian"`;
- requires years from 1 through 9999;
- verifies that they identify a real date in the Gregorian calendar;
- derives and returns the canonical `dayName` rather than trusting a conflicting
  authored value;
- requires the time fields to occur as one valid date-and-time group;
- validates `hour` from 0 through 23, `minute` and `second` from 0 through 59,
  and `millisecond` from 0 through 999;
- validates `timeZone` as an IANA time-zone name;
- returns the same record-shaped representation after canonicalization.

The first increment uses full English Gregorian weekday names such as
`Wednesday` for `dayName`. Localized display names are presentation concerns
and can be derived by consumers.

## Resolved Value Projection

Stored declarations and resolved values are deliberately different views.

```text
stored declaration
  -> retain name, explicit shape, field names, schema, and authored value

resolved value
  || scalar
     -> return its one field value
  || list
     -> return its ordered field values
  || record
     -> return the complete record
  || table
     -> return the complete table
```

Data Manager retrieval returns the stored declaration with the ergonomic value
shape shown above and the complete schema beside it. A later Formula adapter
will own formula/function evaluation and reference traversal.

## Capability Invariants

- One normalized name identifies at most one current variable.
- Variable and field names are trimmed ASCII identifiers.
- Authored name casing is retained even when lookup normalization is used.
- Every named variable explicitly declares scalar, list, record, or table
  intent; shape is never guessed from current cardinality.
- A scalar has exactly one field and one instance.
- A list has exactly one field and preserves instance order.
- A record has exactly one instance and preserves all declared fields.
- A table preserves its declared fields and all instances.
- Every record or table instance conforms exactly to its schema.
- A nested structural value conforms recursively to its field's declared type.
- Formula and function values remain source strings until Formula integration.
- A reference remains a target-name string until reference resolution.
- Stored input and returned declarations do not share mutable object references
  with callers.
- `list()` preserves definition order.
- Declarations exist only for the lifetime of their Data Manager runtime.
- Gregorian dates are first-class scalar values with record-shaped input and
  output.
- Data Manager validates Gregorian calendar rules and returns canonical
  `dayName` values.
- A date-and-time value contains the complete canonical time group and an IANA
  time zone.
- Failed validation does not partially add a declaration.

## Errors

All expected domain failures use `DataManagerError` with one stable code:

```ts
export type DataManagerErrorCode =
  | "invalid-name"
  | "name-conflict"
  | "invalid-type"
  | "invalid-schema"
  | "invalid-value"
  | "variable-not-found";
```

`invalid-schema` identifies field-set and recursive-schema failures;
`invalid-value` identifies values that do not satisfy an otherwise valid type.

## Initial Non-goals

- Formula or lambda parsing and evaluation.
- Reference traversal, target validation, and cycle detection.
- Updating, renaming, or deleting declarations.
- Revisions, history, tombstones, or compare-and-swap behavior.
- HTTP endpoints and wire decoders.
- Persistent storage or recovery across backend restarts.
- Context metadata, descriptions, search, or authorization.
- Lunar or other non-Gregorian calendars.
- General nullable or optional table fields.
- Automatic schema inference or conversion.

## Deferred Decisions

- Maximum name, source, field, row, and nesting limits.

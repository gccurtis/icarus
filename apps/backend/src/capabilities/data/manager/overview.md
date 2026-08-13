# Data Manager Overview

Data Manager owns the backend's catalog of named variables.

It stores a variable's name, structural type, schema, and authored value so that
other capabilities can retrieve named data without keeping a second name
catalog. Formula will consume this catalog; Formula parsing, evaluation, and
binding stay outside Data Manager.

Tables are the general data shape. Scalars, lists, and records are explicit
table subtypes, declared rather than inferred — a scalar and a one-element list
both have one field and one instance, so cardinality alone cannot preserve the
author's intent.

| Shape | Fields | Instances | Resolved value |
| ----- | ------ | --------- | -------------- |
| scalar | exactly one | exactly one | the field value |
| list | exactly one | zero or more | an ordered list of field values |
| record | zero or more | exactly one | the complete record |
| table | zero or more | zero or more | the complete table |

Declarations live in memory for the lifetime of one backend runtime. There is no
persistence, no HTTP surface, and no revision history yet.

## Boundary

Data Manager owns:

- the unique catalog of variable names, and the rules that make two authored
  names the same name;
- declared scalar, list, record, and table shapes, including recursively nested
  field schemas;
- authored literal, Formula, function, and reference values, held as authored
  text where they are source;
- structural validation between a schema and the value stored against it;
- Gregorian date validation and canonicalization.

Consumers own:

- Formula grammar, parsing, evaluation, diagnostics, and dependency tracking;
- proving that function source is a lambda;
- following references and detecting reference cycles;
- authorization, resource scope, and display formatting;
- the projection from a stored declaration to a resolved value — retrieval
  returns the complete declaration, schema included, not the resolved value.

## File Tree

```text
manager/
├── overview.md
├── index.ts
├── errors.ts
├── types/
├── runtime-objects/
├── runtime-api/
└── test/
```

The capability persists nothing and registers no endpoint, so `persistence/` and
`endpoints/` are absent. Nothing belongs to no single directory, so `docs/` is
absent too; the archived Structured Data documents that once sat there now live
under
[`docs/reference/capabilities/data/manager/`](../../../../docs/reference/capabilities/data/manager/README.md)
and describe a previous build, not this one.

## Dependency Ports

None. Data Manager depends on no other capability and receives no platform
object — not the database, web server, registry, configuration, or observability
runtime. Formula is a future consumer, not a dependency.

## Runtime Objects

One instance per backend runtime, constructed by
[`main.ts`](../../../main.ts) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `DataManager` | yes | Owns the runtime's unique named-variable catalog and enforces its structural invariants. | [manager.md](runtime-objects/manager/manager.md) |

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `define` | runtime method | `DataManager` | Adds one validated declaration to the catalog. | [define.md](runtime-api/define/define.md) |
| `get` | runtime method | `DataManager` | Retrieves a declaration when the name exists. | [get.md](runtime-api/get/get.md) |
| `require` | runtime method | `DataManager` | Retrieves a declaration or fails. | [require.md](runtime-api/require/require.md) |
| `list` | runtime method | `DataManager` | Returns every current declaration. | [list.md](runtime-api/list/list.md) |

## Capability Invariants

- One normalized name identifies at most one current variable, and authored
  casing survives lookup normalization.
- Variable and field names are trimmed ASCII identifiers matching
  `[A-Za-z_][A-Za-z0-9_]*`.
- Every named variable explicitly declares scalar, list, record, or table
  intent; shape is never guessed from current cardinality.
- Every record or table instance conforms exactly to its schema — no missing
  field, no unknown field — and nested values conform recursively.
- Formula and function values remain source strings, and a reference remains a
  target-name string, until a later increment interprets them. A reference may
  name a variable that does not exist yet.
- Stored and returned declarations share no mutable object reference with a
  caller, in either direction.
- `list()` preserves definition order.
- A failed validation adds nothing: the catalog is unchanged.
- Declarations exist only for the lifetime of their Data Manager runtime.

## Errors

Every expected failure is a `DataManagerError` from
[`errors.ts`](errors.ts) carrying one stable code: `invalid-name`,
`name-conflict`, `invalid-type`, `invalid-schema`, `invalid-value`, or
`variable-not-found`. `invalid-schema` marks field-set and recursive-schema
faults; `invalid-value` marks a value that fails an otherwise valid type.

## Non-Goals

Formula or lambda parsing and evaluation; reference traversal and cycle
detection; updating, renaming, or deleting declarations; revisions and
compare-and-swap; HTTP endpoints; persistent storage; context metadata, search,
or authorization; non-Gregorian calendars; optional table fields; schema
inference. Name, source, field, row, and nesting limits are deferred, not
decided.

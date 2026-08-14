# API: `define`

`define` adds one declaration to the bound project's persistent catalog. It is
the only way a declaration gets there, and the only method that validates
anything — which is why the admission tree lives in this directory rather than
in `shared/`.

It stores Formula and function source as authored text and a reference as an
authored variable name. It interprets none of them: a reference may name a
variable that does not exist, and a function may hold text that is not a lambda.

## Classification

- **Owner:** `NameManager`
- **Execution:** mutator
- **Transaction:** none
- **Entry:** [`define.ts`](define.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `store` | `NameManagerStore` | Project-bound persistence port used for the conflict read and atomic insert |
| `variable` | `NamedVariableInput` | Complete name, table shape, schema, and value. A date value may omit `dayName` |

## Output

`Promise<NamedVariable>`

The canonical declaration, copied. Its name is trimmed, its schema is admitted,
and every date carries a derived `dayName`.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `invalid-name` | The variable name, a field name, or a reference value is not a trimmed ASCII identifier |
| `name-conflict` | The project already holds a declaration under that name, ignoring case, including one inserted concurrently |
| `invalid-type` | A declared kind is unsupported, or a top-level variable declares a bare scalar kind instead of a table shape |
| `invalid-schema` | A field set is malformed, a schema is cyclic, field names collide, or a record value has a missing or unknown field |
| `invalid-value` | A value does not satisfy an otherwise valid type — including every date fault |

Every expected failure from this call leaves no partial declaration. The write
is a single-row insert and is the last step.

## Effects

- Adds one canonical declaration to the project's database catalog.
- Evaluates no Formula or function source, and reads nothing at a reference's
  target.

## Procedure Tree

```text
define(store, variable)
  1. Reject a non-object declaration.
  2. Canonicalize the authored name.
  3. Derive its lookup key.
     || the store already holds that key
        3.a.1. Fail with name-conflict.
  4. Admit the declaration — canonical-variable.ts
     4.1. Canonicalize the name again, for the value paths in its messages.
     4.2. Admit the declared type recursively — canonical-type.ts
     4.3. Reject a top-level type that is not scalar, list, record, or table.
     4.4. Admit the value against that type — canonical-value.ts
  5. Ask the store to create the declaration under its key.
     || another writer already created that key
        5.a.1. Fail with name-conflict.
  6. Return a copy of the admitted declaration.
```

Step 3 before step 4 is deliberate: a caller redefining a name learns that the
name is taken, not that the payload it happened to send is also wrong.
Step 5 repeats the conflict decision through the database primary key, closing
the race between the read and insert without weakening that precedence.

## Supporting Procedures

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `canonicalVariable` | Turns one authored declaration into its canonical form, or fails | [canonical-variable.ts](canonical-variable.ts) |
| `canonicalType` | Admits a declared type, descending into fields and rejecting schema cycles | [canonical-type.ts](canonical-type.ts) |
| `canonicalValue` | Admits a value against its declared type, descending into nested records, lists, and tables | [canonical-value.ts](canonical-value.ts) |
| `canonicalDate` | Admits a Gregorian date and derives its `dayName` | [canonical-date.ts](canonical-date.ts) |
| `isRecord`, `invalidValue` | The two guards the tree above is written in terms of | [value-guards.ts](value-guards.ts) |

### Recursion and cycles

`canonicalType` and `canonicalValue` both carry an `ancestors` set of the input
objects currently open on their branch. An authored object that appears inside
itself is rejected — `invalid-schema` for a type, `invalid-value` for a value —
rather than recursing until the stack ends. The check is on object identity, so
a schema repeated as a sibling is fine; only a schema containing itself is not.

### Dates

A date is the one scalar kind with a structured value, and the only one whose
canonical form differs from what was authored:

- `year`, `month`, and `day` must be integers, the year from 1 through 9999, and
  together they must be a real Gregorian date — February 29th is admitted only
  in a leap year.
- `dayName` is derived. An authored one is accepted as text and then discarded,
  so a declaration cannot claim a weekday its date does not have.
- Time is admitted as the complete group or not at all. A partial time fails
  naming the first missing field, rather than being stored half-present.
- `timeZone` must be an IANA name, and is stored in the form `Intl` resolves it
  to.
- Any key outside the date and time field sets fails.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `canonicalName` | The name it stores must be the same name `get` and `require` will look up, and field names and references obey the same rule |
| `nameKey` | The conflict check must use the same key the accessors read by, or a name could be defined twice |
| `copyVariable` | The returned declaration must not be a handle on the stored one |

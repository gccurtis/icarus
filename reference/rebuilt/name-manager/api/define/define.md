# API: `define`

Adds one declaration to the project's catalog: a name, the structural shape it
is declared as, and the value it holds.

There is no update form. A declaration states what a name means, and changing it
under readers who have already resolved it is a different operation with
different consequences — one this capability does not offer yet, rather than one
it offers by accident.

## Classification

- **Effect:** mutator
- **Transaction:** none — one insert is already atomic, and the conflict clause
  is what makes two concurrent definitions resolve to one winner
- **Entry:** [`define.ts`](define.ts)
- **Browser-reachable:** yes, via [`define.remote.ts`](define.remote.ts)

## Signature

```ts
export const define = async (
  scope: Scope,
  input: NamedVariableInput
): Promise<NamedVariable>;
```

`scope` is derived server-side. `NamedVariableInput` carries no `projectId` or
`userId` — a client cannot name its own authority, and the project it writes
into is the database `scope` opened.

## The conflict is decided first

**Before the type and value are admitted.** That ordering is behavior, and it is
the one thing in this function most easily lost in a rewrite.

Someone re-running a definition they already made gets `name-conflict`, which is
the true reason, rather than whichever schema fault their payload happens to
carry — a message sending them to fix a type that was never the problem.

## Admission

`define.remote.ts` is declared `'unchecked'`, so this function is the only thing
between a hostile payload and the database.

| Rejected | By |
| --- | --- |
| a name that is not a trimmed ASCII identifier | [`canonicalName`](../shared/canonical-name.ts) |
| a name already taken, in any casing | [`findVariable`](../shared/find-variable.ts) and the insert's conflict clause |
| a bare scalar kind at the top level | [`canonicalVariable`](canonical-variable.ts) |
| an unknown kind, or a type that contains itself | [`canonicalType`](canonical-type.ts) |
| two fields whose names differ only in casing | same |
| a value that does not conform to its declared type | [`canonicalValue`](canonical-value.ts) |
| a record missing a field, or carrying an unknown one | same |
| a value that refers to itself | same |
| an impossible date, or a partial time | [`canonicalDate`](canonical-date.ts) |
| a weekday that disagrees with the date | same — `dayName` is derived, not trusted |

A top-level bare scalar is refused rather than wrapped because wrapping would be
a guess about intent: a scalar and a one-element list are different declarations,
and only the author knows which was meant.

## Output

`NamedVariable` — the declaration as stored, with the authored casing preserved
and every date's `dayName` as recomputed.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-name` | the name is not a string, or not an ASCII identifier |
| `name-conflict` | a variable with that lookup key already exists |
| `invalid-type` | the declared kind is unknown, or is not a table shape at the top level |
| `invalid-schema` | the declaration is structurally impossible — a cycle, a duplicate field, a record with a missing or unknown field |
| `invalid-value` | the value does not conform to a declaration that was otherwise fine |

All are decisions this capability states with a code, and `record` logs them at
`warn`. Anything else reaching the caller is a fault and is logged at `error`.

## Effects

- Inserts one row into `name_manager_variables`, or none if the name was taken.
- `definition_order` is assigned by the database and becomes this variable's
  position in [`list`](../list/list.md).

## Procedure Tree

```text
define(scope, input)
├── record("define", { name })          ../shared/record.ts
├── isRecord(input)                     value-guards.ts
├── canonicalName(input.name)           ../shared/canonical-name.ts
├── nameKey(name)                       ../shared/canonical-name.ts
├── projectDatabase(scope.projectId)    $model/server/index.server
├── findVariable(database, key)         ../shared/find-variable.ts
│   └── reject name-conflict before admitting type or value
├── canonicalVariable(input)            canonical-variable.ts
│   ├── canonicalType(input.type)       canonical-type.ts
│   │   └── canonicalName(field.name)   ../shared/canonical-name.ts
│   └── canonicalValue(type, value)     canonical-value.ts
│       ├── invalidValue()              value-guards.ts
│       └── canonicalDate(value)        canonical-date.ts
├── storedNamedVariable(variable)       ../../persistence/stored-types.ts
├── insert into name_manager_variables … on conflict (name_key) do nothing
└── copyVariable(variable)              copy-variable.ts
```

## Supporting Procedures

| Procedure | Responsibility | File |
| --- | --- | --- |
| `canonicalVariable` | admits one whole declaration, and refuses a top-level bare scalar | [canonical-variable.ts](canonical-variable.ts) |
| `canonicalType` | admits a declared type recursively, carrying ancestors to catch a cycle | [canonical-type.ts](canonical-type.ts) |
| `canonicalValue` | admits a value against its declared type, descending through fields | [canonical-value.ts](canonical-value.ts) |
| `canonicalDate` | admits a Gregorian date, derives `dayName`, refuses a partial time | [canonical-date.ts](canonical-date.ts) |
| `copyVariable` | severs every reference between what is returned and the caller's input | [copy-variable.ts](copy-variable.ts) |
| `isRecord` / `invalidValue` | the two shapes every admission step needs | [value-guards.ts](value-guards.ts) |

They live here rather than in `shared/` because **only `define` writes.** The
other three read declarations that were admitted once already.

`copyVariable` is here for the same reason and one more: every other function
returns a value that came out of the database, where
`currentNamedVariable` already copies. `define` returns a value it built from the
caller's own input, which still shares structure with it.

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `canonicalName` / `nameKey` | the writer and the readers must agree on what one name is, or `define` would admit a name `get` could never find |
| `findVariable` | the conflict check must find a name the same way `get` does |
| `record` | a browser-reachable mutation that leaves no trace is the one most worth having a record of |

## Concurrency

Two simultaneous definitions of the same name both pass the `findVariable`
check. The insert's `on conflict (name_key) do nothing` with a `returning` is
what decides between them: the loser gets no row back and reports
`name-conflict`, exactly as the sequential case does.

# Types

Five files. Four describe the catalog's model, and the fifth describes what a
browser is allowed to send.

| File | Holds | Seen by |
| --- | --- | --- |
| [`schema.ts`](schema.ts) | `ScalarType`, `Field`, the four table types, `ValueType` | procedures, and any server caller |
| [`values.ts`](values.ts) | `DataValue`, `DataRecord`, and their input counterparts | as above |
| [`dates.ts`](dates.ts) | `Calendar`, the Gregorian date and date-time shapes | as above |
| [`variables.ts`](variables.ts) | `NamedVariable`, `NamedVariableInput` | as above |
| [`requests.ts`](requests.ts) | `DefineRequest`, `GetRequest`, `RequireRequest`, `ListRequest` | the browser, through the remote wrappers |

## Declared, not inferred

A variable's shape is stated by its author and never guessed from its value. The
reason is that cardinality cannot recover intent: a scalar and a one-element list
both have one field and one instance, so a catalog that inferred would silently
collapse a distinction someone chose to make.

That is why `NamedVariableInput` requires a *table* type at the top level. A bare
`{ kind: "number" }` is a scalar **type**, not a table shape, and `define` rejects
it rather than promoting it to a guess.

## Input and value are two families, not one

`DataInputValue` and `DataValue` describe the same data on either side of
admission, and `NamedVariableInput` and `NamedVariable` pair them with the same
table types.

They differ in exactly one place — `dayName` is optional on a `DateInput` and
mandatory on a `DateValue` — because it is **derived, never trusted**. Admission
recomputes the weekday from the year, month, and day rather than believing what
arrived, so a stored date cannot claim a weekday it does not have.

Writing two families rather than one generic one costs some repetition and buys
the guarantee that an un-admitted `DateInput` cannot reach a position promising a
`DateValue`.

## The one field between a request and an input

A request carries a **project token**; a procedure input does not.

A client instance must name which project it is talking about, because a remote
function cannot see the page that called it — kit serves them all from
`/_app/remote/…` with empty route params. But the token is a *reference*, not
authority: it is resolved within the asking user's own handles, and one that is
not there resolves to no project at all.

By the time a procedure runs the token is gone and a `Scope` has taken its place.
Writing that as two types rather than one optional field means the distinction
cannot be lost by someone adding a field to the wrong interface.

**Neither type names a user.** That comes only from the session cookie.

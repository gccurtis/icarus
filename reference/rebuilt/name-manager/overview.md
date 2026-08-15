# Name Manager

One project's persistent catalog of **named variables**: a name, the structural
type it is declared as, and the value it holds.

It is the Excel sense of the phrase — a place where a project states that
`TaxRate` means `0.2` and everything else refers to it by name — not a generator
of names. Its intended consumer is Formula, which resolves a reference by asking
this capability what the name means.

| | |
| --- | --- |
| Alias | `$name-manager` |
| Server door | [`index.server.ts`](index.server.ts) |
| Browser door | [`index.ts`](index.ts) |
| Table | `name_manager_variables` |
| Functions | [`define`](api/define/define.md), [`get`](api/get/get.md), [`require`](api/require/require.md), [`list`](api/list/list.md) |

## Declared, not inferred

Tables are the general data shape, and scalars, lists, and records are explicit
subtypes of it.

| Shape | Fields | Instances |
| --- | --- | --- |
| scalar | exactly one | exactly one |
| list | exactly one | zero or more |
| record | zero or more | exactly one |
| table | zero or more | zero or more |

They are declared rather than inferred because cardinality alone cannot preserve
intent: **a scalar and a one-element list both have one field and one instance.**
A catalog that guessed would collapse a distinction the author chose to make, and
would do it silently. So `define` refuses a top-level bare scalar kind rather
than wrapping it in a guess.

## What it holds, and what it does not

It stores formula and function values as **authored source text**. This is a
catalog, not an evaluator — parsing here would make it one, and would tie the
catalog's release cycle to the formula language's.

A `reference` value is the exception: it names another variable, so it is
admitted as a name and refused if it could never refer to anything.

## Two things that are behavior, not implementation

**The name conflict is decided before the type and value are admitted.** Someone
redefining a name is told `name-conflict`, not whichever schema fault their
payload happened to carry. Its test moves with it.

**`dayName` is derived, never trusted.** Admission recomputes the weekday from
the year, month, and day rather than believing what arrived, so a stored date
cannot claim a weekday it does not have.

## Browser reachability and admission

**Every function here has a `.remote.ts` and is directly reachable by a browser.**
The audit list is `api/*/*.remote.ts`, and it is all four.

A remote call is not unscoped: each wrapper resolves the project token it was
sent *within the asking session's user*, and one that does not resolve is a 404.
Below that line the token no longer exists and the procedure has a `Scope` it
cannot have been talked out of. Authentication and membership checking land on
`resolveScope` and change nothing here.

What each function does own is **validating what it receives**, because remotes
are declared `'unchecked'`. The admission tree under
[`api/define/`](api/define/define.md) is that obligation discharged: the name,
the declared type, the value against that type, and every date within it.

## What `record` never writes

Names, shapes, and counts only — **never an authored value, and never a field
name from inside one.** The catalog holds whatever someone put in it, and a log
is copied, shipped, and retained far longer than the row it describes.

## Project isolation

Structural. A project is its own database, so no query carries a `project_id`
predicate and the table has no such column. See
[`persistence/persistence.md`](persistence/persistence.md).

## Translated from the backend

This capability was a Fastify-era runtime object — a class binding a store and a
logger, wrapping each call in instrumentation and delegating. It is procedural
now: the class is gone, the store dissolved into the functions that ran its
queries, and `record` is called *inside* each entry, where nothing can reach past
it. The algorithms — name canonicalization, type and value admission, date
admission — moved unchanged.

# Name Manager API

Four functions: one writes, three read.

| Function | Effect | Browser-reachable | Directory |
| --- | --- | --- | --- |
| [`define`](define/define.md) | mutator | yes — `command` | `define/` |
| [`get`](get/get.md) | reader | yes — `query` | `get/` |
| [`require`](require/require.md) | reader | yes — `query` | `require/` |
| [`list`](list/list.md) | reader | yes — `query` | `list/` |

## Why `get` and `require` are both here

They run the same lookup and differ only in what absence means: `get` answers
`undefined`, `require` refuses with `variable-not-found`.

That reads like duplication and is not. The decision belongs to the caller — a
panel listing what exists wants a branch, and a resolver walking a formula's
references has nothing to show without an answer — and stating it once here means
`variable-not-found` means the same thing everywhere instead of being reinvented
by each caller that needs it.

## Where the SQL lives

In the function that runs it. `define`'s insert is in `define.ts` and `list`'s
select is in `list.ts`; the one read that three functions share is promoted to
[`shared/find-variable.ts`](shared/find-variable.ts), by the ordinary promotion
rule applied to a query.

There is no `queries.ts` and no store. The generic query layer already exists and
is called Kysely, and a wrapper over it would grow parameters until it was a
worse query builder.

## Admission is this directory's job

Every function here has a `.remote.ts` and is therefore directly reachable by a
browser, with `'unchecked'` admission. The whole admission tree lives under
[`define/`](define/define.md), because `define` is the only function that writes
— the readers take a name, and one procedure admits it.

## Scope

Every function takes `Scope` first and its own input as the rest. No input type
has a slot for a project or a user, and no query carries a `project_id`
predicate: a project is its own database, so the database a procedure opens is
the scope.

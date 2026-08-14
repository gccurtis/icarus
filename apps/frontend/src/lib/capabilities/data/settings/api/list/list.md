# API: `list`

Every setting in one project, in key order.

## Classification

- **Effect:** accessor
- **Transaction:** none
- **Entry:** [`list.ts`](list.ts)
- **Browser-reachable:** yes, via [`list.remote.ts`](list.remote.ts)

## Signature

```ts
export const list = async (scope: Scope): Promise<readonly Setting[]>;
```

Scope and nothing else. That is the whole input, and it is a useful thing for
this capability's smallest function to demonstrate: a procedure that takes no
input still takes authority.

## Admission

Nothing to admit. The remote wrapper still resolves a project token, which is the
only untrusted value in the call.

## Output

`readonly Setting[]`, ordered by key.

Key order rather than write order, because the caller is a person reading a list
and `editor.font-size` beside `editor.theme` is what they expect. Recency is
already on each row for anyone who wants it.

**Unpaged deliberately.** A project's settings are bounded by how many things the
application has to configure, not by how much its users do — and a page parameter
nobody needs is a second thing every caller has to get right.

## Failures

None of its own. A fault reaching the caller came from the database or the
runtime.

## Effects

None.

## Procedure Tree

```text
list(scope)
├── record("list", {})              ../shared/record.ts
├── projectDatabase(scope.projectId)   $runtime/server/index.server
├── select from settings order by key
└── currentSetting(row) per row     ../../persistence/stored-types.ts
```

## Supporting Procedures

None.

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `record` | the count it returns is the cheapest signal that a project database is the one expected |

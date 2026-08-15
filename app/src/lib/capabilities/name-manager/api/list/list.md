# API: `list`

Returns every declaration in the project's catalog, in definition order.

## Classification

- **Effect:** reader
- **Transaction:** none
- **Entry:** [`list.ts`](list.ts)
- **Browser-reachable:** yes, via [`list.remote.ts`](list.remote.ts)

## Signature

```ts
export const list = async (scope: Scope): Promise<readonly NamedVariable[]>;
```

Scope and nothing else. There is no filter and no page, because the catalog *is*
the project's whole set — a project's named variables are authored by hand, and
one that outgrows a single response is a different problem than this signature.

## Definition order, not alphabetical

A catalog is read as a record of what was declared and when, and later
declarations commonly depend on earlier ones.

A caller who wants another order can sort what it receives. A caller who wanted
declaration order could not recover it if this function had never preserved it,
which is why the ordering column exists and is indexed.

## Output

`readonly NamedVariable[]`, empty when nothing is defined. Each element is
already copied at the storage boundary.

## Failures

None. An empty catalog is an empty array, not a refusal.

## Procedure Tree

```text
list(scope)
├── record("list", {})                 ../shared/record.ts
├── projectDatabase(scope.projectId)   $model/server/index.server
├── select from name_manager_variables order by definition_order asc
└── currentVariable(row)               ../../persistence/stored-types.ts
```

The query carries no project predicate. A project is its own database, so the
database this opens *is* the scope.

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `record` | the count is what makes a slow call explicable; no name and no value is recorded |

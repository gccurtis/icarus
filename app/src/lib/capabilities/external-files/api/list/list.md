# API: `list`

One project's files, metadata only.

Registered as `api.capabilities.externalFiles.list`, built from `projectQuery`.

## Procedure Tree

```text
list(ctx, scope)
└── by_project range → ExternalFile[]        list.ts
```

## It returns superseded files too

A superseded file is still a file: still stored, still referenced by whatever was
written against it. Which version a surface shows is that surface's decision — a
picker folds the chain by `supersedes`, an audit view wants every link — and
filtering here would take the choice away while hiding rows a caller can still
reach by id.

## No ordering

`by_project` leads with the project and nothing else, so this is the index's own
creation order. Recency and name are both a sort over a list the caller already
holds; a second index buys nothing until a project's files stop fitting in one
read.

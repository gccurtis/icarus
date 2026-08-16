# API: `rename`

Gives a document a different name.

Registered as `api.capabilities.documents.rename`, built from `projectMutation`.

## Procedure Tree

```text
rename(ctx, scope, id, title)
├── requireDocument(ctx, scope, id)         ../shared/require-document.ts
├── documentTitle(title)                    ../../types/document.ts
├── ctx.db.patch(id, title, updatedBy, …)   rename.ts
└── record(ctx, scope, "renamed")           ../../../activity/api/shared/record.ts
```

## The one edit that patches this row

Every other edit to a document appends a change set and leaves the row alone. The
title is the exception because it is the only thing stored here — which is the
reason this is a function of its own rather than a general `update` that would
have to say what an absent field means.

## The entry carries the new name

The log reads as what happened: "renamed Q4 plan". Entries written before this
one keep the old name, which is right — they describe the document as it was when
they were written, and that is what a stored label is for.

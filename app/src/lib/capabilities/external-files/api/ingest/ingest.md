# API: `ingest`

Records a file whose bytes are already in storage, and returns its id.

Registered as `api.capabilities.externalFiles.ingest`, built from
`projectMutation`, so the caller's token is resolved to a membership before this
runs. The door supplies the actor from `ctx.scope` and fixes the origin at
`upload`; a server-side caller with another origin calls this handler directly.

## Procedure Tree

```text
ingest(ctx, scope, by, input, byLabel?)
├── fileName(input.name)                     ../../types/external-file.ts
├── originFrom(by, input.origin)             ../../types/external-file.ts
├── extensionOf(name)                        ../../types/kind.ts
├── kindForExtension(extension)              ../../types/kind.ts
├── previousVersion(ctx, scope, origin, …)   previous-version.ts
│   ├── requireFile(ctx, scope, supersedes)  ../shared/require-file.ts
│   └── by_connector_external range          previous-version.ts
├── pendingExtraction(kind)                  ../../types/external-file.ts
├── ctx.db.insert("externalFiles", …)        ingest.ts
└── record(ctx, scope, verb)                 ../../../activity/api/shared/record.ts
```

## The name decides the kind

`extension` and `kind` are read off the name rather than accepted beside it. A
caller that sends both can send two answers, and the stored `kind` is what
routing later depends on — an image that arrived claiming to be a document is a
block that will not render.

**An extension nobody mapped is `ext-unknown` and the ingest succeeds.** Refusing
would throw away bytes someone chose to keep, for the sake of a routing hint we
do not need in order to store, list, and hand the file back.

## The actor is a parameter, and the origin is checked against it

**Uploads come from people.** An agent cannot upload from nowhere; a file it made
is a `generated` origin pointing at the task that made it. `originFrom` refuses
the mismatch, which is what keeps the record of where bytes came from worth
reading.

The door cannot produce that refusal — it always passes a user — and that is the
point: the check exists for the callers that arrive in passes 7 and 8, and it is
written now, while the rule is being stated, rather than then.

`byLabel` rides along because [`record`](../../../activity/api/shared/shared.md)
cannot resolve an agent's or a connector's display name until those tables exist.

## What it replaces, it does not touch

`previousVersion` answers with the row this supersedes; the insert stores the
pointer and stops. The superseded row keeps its name, its bytes, and every
reference made to it — a chain of `supersedes` pointers is the entire version
history, and nothing has to be reconstructed to read an old one.

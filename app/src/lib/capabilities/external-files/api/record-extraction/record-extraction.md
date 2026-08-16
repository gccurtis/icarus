# API: `recordExtraction`

Keeps what an extractor managed to read out of a file: text from a PDF, page
count from a deck, dimensions from an image.

Registered as `api.capabilities.externalFiles.recordExtraction`, built from
`projectMutation`.

## Procedure Tree

```text
recordExtraction(ctx, scope, id, outcome)
├── requireFile(ctx, scope, id)              ../shared/require-file.ts
├── ctx.db.patch(id, extraction)             record-extraction.ts
└── record(ctx, scope, "extracted")          ../../../activity/api/shared/record.ts
```

## Stored on the file rather than re-parsed on demand

The parse happens once, and the [knowledge
lattice](../../../../../../../docs/data-models/knowledge/knowledge-lattice.md)
depends on a stored field rather than on a parser still being available years
later. It is also why `remove` takes the extraction with the row.

## `unsupported` and `error` are recorded, not refused

They are what the file turned out to be. A caller that asks again gets that
answer instead of waiting on a `pending` state nothing will complete, and a file
with no extraction at all — an archive, an unknown format — is still a perfectly
good file.

## The entry is the system's

Extraction is machine work: nobody chose to read this file, and attributing it to
whoever happened to trigger the call would put a person's name on something they
did not do. `state` rides along as the entry's detail, because "we could not read
it" is the part worth seeing in a log.

The extractor itself is an action in a later pass; it calls this same function.

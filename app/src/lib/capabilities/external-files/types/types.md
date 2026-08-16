# External Files Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`kind.ts`](kind.ts) | `fileKindValidator`, the extension table, `extensionOf`, `kindForExtension` |
| [`external-file.ts`](external-file.ts) | `ExternalFile`, `fileOriginValidator`, the extraction validators, `fileName`, `originFrom`, `pendingExtraction` |

## Kind is its own file

Because the classifier is the part that changes. New extensions arrive, a better
mapping replaces this one, and none of that should sit in the middle of the type
everything else imports. `external-file.ts` names a `FileKind`; only `kind.ts`
knows how one is chosen.

## `ExternalFile` is not the row

It carries `id` — a file is reached by key — and drops `projectId`, which every
row a caller receives shares with the project they asked about.

## The invariants live here, not in `api/shared/`

`fileName`, `originFrom`, and `pendingExtraction` each say what something *is*
rather than performing a step: a name is trimmed and non-empty, an upload came
from a person, and a kind decides whether there is anything to read out of the
file. Same reason [`documents`](../../documents/types/types.md) keeps
`documentTitle` in `types/`.

`pendingExtraction` is the one routing decision `kind` exists to make. Queuing an
archive or an unknown file would leave a `pending` state nothing ever completes,
which reads as a stuck file rather than as one there was never anything to read
out of.

## `extractionOutcomeValidator` and `fileExtractionValidator` differ by one field

What an extractor reports, and what is stored. `extractedAt` is stamped on
receipt rather than accepted, for the reason `record` stamps `at`: a caller's
clock is not evidence. The door's argument is the outcome; the row holds the
extraction.

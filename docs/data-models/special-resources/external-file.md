# External file

Anything that arrives as a file. Every upload becomes an external file,
whatever its type, and so does every file pulled in by a
[connector](connector.md).

```ts
interface ExternalFile {
  projectId: Id<"projects">;
  storageId: Id<"_storage">;
  name: string;                // "Q3 forecast.xlsx"
  extension: string;           // "xlsx", lowercase, no dot
  mimeType: string;
  size: number;                // bytes
  kind: FileKind;
  origin: FileOrigin;
  supersedes?: Id<"externalFiles">;
  extraction?: FileExtraction;
  createdBy: Actor;
  updatedAt: number;
}

type FileKind =
  | "text"
  | "image"
  | "data"
  | "document"
  | "audio"
  | "video"
  | "archive"
  | "unknown";

type FileOrigin =
  | { kind: "upload" }
  | { kind: "connector"; connectorId: Id<"connectors">; externalId: string; externalUrl?: string }
  | { kind: "generated"; agentTaskId: Id<"agentTasks"> }
  | { kind: "capture"; url: string; capturedAt: number };

interface FileExtraction {
  state: "pending" | "ready" | "unsupported" | "error";
  text?: string;
  pageCount?: number;
  dimensions?: { width: number; height: number };
  error?: string;
  extractedAt?: number;
}
```

## One type for every file

There is no `Image` table and no `Spreadsheet upload` table. A PNG, a PDF, and a
CSV are the same object with a different `kind`, because everything the system
does with a file before it knows what is inside it — store it, name it, scope it
to a project, show it in a list, attach it to a message, delete it — is
identical.

An [image block](../content/content-block.md#image-blocks) references a file by
id; it does not care that the file is stored the same way a CSV is.

## Kind is derived from the extension

`kind` is set on ingest by looking at the extension, using the obvious mapping
and nothing cleverer:

| kind | extensions |
| --- | --- |
| `text` | `txt` `md` `rtf` |
| `image` | `png` `jpg` `jpeg` `gif` `webp` `svg` `heic` |
| `data` | `csv` `tsv` `json` `xlsx` `xls` `parquet` |
| `document` | `pdf` `docx` `pptx` `odt` |
| `audio` | `mp3` `wav` `m4a` `flac` |
| `video` | `mp4` `mov` `webm` `avi` |
| `archive` | `zip` `tar` `gz` `7z` |
| `unknown` | anything else |

It is stored rather than computed on read so it can be indexed, and so a
correction — a mislabelled extension, a better classifier later — is a write
rather than a change in behaviour for existing files.

`kind` decides what happens next: a `data` file can back an analysis, an `image`
can be placed in a block, a `document` gets text extracted, an `unknown` file is
stored and offered for download and nothing else. It is a routing decision, not
a claim about the contents — `mimeType` and the bytes remain the authority.

## Extraction

`extraction` is what we managed to read out of the file. Text from a PDF,
dimensions from an image, page count from a deck. It is optional and it is
allowed to fail: `unsupported` and `error` are ordinary outcomes, and a file
with neither is still a perfectly good file.

The extracted text is what feeds the [knowledge
lattice](../knowledge/knowledge-lattice.md). Keeping it on the file rather than
re-parsing on demand means the parse happens once, and means the lattice depends
on a stored field rather than on a parser being available.

Structured `data` files are not parsed into rows here. A CSV's text extraction
is its raw content; turning it into columns and typed values is analysis work
and belongs with [research](../research/research.md).

## Origin

`origin` records where the file came from, and it is a discriminated union
because the three cases carry genuinely different information. A connector file
keeps the provider's own id so a re-sync can match it to the same record rather
than creating a duplicate, and an `externalUrl` so it can be opened at the
source.

**Uploads come from people.** An agent cannot upload a file from nowhere; there
is no source for it to upload from. What an agent can do is *produce* one — an
export it wrote, a chart it rendered — and that is the `generated` case, pointing
at the task that made it.

**`capture` is research pulling something in.** A web page read while
investigating becomes a file so the bytes that were actually read are kept, with
`url` and `capturedAt` recording where and when. Pages change and disappear; a
[finding](../research/finding.md) citing one wants the copy, not just the link.

`origin` overlaps `createdBy`, which is an [`Actor`](../core/actor.md), and the
overlap is deliberate. `createdBy` answers who put the file here; `origin`
answers where the bytes came from, and carries the per-case data that answer
needs — the provider's own id for matching a re-sync, the external URL for
opening it at the source. Collapsing them into one field would drop that.

## Versions are new files

A file has no revision model. Its bytes are immutable, so a "new version" is a
new file row with `supersedes` pointing at the one it replaces.

One field rather than a model, because there is nothing to merge and nothing to
reconstruct — the old file still exists in full, and a chain of `supersedes`
pointers is the entire history. A re-uploaded document keeps its old references
working while new ones resolve to the current file.

Connector re-syncs use the same mechanism: a changed remote file becomes a new
row matched to the old one by `origin.externalId`, rather than the stored bytes
being overwritten under references that were made to the previous content.

## Related

[connector](connector.md) · [revisions](../revisions/README.md) ·
[content block](../content/content-block.md#image-blocks) ·
[knowledge lattice](../knowledge/knowledge-lattice.md)

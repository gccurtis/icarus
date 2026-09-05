# External files

One table. Everything that arrives as bytes we hold.

`externalFiles`

A PNG, a PDF, and a CSV differ by `subkind` and by nothing else, because
everything done with a file before anyone looks inside it is identical: store the
bytes, name it, list it, hand it back.

**Holding the bytes is what this table means.** `storageId` is required, and that
is the line between this and a [connection](connections.md) — a connection
describes a file that stays where it is, and this one describes a file that is
here.

---

## `externalFiles`

`app/src/lib/capabilities/external-files/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { fileOriginValidator, readabilityValidator } from "$external-files/types/origin";
import { fileSubkindValidator } from "$shared/types/file-subkind";
import { actorValidator } from "$shared/types/actor";

/**
 * A file this project holds.
 *
 * **`subkind` rather than `kind`.** Every row here is an `externalFile`, so the
 * base kind would be the same value on every row; the column holds only what
 * varies, and the full kind is the two joined — `externalFile::image`. That is
 * also what makes the index worth having: a selection naming
 * `externalFile::image` splits at the delimiter, and the remainder is what this
 * column is matched against.
 *
 * **No `revision` and no `status`.** Bytes are immutable, so a new version is a
 * new row with `supersedes` pointing at the one it replaces, and the old row
 * stays readable for every reference already made to it. Nothing here can go
 * missing or become unreadable either — that is what a connection's `status`
 * exists for, and it exists because the provider owns those bytes and we do not.
 *
 * **No `mimeType` and no `extension`.** Convex's `_storage` records a
 * `contentType` per blob, so a mime type would be a second copy of something the
 * platform hands back with the file; an extension is `name` after the last dot.
 * `size` stays, because a listing shows it and would otherwise need a
 * system-table read per row.
 *
 * **One row, one blob.** The row is metadata over exactly one stored object —
 * there is no original beside it and no derivative beneath it. An image is
 * reduced on the way in and the reduction is what is kept, because what gets
 * served on every view is worth storing and what gets served never is not.
 *
 * `pageCount` and `dimensions` describe those stored bytes, not what was handed
 * over.
 */
export const externalFilesTables = {
  externalFiles: defineTable({
    projectId: v.id("projects"),
    /** The one copy: what is stored, and what is served. */
    storageId: v.id("_storage"),
    name: v.string(),
    size: v.number(),
    subkind: fileSubkindValidator,
    origin: fileOriginValidator,
    /** The file this one replaces. */
    supersedes: v.optional(v.id("externalFiles")),

    pageCount: v.optional(v.number()),
    dimensions: v.optional(v.object({ width: v.number(), height: v.number() })),

    readable: readabilityValidator,

    createdBy: actorValidator,
    updatedAt: v.number()
  }).index("by_project_subkind", ["projectId", "subkind"])
};
```

One index, serving two reads. `[projectId, subkind]` is "every image in this
project", and its `projectId` prefix is the plain listing — a second index would
hold the same rows in the same order.

---

## `FileOrigin`

`app/src/lib/capabilities/external-files/types/origin.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * Where the bytes came from. A union rather than a flag, because the cases carry
 * genuinely different data.
 *
 * It sits beside `createdBy` and the overlap is deliberate: `createdBy` answers
 * who put the file here, `origin` answers where the bytes came from and carries
 * the per-case data that answer needs.
 *
 * **An upload comes from a person.** An agent has no source to upload from —
 * what it can do is *produce* a file, which is the `generated` case, pointing at
 * the run that made it.
 *
 * **A captured web page is a `capture` and a `text` subkind.** The URL is what
 * makes it a web link, and it lives here; the subkind stays the routing decision
 * it is everywhere else, because a captured page still needs its words read out.
 * A capture that fails produces no row at all — the link stays a `link` mark in
 * the text that held it.
 *
 * **There is no `connector` case.** A file brought in by a connector and copied
 * is an upload by that connector's reckoning; a file left where it is, is a
 * [connection](connections.md) and not a row here.
 */
export const fileOriginValidator = v.union(
  v.object({ kind: v.literal("upload") }),
  v.object({ kind: v.literal("generated"), agentTaskId: v.id("agentTasks") }),
  v.object({ kind: v.literal("capture"), url: v.string(), capturedAt: v.number() })
);

export type FileOrigin = Infer<typeof fileOriginValidator>;

/**
 * Whether words can be got out of this file — the only thing left on the row
 * about reading it, since the text itself is not stored here.
 *
 * **Required, and `no` is a real answer.** An optional field would make "nothing
 * to read here" indistinguishable from "not attempted yet", and a scanned PDF
 * with no text layer would be retried forever by something that cannot tell the
 * two apart.
 *
 * A property of the bytes rather than of one indexing run, which is why it is
 * here and not on a lattice source: it stays true however many times it is
 * asked.
 */
export const readabilityValidator = v.union(
  v.literal("unknown"),
  v.literal("yes"),
  v.literal("no"),
  v.literal("error")
);

export type Readability = Infer<typeof readabilityValidator>;
```

---

## The text is not stored here

Reading words out of a file produces text, and that text already has a home: the
[lattice](knowledge.md) holds it as windows, each carrying its own text and its
span into the source. The windows cover the whole file by construction, so the
original text is the union of them — a second copy on this row would be the same
bytes stored twice and served never.

It also means re-windowing costs no re-parse. Changing the window size reads
spans out of existing nodes rather than opening the PDF again.

What is left is whether there were ever words to get, which is `readable`. A
scanned PDF with no text layer answers `no` once, rather than being re-attempted
every time something notices the text is missing.

This is what lets the lattice treat a held file exactly like a connection: both
hand back text through a reader, in windows, rather than as a stored column.

---

## What has to change to register this

Both alias maps, or the push fails — `svelte.config.js` is the only alias map
everywhere else, but the Convex bundler resolves `paths` from the nearest
`tsconfig.json` and does not follow the `extends` chain.

```js
// app/svelte.config.js
      $external-files: "src/lib/capabilities/external-files",
```

```json
// app/src/convex/tsconfig.json
      "$external-files/*": ["../lib/capabilities/external-files/*"],
```

```ts
// app/src/convex/schema.ts — the fragment list appears twice
import { externalFilesTables } from "$external-files/schema";

const tables = { …, ...externalFilesTables };
const declared = [ …, externalFilesTables ].flatMap((fragment) => Object.keys(fragment));
```

---

## Files

```text
app/src/lib/capabilities/external-files/
├── overview.md
├── schema.ts                       externalFilesTables
└── types/
    ├── types.md
    └── origin.ts                   FileOrigin, Readability

modified
├── app/svelte.config.js            one alias
├── app/src/convex/tsconfig.json    one path
└── app/src/convex/schema.ts        import, spread, and the declared list
```

One table, so `schema.ts` is a file rather than a directory.

**Imports it does not define:** [`$shared/types/actor`](shared.md#actor),
[`$shared/types/file-subkind`](connections.md#filesubkind), and `agentTasks` from
[agents](agents.md).

## Related

[all tables](README.md) · [connections](connections.md) · [content](content.md)

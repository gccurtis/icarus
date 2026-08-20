# Connections

Two tables in one capability.

`connectors` · `connections`

**A connector is the authorized reader; a connection is one remote file read
through it.** Nothing is copied. A corpus far larger than any row or file can
hold is readable in place, and the lattice indexes through the connection in
windows rather than materializing anything.

That is the whole reason a connection is a resource in its own right rather than
a detail of its connector: a scope has to be able to exclude one file, and a
citation has to name one file. One row per account could do neither.

---

## `connectors`

`app/src/lib/capabilities/connections/schema/connectors.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { connectorProviderValidator } from "$connections/types/provider";
import { actorValidator } from "$shared/types/actor";

/**
 * An authorized account at a provider, and what it watches there.
 *
 * **`selection` and `cursor` are opaque strings.** They are the only genuinely
 * provider-shaped things here — a Graph subtree, an S3 prefix, a Notion
 * database — and nothing queries inside either, which is what makes encoding
 * them free. Every provider offers the same three primitives underneath: list a
 * subtree, hand back a delta token, fetch one item.
 *
 * **`credential` is one nested field rather than four loose ones**, so a read
 * model omits one name instead of remembering four. `secret` is the whole token
 * blob as a unit, because providers return different things inside it — a
 * tenant id, an id token, a realm — and splitting it into columns would mean a
 * column per provider quirk.
 *
 * `expiresAt` and `scopes` stay outside the ciphertext on purpose: a refresh
 * scheduler should not have to decrypt to learn when, and what was granted is
 * not secret.
 *
 * The key that encrypts `secret` is a deployment environment variable and is
 * never a row. `keyVersion` is what lets a rotation proceed one row at a time
 * instead of all at once.
 */
export const connectors = defineTable({
  projectId: v.id("projects"),
  provider: connectorProviderValidator,
  /** Which account at that provider — two SharePoints can coexist. */
  account: v.string(),
  name: v.string(),
  /** JSON: which subtree is watched. */
  selection: v.string(),
  /** The provider's delta token. */
  cursor: v.optional(v.string()),
  status: v.union(
    v.literal("connected"),
    v.literal("expired"),
    v.literal("revoked"),
    v.literal("error")
  ),
  lastSyncedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  /** Absent before authorization completes, and after it is revoked. */
  credential: v.optional(
    v.object({
      /** Ciphertext. */
      secret: v.string(),
      keyVersion: v.number(),
      expiresAt: v.optional(v.number()),
      scopes: v.array(v.string())
    })
  ),
  createdBy: actorValidator,
  updatedAt: v.number()
}).index("by_project", ["projectId"]);
```

---

## `connections`

`app/src/lib/capabilities/connections/schema/connections.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { fileSubkindValidator } from "$shared/types/file-subkind";

/**
 * One remote file, described but not held.
 *
 * **No `createdBy`.** A connection is always created by its connector, and
 * `connectorId` already says which.
 *
 * **A change is a `revision` bump on this row, never a new row.** That is the
 * deliberate asymmetry with an uploaded file, where a new version *is* a new row
 * carrying `supersedes`: there we keep the old bytes and every existing
 * reference must still resolve, and here there are no old bytes to keep and the
 * provider only has the current one.
 *
 * `revision` is a string for the reason a lattice source's is — providers
 * version differently, one hands back an etag and another a timestamp, and
 * nothing here compares them for order.
 *
 * **`status` is the only place a read failure can be recorded.** A connection
 * stores no text, so it has nothing like an extraction outcome to carry a failed
 * state — and a citation pointing at a file that was deleted, moved out of the
 * watched subtree, or had its permissions pulled has to render as something
 * other than a silent blank.
 *
 * **`subkind` rather than `kind`.** The base kind is what the table is — every
 * row here is a `connection` — so the column holds only what varies, and the
 * full kind is the two joined: `connection::text`.
 *
 * It is required and the rest of the description is not: we always classify, and
 * providers disagree about what they tell us. A Notion page has no size.
 *
 * `by_connector_external` is the re-sync match: same connector, same id at the
 * provider. It leads with `projectId` like every other index — a connector
 * belongs to one project, so the column narrows nothing, but a read that can
 * forget the project predicate is the one worth making impossible.
 */
export const connections = defineTable({
  projectId: v.id("projects"),
  connectorId: v.id("connectors"),
  /** The provider's own id — what a re-sync matches on. */
  externalId: v.string(),
  /** Where a person opens it. */
  externalUrl: v.optional(v.string()),
  /** What a citation shows. */
  name: v.string(),
  subkind: fileSubkindValidator,
  size: v.optional(v.number()),
  /** The provider's etag or version — what says this is stale. */
  revision: v.string(),
  status: v.union(
    v.literal("live"),
    v.literal("missing"),
    v.literal("unreadable"),
    v.literal("error")
  ),
  error: v.optional(v.string()),
  updatedAt: v.number()
})
  .index("by_project", ["projectId"])
  .index("by_connector_external", ["projectId", "connectorId", "externalId"]);
```

---

## The fragment

`app/src/lib/capabilities/connections/schema/tables.ts`

```ts
import { connections } from "$connections/schema/connections";
import { connectors } from "$connections/schema/connectors";

/** The only thing `convex/schema.ts` imports from this capability. */
export const connectionsTables = { connectors, connections };
```

---

## `ConnectorProvider`

`app/src/lib/capabilities/connections/types/provider.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * Which service a connector reads from.
 *
 * **A closed union rather than a string**, because adding a member is a
 * *widening* change: every existing row still validates, so there is no
 * migration and no backfill — it is one line and a deploy. What the union buys
 * is that a `switch` over providers stops compiling the moment one is added,
 * which is correct, since adding a provider means writing a reader for it. A
 * string lets a connector deploy and then silently never sync.
 *
 * SharePoint and OneDrive are one entry: they are the same drive API.
 */
export const connectorProviderValidator = v.union(
  v.literal("microsoftGraph"),
  v.literal("googleDrive"),
  v.literal("dropbox"),
  v.literal("notion"),
  v.literal("s3")
);

export type ConnectorProvider = Infer<typeof connectorProviderValidator>;
```

---

## `FileSubkind`

`app/src/lib/capabilities/shared/types/file-subkind.ts`

Shared rather than owned by either side, because a connection and an uploaded
file answer the same question about their contents.

```ts
import { v, type Infer } from "convex/values";

/**
 * What a file is, for routing — the subkind under `externalFile` or
 * `connection`.
 *
 * **No prefix.** The base kind is the table, so `connection::text` and
 * `externalFile::text` are composed rather than stored, and the column never
 * repeats what every row in it already agrees on.
 *
 * **`text` is anything you read words out of**, whether or not a parser is
 * needed to get at them. A markdown file and a PDF differ to whoever writes the
 * extractor and to nobody downstream — the lattice sees the same text either
 * way, so splitting them would be a distinction with one consumer.
 *
 * `data` is separate because it backs an analysis rather than a reading, and
 * `image` because it goes in a block. `unknown` covers archives and everything
 * unrecognized: stored or pointed at, and nothing else.
 */
export const fileSubkindValidator = v.union(
  v.literal("text"),
  v.literal("data"),
  v.literal("image"),
  v.literal("audio"),
  v.literal("video"),
  v.literal("unknown")
);

export type FileSubkind = Infer<typeof fileSubkindValidator>;
```

| subkind | what falls in it |
| --- | --- |
| `text` | txt, md, rtf, html, pdf, docx, pptx, odt |
| `data` | csv, tsv, json, xlsx, xls, parquet |
| `image` | png, jpg, jpeg, gif, webp, svg, heic |
| `audio` | mp3, wav, m4a, flac |
| `video` | mp4, mov, webm, avi |
| `unknown` | zip, tar, gz, 7z, and everything unrecognized |

The classifier that produces one is not here. It is the same function for both
consumers and belongs beside this type, but it is behaviour rather than storage.

---

## What has to change to register this

### The two alias maps

Both, or the push fails. `svelte.config.js` is the only alias map everywhere
else, but the Convex bundler does not read it — it resolves `paths` from the
nearest `tsconfig.json` and does not follow the `extends` chain.

`app/svelte.config.js`

```js
    alias: {
      $convex: "src/convex",
      $model: "src/lib/model",
      $views: "src/lib/views",
      $access: "src/lib/capabilities/access",
      $connections: "src/lib/capabilities/connections",
      $content: "src/lib/capabilities/content",
      $shared: "src/lib/capabilities/shared",
    },
```

`app/src/convex/tsconfig.json`

```json
    "paths": {
      "$convex/*": ["./*"],
      "$access/*": ["../lib/capabilities/access/*"],
      "$connections/*": ["../lib/capabilities/connections/*"],
      "$content/*": ["../lib/capabilities/content/*"],
      "$shared/*": ["../lib/capabilities/shared/*"],
      "$model/*": ["../lib/model/*"]
    }
```

### The schema composition

`app/src/convex/schema.ts` names its fragment list **twice** — once in the
literal spread that carries the table types through to `ctx.db`, and once in the
duplicate-name check. Adding to only one makes the check pass while covering less
than it claims.

```ts
import { defineSchema } from "convex/server";
import { accessTables } from "$access/schema/tables";
import { connectionsTables } from "$connections/schema/tables";

const tables = { ...accessTables, ...connectionsTables };

const declared = [accessTables, connectionsTables].flatMap((fragment) =>
  Object.keys(fragment)
);
```

Nothing goes in `app/src/convex/capabilities/`. That directory holds the public
function surface, and this is tables only — a module there would become an
addressable endpoint for no reason.

### The lint

`app/scripts/lint/capabilities/rules.mjs` currently forbids a `schema/`
directory: `ALLOWED_DIRS` is `docs types api test`, and `ALLOWED_ROOT_FILES`
carries `schema.ts` with a comment arguing one file is enough. **`schema` joins
`ALLOWED_DIRS`** — see [the convention](README.md#schemas-are-a-directory-one-file-per-table).
One table per file is what makes the directory listing say what the capability
stores without opening anything.

---

## Files

```text
app/src/lib/capabilities/connections/
├── overview.md
├── schema/
│   ├── schema.md
│   ├── connectors.ts
│   ├── connections.ts
│   └── tables.ts                   connectionsTables
└── types/
    ├── types.md
    └── provider.ts                 ConnectorProvider

app/src/lib/capabilities/shared/types/
└── file-subkind.ts                 FileSubkind

modified
├── app/svelte.config.js                     one alias
├── app/src/convex/tsconfig.json             one path
├── app/src/convex/schema.ts                 import, spread, and the declared list
└── app/scripts/lint/capabilities/rules.mjs  "schema" joins ALLOWED_DIRS
```

**Imports it does not define:** `$shared/types/actor`, and `projects` from
[access](access.md).

## Related

[all tables](README.md) · [resource sets](resource-sets.md)

# Block-kind model overhaul — text + sub-kinds, code (backend-outstanding Phase B)

The document block catalog collapses into one prose kind carrying a semantic
**sub-kind**, plus a first-class **code** kind. The old semantic kinds
(`paragraph`, `heading_1…6`, `quote`, `callout`, `list_item`) are gone. There is
no migration: document data is wiped once and re-created under the new model.

## The model (`core/capability/document`)

- **Block kinds are now `text`, `code`, `divider`, `image`, `prompt`.** A `text`
  block holds prose; `code` is a monospace preformatted block; `divider` and
  `image` hold no atoms; `prompt` (the already-shipped AI block) is unchanged.
  Native lists return as their own kind in Phase C — `list_item` and its
  `ListData` are removed here.
- **`Block.SubKind`** applies only to the text kind. It names the block's
  semantic role: a **built-in** (`body`, `heading_1…heading_6`) or the id of a
  **user-defined style definition** in the document's style registry. A text
  block defaults to `body`; every other kind carries no sub-kind. This is the
  "convert in place" model — a heading is a text block, not a distinct kind.
- **Sub-kind validation is two-layered.** `validSubKindStructure` (registry-free)
  enforces the shape at op-validation time: a text block's sub-kind is a built-in
  or a syntactically valid style id, a non-text block has none. `validBlockSubKind`
  (registry-aware) additionally requires a **custom** sub-kind to be backed by a
  style definition that applies to `text`; it runs on apply, wherever a block is
  inserted or its kind/sub-kind changes.

## New op: `set_block_subkind`

`{blockId, setSubKind}` converts a text block's sub-kind in place (the cockpit's
Text-type control). A blank value resets to `body`; only text blocks accept it.
Full changeset lifecycle: validate (shape), apply (registry check + text-only),
inverse (restore the prior sub-kind), rebase footprint **`block-subkind:<blockId>`**
(its own key — independent of content, kind, and style edits), clone (copy
`SetSubKind`), and history (the op's `blockId` is summarized like any block op).

`set_block` (the kind setter) is extended to the new kind set and keeps the
sub-kind consistent with the target kind — defaulting `body` when moving to text,
clearing it otherwise. A custom sub-kind is created by the existing
`put_style_definition` op (a sub-kind *is* a style definition applying to `text`),
so no new registry mechanism was needed.

## Markdown (lossy, our format is the source of truth)

`text/body` ↔ paragraph, `text/heading_N` ↔ `#`…`######`, `code` ↔ a `` ``` ``
fence. The splitter is fence-aware, so blank lines inside code do not split it.
A quote (`>`) imports as body text — the marker is dropped, since quote is no
longer a kind. Custom sub-kinds export as plain paragraphs. Non-representable
blocks (prompt, image, divider) are skipped. No styling round-trip is promised.

## Agent tool

`document.get`/`document.edit` keep a stable model-facing vocabulary
(`paragraph`, `heading_1…6`, `code`) and translate it to the stored model:
`paragraph`/`quote`/`text` → `text/body`, `heading_N` → `text/heading_N`, `code`
→ the code kind. Reads project a stored block back to that vocabulary (a heading
sub-kind reports itself; every other text block is `paragraph`).

## Data reset (no migration)

A one-time reset in the sqlite migration clears `documents`, `change_sets`,
`document_submissions`, `document_history`, `document_anchors`,
`document_comments`, and `comment_replies`, gated by `PRAGMA user_version` so it
runs **exactly once** per database. There is no reader for the old kinds, so this
is a deliberate dev-stage wipe rather than a migration. Starting the service
against an existing database clears its documents on first boot under the new
model.

## Tests

- Unit (`core/capability/document`): `set_block_subkind` across built-ins with a
  blank-resets-to-body case; an unknown sub-kind rejected; a custom sub-kind
  registered then applied (and rejected before its definition exists); sub-kind
  rejected on a code block; a Markdown code round-trip preserving interior blank
  lines. Existing block/markdown/style/duplicate tests updated to the new model.
- Dev-test (`dev-test/block-kinds`, free): create text + code blocks, convert a
  text block's sub-kind, define and apply a custom sub-kind, reject an unknown
  sub-kind and a sub-kind on a code block, and round-trip headings + fenced code
  through Markdown. Existing `documents` / `changesets` / `import-export` suites
  (and the model-backed `action` / `agents` suites) updated to `text` + `subKind`.

## Settled

- One `text` kind with a sub-kind; `code` its own kind; `prompt` untouched. ✓
- Sub-kinds are style definitions (built-in + user-extensible), validated against
  the registry. ✓
- No migration — a one-time, `user_version`-gated document-data wipe. ✓
- Markdown is a lossy export; our block model is the source of truth. ✓
- Native `list` and the full inline/cascading typography model are Phases C–E.

## Follow-up: callout kind

`callout` returns as a first-class block kind — text-bearing with no sub-kind,
like `code` — for a highlighted aside box. It needs no typed data (the default
`nil`-data path validates it), carries no sub-kind (`normalizeBlock` clears it on
any non-text kind), and its authored text is fed to knowledge like any
non-inferred block. Markdown export renders a callout as a blockquote (`> …`) —
the conventional, lossy markdown for an aside; it re-imports as body text. The
agent tool accepts and reports `callout` alongside its other kinds. Unit test +
`dev-test/block-kinds` cover create, convert-to-callout, and the blockquote
export.

# Block types

A **block** is the primary structural unit of a document's content: one entry in
a [row](data-model.md#row), with a `Kind` that says what it is and an ordered
list of [atoms](atoms-and-marks.md) that hold its inline text. This page is the
reference for every block kind the model supports today, including the generated
prompt block, and how later kinds slot in.

Prerequisite: the [data model](data-model.md) for the containment hierarchy and
the fail-closed kind rule. Source:
[`model.go`](../../../../core/capability/document/model.go) (the `Block`
type and the block-kind constants) and
[`changeset.go`](../../../../core/capability/document/changeset.go) (validation
and the ops that build blocks).

## What every block has

Regardless of kind, a [`Block`](../../../../core/capability/document/model.go)
is the same struct:

| Field | Role |
|---|---|
| `ID` | stable identity; change-set ops target the block by this id |
| `Kind` | which block kind (this page); an empty kind defaults to `paragraph` |
| `Style` | block-level horizontal (`left`, `center`, `right`) and vertical (`top`, `middle`, `bottom`) alignment; omitted values default to `left` / `top` |
| `Inferred` | whether the current content was system-generated and must stay out of source ingestion |
| `Atoms` | ordered inline content — the block's text, as [atoms](atoms-and-marks.md); `DisplayText()` concatenates their `Text` |
| `Marks` | inline styling over ranges of the atoms (bold, link, …) — see [marks](atoms-and-marks.md#marks) |
| `Data` | optional typed kind-specific payload; currently `PromptData` for `prompt` |

Every block shares the same base shape. Paragraphs and headings use `Kind` only;
the prompt kind also uses `Inferred` and a typed `PromptData` subtype in `Data`.
Validation requires the payload to match the kind.

The supported kinds are registered in `blockKinds`; a kind outside that set is
rejected by both `validateContent` (on create) and `validateOps` (on a
`set_block` or a block-inserting op). The registry is the whole allow-list:

```go
BlockKindParagraph = "paragraph" // default when a block omits a kind
BlockKindHeading1  = "heading_1"
BlockKindHeading2  = "heading_2"
// … heading_3 … heading_6
BlockKindPrompt    = "prompt"
```

Two change ops concern a block's kind directly: `insert_block` (create a block of
some kind in a row) and `set_block` (change an existing block's kind via
`SetKind`). `set_block_alignment` changes either or both style fields while
preserving any omitted axis. The [op catalog](README.md) covers the other
operations that edit a block and its contents.

## `paragraph` — body text

`BlockKindParagraph` is the default and the most common block. It represents a
run of ordinary body text: a line/paragraph of prose whose content is its atoms.
It is the kind assigned when a block is created without an explicit kind
(`normalizeBlock` fills it in), so "a block" with no further qualification is a
paragraph.

- **Represents:** unstyled body text (styling is applied *within* it by marks,
  not by the kind).
- **Structure:** `atoms` hold the text; `marks` style ranges of it. No
  kind-specific fields.
- **Used for:** the bulk of a document; also the natural host for inline atom
  kinds (a formula or prompt atom lives inside a paragraph's atom list).

## `heading_1` … `heading_6` — section headings

The six heading kinds represent document structure — section titles at
descending levels, exactly mirroring Markdown's `#` through `######` and HTML's
`<h1>`–`<h6>`. They are distinct kinds (not one kind with a level field) so the
allow-list stays a simple set and a renderer maps each kind straight to an
element:

| Kind | Level | Typical meaning |
|---|---|---|
| `heading_1` | 1 | document / top-section title |
| `heading_2` | 2 | major section |
| `heading_3` | 3 | subsection |
| `heading_4`–`heading_6` | 4–6 | progressively finer subdivisions |

- **Represent:** a heading at a fixed level; the level *is* the kind.
- **Structure:** identical to a paragraph — the heading text is its atoms, and
  marks may style ranges of it (e.g. `code` inside a heading). No level field
  and no kind-specific fields.
- **Used for:** section structure and outline. Because a heading is just a
  text-bearing block, its `DisplayText()` feeds [knowledge](../knowledge/README.md)
  ingestion the same as any other block.

Changing a paragraph into a heading (or between heading levels) is a single
`set_block` op with `SetKind` — the atoms and marks are untouched, only the label
changes.

## Deferred kinds: list and code

The `Block` documentation notes that **list and code kinds come in a later
increment**. They are not yet in `blockKinds`, so content using them is rejected
today. When added:

- **`code`** would represent a preformatted code block — text-bearing like the
  rest, but rendered monospaced and typically exempt from inline marks. It likely
  fits the existing shape with no new fields (perhaps a language hint in a future
  attribute).
- **list** items would represent bulleted/numbered entries — these may need a
  small amount of kind-specific structure (nesting depth, ordered vs. unordered),
  which is the first case where a block kind carries more than atoms and marks.

They are called out here because the prompt block established the subtype
precedent: a new kind is added by declaring the constant, extending
`blockKinds`, and teaching validation and JSON decoding about any typed payload.

## `prompt` — grounded generated section

`BlockKindPrompt` is the first kind with typed state. It carries `PromptData`,
whose authored `Instruction` drives a plan → retrieve → synthesize pipeline.
The last resolution records status, evidence and source versions, prior
instruction/output, usage, and `ResolvedAt`.

The generated answer is incorporated as ordinary atoms through a
`resolve_block` change op, and `Inferred` is set so Knowledge never feeds that
generated answer back as source material. Users may edit the atoms afterward;
`reload` always resolves again, while `refresh` skips provider work unless the
instruction or Project knowledge changed.

The capability reaches Knowledge and Intelligence only through Document-owned
ports supplied by `wiring`. Full behavior, async route, and freshness semantics
are in [prompt blocks](prompt-blocks.md).

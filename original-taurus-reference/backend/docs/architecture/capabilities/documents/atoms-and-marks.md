# Atoms & marks

Inside a [block](block-types.md), content is a sequence of **atoms** (the inline
units that hold text) with **marks** layered over ranges of them (the inline
styling). This page is the reference for every atom kind and every mark kind, and
for the **anchor**, the primitive that both use to point at a position in the
text.

Prerequisite: the [data model](data-model.md). Source:
[`model.go`](../../../../core/capability/document/model.go) (the `Atom`,
`Mark`, `Anchor` types) and
[`changeset.go`](../../../../core/capability/document/changeset.go) (mark kinds,
range validation, and the ops that edit atoms and marks).

## Atoms

An [`Atom`](../../../../core/capability/document/model.go) is the smallest
inline unit of content:

| Field | Role |
|---|---|
| `ID` | stable identity; atom- and mark-level ops target it by this id |
| `Kind` | how the atom's text is *produced* (this section); empty defaults to `text` |
| `Text` | the atom's display text |

A block's inline content is its ordered list of atoms, and its plain text is
their `Text` concatenated (`Block.DisplayText()`). The crucial idea: **every atom
carries display `Text` regardless of kind** — the kind selects how that text
comes to exist, not whether it exists. That is what lets a paragraph mix literal
text with, one day, a generated or computed atom while `DisplayText()` and
[knowledge](../knowledge/README.md) ingestion keep working over a single flat
string.

Atom kinds are gated by `validAtomKind`; an unsupported kind is rejected on
create (`validateContent`) and on an `insert_atom` op (`validateOps`).

### Atom kinds

#### `text` — literal text

`AtomKindText` is the only atom kind today and the default. Its `Text` *is* its
content — typed characters, nothing computed. A run of prose is a sequence of
`text` atoms (often just one per block until editing splits it).

- **Represents:** literal, author-typed text.
- **Structure:** `Text` holds the characters; no other fields.
- **Edited by:** `insert_atom` / `delete_atom`, identity-preserving `move_atom`,
  and digest-guarded `splice_atom_text` for ordinary typing.
  `set_atom_text` remains the compatible whole-value replacement. See the
  [op catalog](README.md).

#### Deferred inline `formula` and `prompt` atoms

The `Atom` documentation names **formula and prompt atom kinds** as the seam for
a later increment. Both would be inline units whose `Text` is *produced* rather
than typed:

- A **formula** atom would compute its `Text` from an expression (a spreadsheet
  cell inline in prose).
- A **prompt** atom would fill its `Text` by generation — grounded through
  [knowledge](../knowledge/README.md) retrieval and produced via
  [intelligence](../intelligence.md) — from an authored prompt, *inline* within a
  paragraph's text flow.

This is an unimplemented inline alternative to the existing prompt *block* (see
[block types](block-types.md#prompt--grounded-generated-section)): a prompt atom
would be generated text embedded in a sentence; the implemented prompt block is
a standalone generated section. Adding either atom kind follows the model's
fixed pattern — declare the kind, extend `validAtomKind`, add its structured
fields and ops, and keep `Text` populated so downstream text consumers are
unaffected. The
[data model](data-model.md#extending-the-model--where-a-new-type-plugs-in) covers
that pattern in full.

## Anchors

An [`Anchor`](../../../../core/capability/document/model.go) is how the model
names a *position inside the text*, and it is the building block of a mark's
range:

| Field | Role |
|---|---|
| `AtomID` | which atom the position is in |
| `Offset` | a UTF-8 **byte** offset into that atom's `Text` |

The offset must land on a **rune boundary** and lie within the atom
(`0 ≤ Offset ≤ len(Text)`), enforced by `validAnchor`. Anchoring to `(atom,
byte offset)` rather than a document-global character index is what keeps a
position stable as *other* atoms are edited: inserting text elsewhere doesn't
move an anchor, because it is expressed relative to a specific atom. Anchors are
ordered by their atom's position in the block and then by offset (`anchorLess`),
which is how a mark's start/end are checked to be in order.

When `splice_atom_text` changes the anchored Atom, positions before the splice
stay fixed, positions after it shift by the replacement's byte-length delta,
and positions inside the replaced range snap to its new start or end edge. The
operation requires the exact prior text digest and rune-boundary offsets, so it
never applies a byte range to different text by accident.

## Marks

A [`Mark`](../../../../core/capability/document/model.go) layers inline styling
over a **range** of a block's atoms — it does not hold text, it decorates it:

| Field | Role |
|---|---|
| `ID` | stable identity; `remove_mark` and `update_mark` target it |
| `Kind` | which styling (this section) |
| `Attrs` | optional string attributes a kind needs (e.g. a link's `href`) |
| `Start` / `End` | [anchors](#anchors) delimiting the styled range |

A mark is valid only if its range fits the current atoms: `validMarkRange`
requires both anchors to be valid and `Start` to come strictly before `End`
(non-empty, ordered). Because a range is pinned to live atoms, editing can
invalidate it — so after an atom is deleted or its text shrinks,
`sanitizeBlockMarks` drops any mark whose range no longer fits, keeping a block's
marks always valid. Marks are added, updated, and removed by the `add_mark`,
`update_mark`, and `remove_mark` ops. Update replaces the full Mark in its
existing position only when `expectedMarkHash` matches the SHA-256 digest of its
canonical current JSON. A duplicate add, stale digest, or ill-fitting range is
an `ErrConflict`.

Mark kinds are the fixed set in `markKinds`; an unknown kind is rejected.
Marks deliberately own only range-level formatting. Whole-block horizontal and
vertical alignment lives in `Block.Style`, while row height lives in
`Row.Style`; neither is duplicated as a mark.

### Mark kinds

#### `bold`, `italic`, `underline`, `strike`

The four plain character-styling marks. Each represents exactly what its name
says — bold weight, italic slant, underline, strikethrough — applied to the
range from `Start` to `End`.

- **Represent:** presentational emphasis/decoration over a text range.
- **Structure:** kind + range; **no `Attrs`** are required or used.
- **Used for:** ordinary rich-text formatting. They compose — the same range (or
  overlapping ranges) can carry several of these marks at once.

#### `code` — inline code

`MarkKindCode` represents inline monospaced/code styling over a range —
Markdown's `` `backticks` `` within a line. Like the four above it needs no
attributes; it differs only in rendering intent (monospace, and typically a
renderer suppresses other decoration inside it). It is the inline counterpart to
a future `code` *block* ([block types](block-types.md#deferred-kinds-list-and-code)).

#### `link` — hyperlink

`MarkKindLink` represents a hyperlink over a range. It is the one mark kind that
**requires an attribute**: `Attrs["href"]` must be present and non-empty, checked
by `validateMarkPayload` (a `link` without an `href` is `ErrInvalidChangeSet`).

- **Represents:** a hyperlink anchored on the styled text.
- **Structure:** kind + range + `Attrs{"href": "<url>"}`. `Attrs` is the
  extension point for kinds that carry parameters; today only `link` uses it.
- **Used for:** turning a span of text into a link without splitting it into its
  own atom — the link is *styling over existing atoms*, so the underlying text
  and its other marks are unaffected.

### How marks relate to generated content

Marks are useful context for generated content because they
establish the model's answer to "annotate a range without owning it." A prompt —
whether block or atom — is about *producing* text, which is an atom/block concern,
not a mark concern (marks never generate content). But the `Attrs` pattern (a
kind carrying typed parameters) and the range-validity discipline (structure that
must stay consistent with live atoms as they change) are the same design muscles
a prompt type will use for its own fields and its own staleness rules. See the
[data model](data-model.md#the-implemented-prompt-block-subtype) for the
implemented block subtype.

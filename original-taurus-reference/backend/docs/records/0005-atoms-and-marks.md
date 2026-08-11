# 0005 — Inline content: atoms and marks

A block used to be a flat `{Type, Text}` — one plain string, no inline structure.
This introduces the reference model's **inline layer**: a block's content is an
ordered list of **atoms**, and **marks** style ranges across them. It's the first
increment toward the full document model; formula/prompt atoms, styles, typed
media and tables are deferred.

The design, settled with the user: **Row → Block → Atom**, with marks over atom
ranges. A block's **display text is derived** — the concatenation of its atoms'
text — not stored. Formula/prompt are *atom kinds* (a source that differs from its
displayed result), so they slot in later with no model change; this increment ships
**text atoms + styling marks** only.

## core/document/document.go — the model

```go
// Atom is one inline content unit within a block. Every atom carries display
// Text; Kind selects how that text is produced. Only AtomKindText is supported
// now — formula and prompt atom kinds are the seam for a later increment.
type Atom struct {
	ID   string `json:"id"`
	Kind string `json:"kind"`
	Text string `json:"text"`
}
```

`Anchor{AtomID, Offset}` points into an atom at a **UTF-8 byte offset on a rune
boundary**. `Mark{ID, Kind, Attrs, Start, End}` styles the range from Start to End
across a block's atoms (`bold, italic, underline, strike, code, link`; `link`
carries `Attrs["href"]`). `Block{ID, Kind, Atoms, Marks}` replaces `{Type, Text}`,
and `Block.DisplayText()` folds the atoms:

```go
// DisplayText is a block's plain-text content: its atoms' text, concatenated.
func (b Block) DisplayText() string {
	var sb strings.Builder
	for _, a := range b.Atoms {
		sb.WriteString(a.Text)
	}
	return sb.String()
}
```

`normalizeBlock` assigns missing ids and default kinds down through a block's atoms
and marks, so every unit has a stable id the ops can address.

## core/document/changeset.go — the op vocabulary

Text moved into atoms, so the edit surface grew. `set_block` now sets a block's
**kind**; text is edited through atom ops:

| Op | Effect |
| --- | --- |
| `insert_row` / `delete_row` | unchanged |
| `insert_block` / `delete_block` | block carries `Kind` + initial atoms/marks |
| `set_block` | set the block's `Kind` |
| `insert_atom` / `delete_atom` | add/remove a text atom in a block (by anchor) |
| `set_atom_text` | replace an atom's text |
| `add_mark` / `remove_mark` | add/remove a styling mark over an atom range |

`applyOp` keeps the strict **intent-preservation** rule for every level: a missing
or duplicate row/block/atom/mark id — or a mark whose range does not fit the current
atoms — returns `ErrConflict` (→ 409), never a silent relocation.

```go
	case OpAddMark:
		if op.Mark == nil {
			return nil, ErrInvalidChangeSet
		}
		ri, bi, ok := blockLoc(rows, op.BlockID)
		if !ok {
			return nil, ErrConflict
		}
		blk := &rows[ri].Blocks[bi]
		if indexOfMark(blk.Marks, op.Mark.ID) >= 0 {
			return nil, ErrConflict // duplicate mark id
		}
		if !validMarkRange(blk.Atoms, *op.Mark) {
			return nil, ErrConflict // range does not fit the current atoms
		}
		blk.Marks = append(blk.Marks, *op.Mark)
		return rows, nil
```

Two supporting decisions:

- **Mark range validation** (`validMarkRange`): both anchors must reference existing
  atoms, at rune boundaries, and Start must come strictly before End in atom order.
- **Mark sanitizing** (`sanitizeBlockMarks`): after `delete_atom` or `set_atom_text`
  shortens or removes text a mark covered, marks whose range no longer fits are
  **dropped** — the block's marks stay valid rather than dangling.

Deep copying was extended: `cloneBlock` now copies a block's atoms and marks, and
inserts (`insert_row`/`insert_block`) clone their payloads — so resolution never
aliases the stored base or an op's payload slices (the same class of bug the
change-set work first hit at the block level).

## Clean break

Pre-production dev data, so no migration: the base is opaque JSON in SQLite, and the
new shape simply replaces the old. Existing dev databases should be recreated.

## Tests

- `core/document`: ops resolve end-to-end (edit atom, insert atom, insert heading
  block, add mark; then delete atom/block); `set_atom_text` drops an invalidated
  mark; every missing/duplicate/out-of-range rejection returns `ErrConflict`; the
  rebase/prune tests carry over on the new model.
- `core/transport`: the document-change endpoint edits an atom and adds a bold mark
  (both come back on read); conflict still maps to 409.
- `dev-test` documents/changesets suites drive create + atom edits + `add_mark` +
  insert/delete atoms over HTTPS.

## Follow-up: the default markdown block kinds

`Block.Kind` was a free string. This defines the **default markdown set** and
validates against it (unknown kinds fail closed) — the paragraph and the six
heading levels:

```go
const (
	BlockKindParagraph = "paragraph" // the default kind, used when a block omits one
	BlockKindHeading1  = "heading_1"
	BlockKindHeading2  = "heading_2"
	BlockKindHeading3  = "heading_3"
	BlockKindHeading4  = "heading_4"
	BlockKindHeading5  = "heading_5"
	BlockKindHeading6  = "heading_6"
)
```

Each heading level is its own block kind (as the user directed), rather than a
`heading` kind carrying a level attribute — so no per-block attributes are needed
yet. Atoms stay `text`-only; the mark set is unchanged (`bold, italic, underline,
strike, code, link` — the markdown set).

Validation runs on both edit paths: `validateOps` rejects an `insert_block` /
`insert_row` / `set_block` with an unknown block kind (`ErrInvalidChangeSet` →
400), and `Create` runs `validateContent` over the base — failing closed with the
new `ErrInvalidContent` (→ 400) on any unsupported block/atom/mark kind or invalid
mark range, so a document is never stored with content the ops would reject.

**Still deferred:** list and code block kinds; formula/prompt atom kinds +
evaluation; the versioned Style registry; typed Image/Embed/Chart/Metric blocks;
structured Tables; prompt-output-revision history; semantic rebase.

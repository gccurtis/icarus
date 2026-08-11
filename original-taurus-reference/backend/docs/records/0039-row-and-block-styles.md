# 0039 Row and block styles

This increment puts layout values beside the structural level that owns them:
rows carry bounded extra height, blocks carry horizontal/vertical alignment,
and marks remain exclusively inline range styling. The three style values are
ordinary revision operations with server-computed inverses, so undo and redo
restore exact prior state.

## `core/capability/document/layout.go`

### Define the style vocabulary and bounds

```go
type RowStyle struct {
	HeightIncrease LayoutUnit `json:"heightIncrease"`
}
```

`BlockStyle` adds closed horizontal and vertical alignment enums. Missing block
alignment normalizes to left/top, while row height starts at zero and is
validated against the document's captured cap.

## `core/capability/document/layout.go.md`

### Document layout source verbatim

The new companion keeps every layout/style definition and helper byte-aligned
with the source.

## `core/capability/document/document.go`

### Co-locate style with rows and blocks

```go
type Row struct {
	ID     string
	Style  RowStyle
	Blocks []Block
}
```

`Block` likewise owns `BlockStyle`. Creation, insertion, JSON decoding, and
legacy reads normalize default alignment before validation or replay.

## `core/capability/document/document.go.md`

### Keep the content-model companion current

The companion reproduces the new row/block shapes, normalization, and service
behavior in source order.

## `core/capability/document/changeset.go`

### Make styles revisioned and exactly invertible

```go
OpSetRowHeight      OpType = "set_row_height"
OpSetBlockAlignment OpType = "set_block_alignment"
```

The operations target stable row/block IDs. Alignment pointers distinguish an
omitted axis from an explicit value; inverse generation restores only the axes
the original operation changed. Inserted rows/blocks and cloned inverse payloads
retain styles. Validation rejects unknown alignments and out-of-cap heights.

The inverse builder also restores the exact mark order after an explicit middle
mark removal, completing the pre-existing true-inverse guarantee.

## `core/capability/document/changeset.go.md`

### Describe style replay and compensation

The companion now explains all fifteen operations, whole-Base replay, style
validation, deep copying, and exact inverse behavior.

## `core/capability/document/changeset_test.go`

### Prove style undo, redo, validation, and mark order

Tests apply row height and both alignments in one revision, compare exact state
after undo, redo it through the same endpoint, reject bad values, and verify
that undoing a middle-mark removal recreates the original slice order.

## `core/transport/transport_test.go`

### Exercise styles over the real HTTP boundary

The transport test posts both style operations, fetches their resolved JSON,
and undoes the authored revision.

## `dev-test/changesets/run.sh`

### Add an executable style scenario

The running-server suite checks defaults, applies styles, undoes them, and
performs redo by undoing the compensation.

## `dev-test/changesets/manual.md`

### Document style ownership and wire shapes

The operation table and walkthrough now show the alignment enums, height
increase, captured cap, and undo/redo behavior.

## `dev-test/README.md`

### Keep the suite catalog current

The change-set suite description now covers layout/content operations and
undo/redo rather than describing editing as row/block-only.

## `docs/architecture/capabilities/documents/{README.md,data-model.md,block-types.md,atoms-and-marks.md}`

### Update the conceptual document model

The architecture docs distinguish inline marks from block alignment and row
height, show both style objects in the hierarchy, and record their validation
and operation ownership.

## `docs/orientation/README.md`

### Add layout vocabulary to orientation

The quick mental model now calls out row/block style and revisioned layout so a
new contributor does not infer that all formatting belongs in marks.

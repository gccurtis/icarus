# 0041 Deterministic document pagination

This increment adds the smallest useful page materializer: a pure function that
turns resolved document layout, captured row rules, and ordered row styles into
stable pages. Pages remain derived UI/runtime state, not mutable CRDT content.

## `core/capability/document/layout.go`

### Derive pages by whole-row accumulation

```go
func Paginate(base Base) ([]Page, error)
```

Each row consumes `MaxFontHeight + 2*MinRowPadding + HeightIncrease`. A row
starts a new page only when adding it would exceed usable vertical space, so an
exact fit remains on the current page. Page numbers are one-based, rows are
referred to by canonical IDs, and an empty document yields one empty page.

## `core/capability/document/layout.go.md`

### Keep the paginator source exact

The companion reproduces the page projection and its validation alongside the
layout vocabulary it consumes.

## `core/capability/document/layout_test.go`

### Prove stable packing and captured defaults

Tests cover variable row heights, an exact 30-point fit, overflow onto the next
page, empty content, invalid over-cap input, service restart under different
defaults, and preservation of the original document's captured metrics.

## `docs/architecture/capabilities/documents/{README.md,data-model.md}`

### Document pages as a projection

The architecture explains the row-height formula and packing boundary, and
marks `Page` as derived rather than persisted or revised.

## `dev-test/changesets/manual.md`

### Explain renderer-facing pagination inputs

The manual states how a renderer derives pages from the canonical Base and why
configuration changes do not retroactively repaginate old documents.

## `dev-test/documents/manual.md`

### Correct the resolved-Base explanation

The document walkthrough distinguishes revisioned layout/rules/rows from the
derived page membership built from them.

## `docs/orientation/README.md`

### Add derived pagination to the mental model

New contributors now see that pages are deterministic output, not independently
addressed content or a second revision mechanism.

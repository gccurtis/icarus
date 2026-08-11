# Custom block typography (BR-BLOCK-TYPOGRAPHY-CUSTOM)

Record 0068 deferred this as decision-gated. Product confirmed the need: the
backend should store arbitrary typography values, so a block can carry a
free-form font family, size, and color alongside (or without) a semantic style.

## Model: `StyleOverrides.Custom`

`BlockStyleRef.Overrides` gains a `Custom *CustomTypography`:

```go
type CustomTypography struct {
    FontFamily string `json:"fontFamily,omitempty"`
    FontSize   string `json:"fontSize,omitempty"` // any CSS unit: "14px", "1.2em"
    Color      string `json:"color,omitempty"`
}
```

Values are stored **verbatim** — no semantic-token restriction. The only
validation is a length bound per field (128 / 32 / 64), so a single override can
never be unbounded. It rides the existing `set_block_style_overrides` machinery
for cloning, inverse, and normalization, since it is a field of `StyleOverrides`.

## Op: `set_block_custom_typography`

A dedicated change op sets or clears just a block's custom typography, so an
inspector need not resend the block's semantic overrides:

- A present `customTypography` sets it; a **nil** payload clears it.
- It is **ungated**: unlike the semantic override fields it is *not* checked
  against a style definition's `allowOverrides` list, and it needs no assigned
  style — a block with only custom typography gets a bare `BlockStyleRef` (empty
  `styleId`). Clearing collapses that bare ref back to nil.
- Full changeset lifecycle: apply, inverse (restores the prior value, nil =
  clear), validate, normalize, rebase (`block-custom-typography`, block presence
  the only precondition), and clone.

No transport change — it flows through `POST /documents/:id/changes` like any op.

## Tests

- **Unit** (`changeset_custom_typography_test.go`): arbitrary values stored
  verbatim on an unstyled block; replace swaps the whole custom set; clear
  collapses the bare ref; undo/redo round-trips; coexists with a semantic style
  that allows no overrides (proving it is ungated); an over-long field is
  rejected.
- **Integration** (`dev-test/typography/run.sh`, no model, always runs): set →
  replace → clear over HTTP, and an over-long font family is a 400.

This supersedes the deferral in record 0068.

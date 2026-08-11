# 0061 — Normalized track weights

Row tracks already expressed column widths as integer weights that layout
divides proportionally (`0048-horizontal-row-tracks`). This increment makes the
stored weights **normalized on write**: every time a row's tracks are written
they are rescaled to sum to a fixed total, so a weight reads directly as the
block's percentage share of the row's content width. Proportions are unchanged —
only the scale is fixed — so layout output is identical while stored values
become comparable across rows and renderers.

## core/capability/document/track.go

### `NormalizedTotalWeight` constant

```go
	// NormalizedTotalWeight is the fixed total a row's track weights are rescaled
	// to sum to whenever tracks are written. Normalizing against a constant total
	// turns each weight into a direct proportion of the row's content width (a
	// percentage), so stored weights read the same way across rows and renderers.
	NormalizedTotalWeight = 100
```

**What:** the fixed total weights are normalized to. **Goal:** give stored
weights a single, stable meaning (a percentage). **Why 100:** it keeps every
per-track weight comfortably inside `[MinTrackWeight, MaxTrackWeight]` and reads
as a plain percentage; a larger total (e.g. `MaxTotalWeight`) would let a single
track exceed `MaxTrackWeight` and fail validation.

### `normalizeTrackWeights` — largest-remainder apportionment

```go
func normalizeTrackWeights(tracks []Track) {
	n := len(tracks)
	if n == 0 {
		return
	}
	floor := MinTrackWeight
	if n*floor >= NormalizedTotalWeight {
		for i := range tracks {
			tracks[i].Weight = floor
		}
		return
	}
	distributable := NormalizedTotalWeight - n*floor
	...
```

**What:** rescales weights in place to sum to exactly `NormalizedTotalWeight`,
preserving proportions, guaranteeing each track `MinTrackWeight`, and handing the
integer rounding remainder to the largest fractional shares. **Goal:** a total
that is always exact (no drift from repeated rounding) and never produces a
zero-width track. **Why largest-remainder:** naive per-track rounding loses or
gains units against the total; largest-remainder distributes exactly the
leftover, and reserving `MinTrackWeight` up front keeps small shares visible. It
is idempotent — an already-normalized set is returned unchanged — so re-applying
a stored (already-normalized) op during undo/redo round-trips cleanly.

### `normalizeRowTracks` runs normalization on every repair

```go
	if !rowTracksWellFormed(row) {
		row.Tracks = defaultTracks(row.Blocks)
	}
	normalizeTrackWeights(row.Tracks)
```

**What:** the row-track normalizer now always rescales weights (previously it
returned early for any in-bounds set). The per-track shape check moved into
`rowTracksWellFormed`, which deliberately ignores the weight total because
normalization owns it. **Goal/why:** make normalization the default for every
structural mutation that flows through `normalizeRowTracks` (insert/delete/move
block, stored-base load), not just for freshly-defaulted rows.

## core/capability/document/changeset_apply.go

### `OpSetRowTracks` normalizes the authored weights

```go
		row.Tracks = cloneTracks(op.Tracks)
		normalizeTrackWeights(row.Tracks)
		return rows, nil
```

**What:** after validating and cloning the author's tracks, their weights are
normalized before being stored. **Goal:** authored weights are treated as raw
proportions (any in-bounds ratio is accepted) and always land normalized.
**Why:** this is the primary write path for explicit column sizing, so it is
where "normalize on write" has to hold; `OpResizeAdjacentTracks` already
preserves the total (it moves weight between two adjacent tracks), so it needs no
extra normalization.

## core/capability/document/track_internal_test.go & changeset_test.go

### Tests updated to the normalized scale

A new white-box test (`TestNormalizeTrackWeights`) asserts the apportionment math
directly: results sum to `NormalizedTotalWeight`, honor `MinTrackWeight`, are
idempotent, and preserve authored ratios (`3:1 → 75:25`, `1:1:1 → 34:33:33`).
The existing `TestSetRowTracksAndUndo` and `TestResizeAdjacentTracksAndValidation`
were moved to the normalized scale (default `[50,50]`, `3:1` stored as `[75,25]`,
a `+2` resize as `[52,48]`), and the resize out-of-bounds case now uses a delta
large enough to breach `MinTrackWeight` at the new scale.

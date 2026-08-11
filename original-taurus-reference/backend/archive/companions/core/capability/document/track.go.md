# track.go

Current state companion for `track.go`. This file mirrors the source exactly so the documented view cannot drift from the implementation.

## Code breakdown

### Track type, constants, validation, normalization, and clone

```go
package document

import "sort"

const (
	MaxTrackWeight            = 1000
	MinTrackWeight            = 1
	MaxTrackGap    LayoutUnit = 288 // 4 inches
	MaxTotalWeight            = 10000
	// NormalizedTotalWeight is the fixed total a row's track weights are rescaled
	// to sum to whenever tracks are written. Normalizing against a constant total
	// turns each weight into a direct proportion of the row's content width (a
	// percentage), so stored weights read the same way across rows and renderers.
	NormalizedTotalWeight = 100
)

// Track binds one block to its horizontal layout in a row. The row's content
// width (page width minus margins) is divided among blocks in proportion to
// their weights, which are normalized on every write to sum to
// NormalizedTotalWeight — so a weight is directly the block's percentage of the
// row. Gap is trailing space between this block and the next (the last block's
// gap is always zero). MinWidth is the minimum width in typographic points.
type Track struct {
	BlockID  string     `json:"blockId"`
	Weight   int        `json:"weight"`
	Gap      LayoutUnit `json:"gap"`
	MinWidth LayoutUnit `json:"minWidth"`
}

func validTrackWeight(weight int) bool {
	return weight >= MinTrackWeight && weight <= MaxTrackWeight
}

func validTrackGap(gap LayoutUnit, isLast bool) bool {
	if gap < 0 || gap > MaxTrackGap {
		return false
	}
	return !isLast || gap == 0
}

func validTrackMinWidth(minWidth LayoutUnit, contentWidth LayoutUnit) bool {
	return minWidth >= 0 && minWidth <= contentWidth
}

// validTracks checks that a track slice is well-formed against the given row:
// there must be one track per block (when the row has 2+ blocks), each track
// references a block in order, weights and gaps are in bounds, and min widths are
// within the page's content width.
func validTracks(tracks []Track, rows []Row, rowIndex, contentWidth int) bool {
	if len(tracks) == 0 {
		return true
	}
	row := rows[rowIndex]
	if len(row.Blocks) <= 1 {
		return len(tracks) == 0
	}
	if len(tracks) != len(row.Blocks) {
		return false
	}
	for i, track := range tracks {
		if track.BlockID != row.Blocks[i].ID {
			return false
		}
		if !validTrackWeight(track.Weight) {
			return false
		}
		if !validTrackGap(track.Gap, i == len(tracks)-1) {
			return false
		}
		if !validTrackMinWidth(track.MinWidth, LayoutUnit(contentWidth)) {
			return false
		}
	}
	return true
}

func normalizeRowTracks(row *Row) {
	if len(row.Blocks) <= 1 {
		row.Tracks = nil
		return
	}
	if !rowTracksWellFormed(row) {
		row.Tracks = defaultTracks(row.Blocks)
	}
	normalizeTrackWeights(row.Tracks)
}

// rowTracksWellFormed reports whether a row's tracks are one-per-block, in order,
// and individually in bounds. It does not consider the weight total: weights are
// rescaled by normalizeTrackWeights, so any in-range set is acceptable here.
func rowTracksWellFormed(row *Row) bool {
	if len(row.Tracks) != len(row.Blocks) {
		return false
	}
	for i, track := range row.Tracks {
		if track.BlockID != row.Blocks[i].ID || !validTrackWeight(track.Weight) ||
			!validTrackGap(track.Gap, i == len(row.Tracks)-1) ||
			!validTrackMinWidth(track.MinWidth, LayoutUnit(612)) {
			return false
		}
	}
	return true
}

// normalizeTrackWeights rescales the tracks' weights in place so they sum to
// exactly NormalizedTotalWeight while preserving their relative proportions.
// Every track is guaranteed at least MinTrackWeight, and the integer rounding
// remainder is handed to the largest fractional shares so nothing is lost. This
// makes weight-writing idempotent: an already-normalized set is left unchanged.
func normalizeTrackWeights(tracks []Track) {
	n := len(tracks)
	if n == 0 {
		return
	}
	floor := MinTrackWeight
	// Degenerate: more tracks than the total can seat at the minimum. Give each
	// the minimum and stop — the proportions cannot all be honored.
	if n*floor >= NormalizedTotalWeight {
		for i := range tracks {
			tracks[i].Weight = floor
		}
		return
	}
	distributable := NormalizedTotalWeight - n*floor
	var total int
	for _, t := range tracks {
		total += t.Weight
	}
	if total <= 0 {
		// No proportion information survives; split the shared portion evenly.
		total = n
		for i := range tracks {
			tracks[i].Weight = 1
		}
	}
	// Largest-remainder apportionment: floor each share, then hand the leftover
	// units to the largest fractional remainders (ties resolve to lower index).
	type share struct {
		idx       int
		whole     int
		remainder int
	}
	shares := make([]share, n)
	assigned := 0
	for i, t := range tracks {
		num := t.Weight * distributable
		whole := num / total
		shares[i] = share{idx: i, whole: whole, remainder: num - whole*total}
		assigned += whole
	}
	leftover := distributable - assigned
	sort.SliceStable(shares, func(a, b int) bool {
		return shares[a].remainder > shares[b].remainder
	})
	for rank, s := range shares {
		extra := 0
		if rank < leftover {
			extra = 1
		}
		tracks[s.idx].Weight = floor + s.whole + extra
	}
}

func defaultTracks(blocks []Block) []Track {
	if len(blocks) <= 1 {
		return nil
	}
	tracks := make([]Track, len(blocks))
	for i := range blocks {
		tracks[i] = Track{
			BlockID:  blocks[i].ID,
			Weight:   1,
			Gap:      0,
			MinWidth: 0,
		}
	}
	return tracks
}

func cloneTracks(tracks []Track) []Track {
	if len(tracks) == 0 {
		return nil
	}
	out := make([]Track, len(tracks))
	copy(out, tracks)
	return out
}
```

Track is the horizontal layout property for one block inside a multi-block row.
Weights are integer for deterministic proportional division across renderers,
and every write normalizes them so they sum to `NormalizedTotalWeight` — a
weight is therefore directly the block's percentage share of the row.
`normalizeRowTracks` repairs missing or stale track data — generating default
equal-weight tracks when a multi-block row has none, clearing tracks for
single-block rows — and then rescales the weights via `normalizeTrackWeights`,
which distributes a fixed total by largest-remainder apportionment while
guaranteeing every track at least `MinTrackWeight`. `rowTracksWellFormed`
checks per-track shape (one per block, in order, in bounds) without judging the
weight total, since normalization owns the total. `cloneTracks` deep-copies the
slice so operations never share track slices with the base.

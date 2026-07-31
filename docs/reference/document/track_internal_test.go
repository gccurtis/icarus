package document

import "testing"

// TestNormalizeTrackWeights exercises the apportionment math directly: every
// result must sum to NormalizedTotalWeight, honor MinTrackWeight, and preserve
// the authored proportions up to integer rounding.
func TestNormalizeTrackWeights(t *testing.T) {
	cases := []struct {
		name string
		in   []int
		want []int
	}{
		{"equal pair", []int{1, 1}, []int{50, 50}},
		{"three to one", []int{3, 1}, []int{75, 25}},
		{"already normalized is idempotent", []int{75, 25}, []int{75, 25}},
		{"raw magnitude only matters as ratio", []int{300, 100}, []int{75, 25}},
		{"remainder handed to largest shares", []int{1, 1, 1}, []int{34, 33, 33}},
		{"tiny share still gets the minimum", []int{999, 1}, []int{99, 1}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tracks := make([]Track, len(tc.in))
			for i, w := range tc.in {
				tracks[i] = Track{Weight: w}
			}
			normalizeTrackWeights(tracks)

			var sum int
			for i, track := range tracks {
				if track.Weight < MinTrackWeight {
					t.Errorf("track %d weight %d below MinTrackWeight", i, track.Weight)
				}
				if track.Weight != tc.want[i] {
					t.Errorf("track %d weight = %d, want %d", i, track.Weight, tc.want[i])
				}
				sum += track.Weight
			}
			if sum != NormalizedTotalWeight {
				t.Errorf("weights sum to %d, want %d", sum, NormalizedTotalWeight)
			}
		})
	}
}

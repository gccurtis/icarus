package document

import "testing"

// TestNormalizeStoredBaseIsPure pins down that normalizeStoredBase is a pure
// function: it returns a normalized copy and never writes through to its input.
// A multi-block row's tracks must be normalized in the result while the caller's
// Base stays untouched.
func TestNormalizeStoredBaseIsPure(t *testing.T) {
	in := Base{Rows: []Row{{
		ID: "r1",
		Blocks: []Block{
			{ID: "b1", Kind: BlockKindText},
			{ID: "b2", Kind: BlockKindText},
		},
	}}}

	out := normalizeStoredBase(in, defaultPageLayout(), defaultLayoutRules())

	if got := len(out.Rows[0].Tracks); got != 2 {
		t.Fatalf("result tracks = %d, want 2 (normalized)", got)
	}
	if out.Rows[0].Tracks[0].Weight != 50 || out.Rows[0].Tracks[1].Weight != 50 {
		t.Fatalf("result track weights = %+v, want [50 50]", out.Rows[0].Tracks)
	}
	if in.Rows[0].Tracks != nil {
		t.Fatalf("input was mutated: tracks = %+v, want nil", in.Rows[0].Tracks)
	}
	if out.PageLayout == (PageLayout{}) {
		t.Fatalf("result page layout not defaulted")
	}
	if in.PageLayout != (PageLayout{}) {
		t.Fatalf("input page layout was mutated to %+v", in.PageLayout)
	}
}
